"""User-facing payment routes.

Covers:
  - `GET /api/payments/packages`          (list enabled packages + provider status)
  - `POST /api/payments/checkout`         (Stripe-hosted checkout session)
  - `GET /api/payments/status/{session_id}` (Stripe checkout status)
  - `POST /api/payments/paypal/create-order`
  - `POST /api/payments/paypal/{order_id}/capture`
  - `POST /api/payments/klarna/create-session`
  - `POST /api/payments/klarna/place-order`

The corresponding webhook receivers (Stripe, PayPal, Klarna) live in
`routers/webhooks.py` because they are mounted on the root `app` instead of
the `/api` router (external providers POST to fixed URLs).

Entitlement/helpers (`_apply_successful_payment`, `_apply_entitlement`,
`_paypal_access_token`, `_klarna_api_base`, `_get_payment_config`,
`_find_package`) remain in `server.py` for now.
"""

import os
import uuid
import logging

from fastapi import Depends, HTTPException, Request

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

from server import (
    api_router,
    app,
    db,
    now_utc,
    _require_user,
    _get_payment_config,
    _find_package,
    _live_providers,
    _apply_successful_payment,
    _apply_entitlement,
    _paypal_access_token,
    _klarna_api_base,
    serialize_doc,
    _audit,
    logger as _server_logger,
)
from rate_limit import rate_limiter, client_ip as _ratelimit_client_ip
from models import (
    CheckoutRequest,
    PayPalOrderRequest,
    KlarnaSessionRequest,
    KlarnaPlaceOrderRequest,
)

logger = logging.getLogger("app.routers.payments")


# Max discrepancy (in minor units / cents) tolerated between what we asked the
# provider to charge and what the provider actually captured. Zero would be
# ideal, but some gateways round the tax field — so allow a single cent for
# safety. Larger deltas indicate tampering or a mis-wired integration and we
# reject them.
_AMOUNT_TOLERANCE_MINOR_UNITS = 1


@api_router.get("/payments/packages")
async def list_packages(user=Depends(_require_user)):
    cfg = await _get_payment_config()
    pkgs = [p for p in (cfg.get("packages") or []) if p.get("enabled", True)]
    return {
        "enabled": bool(cfg.get("enabled")) and cfg.get("provider") != "disabled",
        "provider": cfg.get("provider", "disabled"),
        "supported": cfg.get("provider", "disabled") in {"stripe", "paypal", "klarna"},
        "packages": pkgs,
        "providers_live": _live_providers(cfg),
    }


# ---------- Stripe ----------
@api_router.post("/payments/checkout")
async def create_checkout(body: CheckoutRequest, request: Request, user=Depends(_require_user)):
    # Rate-limit: authenticated users may create at most 8 checkout sessions/hour
    # and 24/day. Stripe itself rejects abusive traffic, but we want to cap it
    # at our edge to keep DB churn and webhook-event load predictable.
    await rate_limiter.check(f"pay:checkout:user:{user['id']}:hr", capacity=8, window_seconds=3600)
    await rate_limiter.check(f"pay:checkout:user:{user['id']}:day", capacity=24, window_seconds=86400)
    cfg = await _get_payment_config()
    if not cfg.get("enabled") or cfg.get("provider") == "disabled":
        raise HTTPException(400, "Zahlungen sind deaktiviert")
    pkg = _find_package(cfg, body.package_id)
    if not pkg:
        raise HTTPException(400, "Unbekanntes oder deaktiviertes Paket")
    provider = cfg.get("provider", "disabled")
    if provider != "stripe":
        raise HTTPException(
            501,
            f"Anbieter '{provider}' ist konfiguriert, aber noch nicht integriert. "
            f"Bitte Stripe verwenden oder Admin kontaktieren.",
        )
    pkeys = (cfg.get("provider_keys") or {}).get("stripe") or {}
    api_key = pkeys.get("secret_key") or cfg.get("stripe_api_key") or os.environ.get("STRIPE_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "Stripe API-Key fehlt")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/payments/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/account"
    req = CheckoutSessionRequest(
        amount=float(pkg["amount"]),
        currency=pkg.get("currency", "eur"),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user["id"], "package_id": body.package_id},
    )
    session = await stripe_checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "package_id": body.package_id,
        "amount": pkg["amount"],
        "currency": pkg.get("currency", "eur"),
        "payment_status": "initiated",
        "provider": provider,
        "created_at": now_utc().isoformat(),
    })
    # Audit for every created checkout session — makes fraud triage possible.
    await _audit(user["id"], "payment_checkout_created", session.session_id, {
        "provider": provider, "package_id": body.package_id, "amount": pkg["amount"],
    })
    return {"url": session.url, "session_id": session.session_id, "provider": provider}


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request, user=Depends(_require_user)):
    cfg = await _get_payment_config()
    api_key = cfg.get("stripe_api_key") or os.environ.get("STRIPE_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "Payment provider not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)
    if status.payment_status == "paid":
        await _apply_successful_payment(session_id, status.metadata or {})
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    return {"status": status.status, "payment_status": status.payment_status,
            "amount_total": status.amount_total, "currency": status.currency,
            "metadata": status.metadata, "txn": serialize_doc(txn) if txn else None}


# ---------- PayPal ----------
@api_router.post("/payments/paypal/create-order")
async def paypal_create_order(body: PayPalOrderRequest, user=Depends(_require_user)):
    """Create a PayPal Orders v2 order. Returns the approval URL for redirect."""
    await rate_limiter.check(f"pay:paypal-create:user:{user['id']}:hr", capacity=10, window_seconds=3600)
    cfg = await _get_payment_config()
    pkg = _find_package(cfg, body.package_id)
    if not pkg:
        raise HTTPException(400, "Paket nicht verfügbar")
    token, api_base = await _paypal_access_token(cfg)
    amount_str = f"{float(pkg['amount']):.2f}"
    origin = (body.origin_url or "").rstrip("/")
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": pkg["id"],
            "description": pkg.get("desc") or pkg["id"],
            "custom_id": f"{user['id']}|{pkg['id']}",
            "amount": {
                "currency_code": (pkg.get("currency") or "eur").upper(),
                "value": amount_str,
            },
        }],
        "application_context": {
            "brand_name": "Eros",
            "user_action": "PAY_NOW",
            "return_url": f"{origin}/payments/paypal/return",
            "cancel_url": f"{origin}/payments/paypal/cancel",
        },
    }
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"{api_base}/v2/checkout/orders",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if r.status_code >= 400:
            logger.error("PayPal create order error: %s %s", r.status_code, r.text[:500])
            raise HTTPException(502, "PayPal-Bestellung konnte nicht angelegt werden")
        data = r.json()
    approve = next((lnk.get("href") for lnk in (data.get("links") or []) if lnk.get("rel") == "approve"), None)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "provider": "paypal",
        "order_id": data.get("id"),
        "user_id": user["id"],
        "package_id": pkg["id"],
        "amount": float(pkg["amount"]),
        "currency": (pkg.get("currency") or "eur").upper(),
        "status": "created",
        "created_at": now_utc().isoformat(),
    })
    await _audit(user["id"], "payment_paypal_order_created", data.get("id"), {
        "package_id": pkg["id"], "amount": float(pkg["amount"]),
    })
    return {"order_id": data.get("id"), "approve_url": approve, "status": data.get("status")}


@api_router.post("/payments/paypal/{order_id}/capture")
async def paypal_capture_order(order_id: str, user=Depends(_require_user)):
    """Capture a PayPal order after user approval; activates premium / boost on success."""
    await rate_limiter.check(f"pay:paypal-capture:user:{user['id']}:hr", capacity=15, window_seconds=3600)
    cfg = await _get_payment_config()
    token, api_base = await _paypal_access_token(cfg)
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"{api_base}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if r.status_code >= 400:
            logger.error("PayPal capture error: %s %s", r.status_code, r.text[:500])
            raise HTTPException(502, "PayPal-Zahlung konnte nicht eingezogen werden")
        data = r.json()
    status_ok = (data.get("status") == "COMPLETED")
    txn = await db.payment_transactions.find_one({"provider": "paypal", "order_id": order_id})
    # Anti-tampering: make sure the capture is for OUR user, OUR package,
    # AT the expected amount+currency. If PayPal reports a delta we refuse to
    # grant entitlement and flag the transaction for review.
    tampering_reason: Optional[str] = None
    if txn and txn.get("user_id") != user["id"]:
        tampering_reason = "user_mismatch"
    if status_ok and txn and not tampering_reason:
        try:
            captured = ((data.get("purchase_units") or [{}])[0].get("payments", {})
                        .get("captures", [{}])[0])
            amt = captured.get("amount") or {}
            reported_value = float(amt.get("value") or 0)
            reported_currency = (amt.get("currency_code") or "").upper()
            expected_minor = int(round(float(txn.get("amount", 0)) * 100))
            reported_minor = int(round(reported_value * 100))
            if abs(expected_minor - reported_minor) > _AMOUNT_TOLERANCE_MINOR_UNITS:
                tampering_reason = f"amount_mismatch:{reported_value}!={txn.get('amount')}"
            elif reported_currency and reported_currency != (txn.get("currency") or "").upper():
                tampering_reason = f"currency_mismatch:{reported_currency}!={txn.get('currency')}"
        except Exception as ex:
            logger.warning("PayPal capture payload parse error: %s", ex)
    if tampering_reason:
        logger.error("PayPal capture rejected for tampering: %s order=%s user=%s",
                     tampering_reason, order_id, user["id"])
        if txn:
            await db.payment_transactions.update_one(
                {"_id": txn["_id"]},
                {"$set": {"status": "review", "review_reason": tampering_reason,
                          "reviewed_at": now_utc().isoformat()}},
            )
        await _audit(user["id"], "payment_paypal_capture_rejected", order_id, {"reason": tampering_reason})
        raise HTTPException(409, "Zahlungsdifferenz erkannt — Zahlung wird manuell geprüft.")
    if status_ok and txn and txn.get("status") != "paid":
        pkg = _find_package(cfg, txn.get("package_id"))
        if pkg:
            meta = {"user_id": user["id"], "package_id": pkg["id"], "kind": pkg.get("kind", "premium"),
                    "days": pkg.get("days"), "minutes": pkg.get("minutes")}
            try:
                await _apply_successful_payment(order_id, meta)
            except Exception as ex:
                logger.warning("PayPal apply failed: %s", ex)
        await db.payment_transactions.update_one(
            {"_id": txn["_id"]},
            {"$set": {"status": "paid", "paid_at": now_utc().isoformat()}},
        )
        await _audit(user["id"], "payment_paypal_captured", order_id, {
            "package_id": txn.get("package_id"), "amount": txn.get("amount"),
        })
    return {"status": data.get("status"), "order_id": order_id, "paid": status_ok}


# ---------- Klarna ----------
@api_router.post("/payments/klarna/create-session")
async def klarna_create_session(body: KlarnaSessionRequest, user=Depends(_require_user)):
    """Create a Klarna Payments session. Returns client_token for the frontend widget."""
    await rate_limiter.check(f"pay:klarna-sess:user:{user['id']}:hr", capacity=15, window_seconds=3600)
    cfg = await _get_payment_config()
    pkg = _find_package(cfg, body.package_id)
    if not pkg:
        raise HTTPException(400, "Paket nicht verfügbar")
    auth_header, api_base = await _klarna_api_base(cfg)
    amount_cents = int(round(float(pkg["amount"]) * 100))
    currency = (pkg.get("currency") or "eur").upper()
    country = (body.country or "DE").upper()
    payload = {
        "purchase_country": country,
        "purchase_currency": currency,
        "locale": "de-DE" if country in {"DE", "AT", "CH"} else "en-GB",
        "order_amount": amount_cents,
        "order_tax_amount": 0,
        "order_lines": [{
            "type": "digital",
            "reference": pkg["id"],
            "name": pkg.get("desc") or pkg["id"],
            "quantity": 1,
            "unit_price": amount_cents,
            "tax_rate": 0,
            "total_amount": amount_cents,
            "total_tax_amount": 0,
        }],
        "merchant_reference1": f"{user['id']}|{pkg['id']}",
    }
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"{api_base}/payments/v1/sessions",
            json=payload,
            headers={"Authorization": auth_header, "Content-Type": "application/json"},
        )
        if r.status_code >= 400:
            logger.error("Klarna session error: %s %s", r.status_code, r.text[:500])
            raise HTTPException(502, "Klarna-Session konnte nicht erstellt werden")
        data = r.json()
    return {
        "session_id": data.get("session_id"),
        "client_token": data.get("client_token"),
        "payment_method_categories": data.get("payment_method_categories") or [],
    }


@api_router.post("/payments/klarna/place-order")
async def klarna_place_order(body: KlarnaPlaceOrderRequest, user=Depends(_require_user)):
    """Finalise a Klarna order after widget authorization. Activates premium on success."""
    cfg = await _get_payment_config()
    pkg = _find_package(cfg, body.package_id)
    if not pkg:
        raise HTTPException(400, "Paket nicht verfügbar")
    auth_header, api_base = await _klarna_api_base(cfg)
    amount_cents = int(round(float(pkg["amount"]) * 100))
    currency = (pkg.get("currency") or "eur").upper()
    country = (body.country or "DE").upper()
    payload = {
        "purchase_country": country,
        "purchase_currency": currency,
        "locale": "de-DE" if country in {"DE", "AT", "CH"} else "en-GB",
        "order_amount": amount_cents,
        "order_tax_amount": 0,
        "order_lines": [{
            "type": "digital",
            "reference": pkg["id"],
            "name": pkg.get("desc") or pkg["id"],
            "quantity": 1,
            "unit_price": amount_cents,
            "tax_rate": 0,
            "total_amount": amount_cents,
            "total_tax_amount": 0,
        }],
        "merchant_reference1": f"{user['id']}|{pkg['id']}",
        "merchant_urls": {
            "confirmation": f"{os.environ.get('EROS_PUBLIC_URL', '').rstrip('/')}/payments/klarna/return",
        },
    }
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"{api_base}/payments/v1/authorizations/{body.authorization_token}/order",
            json=payload,
            headers={"Authorization": auth_header, "Content-Type": "application/json"},
        )
        if r.status_code >= 400:
            logger.error("Klarna place order error: %s %s", r.status_code, r.text[:500])
            raise HTTPException(502, "Klarna-Zahlung konnte nicht abgeschlossen werden")
        data = r.json()
    order_id = data.get("order_id")
    fraud_status = data.get("fraud_status") or ""
    ok = bool(order_id) and fraud_status.upper() in {"ACCEPTED", "PENDING"}
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "provider": "klarna",
        "order_id": order_id,
        "user_id": user["id"],
        "package_id": pkg["id"],
        "amount": float(pkg["amount"]),
        "currency": currency,
        "status": "paid" if ok else "failed",
        "created_at": now_utc().isoformat(),
        "paid_at": now_utc().isoformat() if ok else None,
    })
    if ok:
        meta = {"user_id": user["id"], "package_id": pkg["id"], "kind": pkg.get("kind", "premium"),
                "days": pkg.get("days"), "minutes": pkg.get("minutes")}
        try:
            await _apply_successful_payment(order_id or body.authorization_token, meta)
        except Exception as ex:
            logger.warning("Klarna apply failed: %s", ex)
    return {"order_id": order_id, "fraud_status": fraud_status, "paid": ok, "redirect_url": data.get("redirect_url")}


# Keep a reference to the re-exported `app` object so static analysers don't
# mark the import as unused; we actually need `app` to be imported here so
# that when routers/webhooks.py is imported (which also imports `app`) the
# module graph is coherent.
_ = app
