"""Payment provider webhook receivers.

These endpoints are mounted on the root `app` (NOT `api_router`) because the
external providers POST to fixed URLs:
  - `/api/webhook/stripe`
  - `/api/webhook/paypal`
  - `/api/webhook/klarna`

All idempotency-critical helpers (`_record_webhook_event`,
`_mark_webhook_processed`, `_apply_successful_payment`, `_apply_entitlement`,
`_verify_paypal_webhook`, `_get_payment_config`) remain in `server.py` so
that background tasks and other parts of the codebase can still call them.

Each handler follows the same pattern:
  1. Parse & identify the event.
  2. Record it via `_record_webhook_event(provider, event_id, excerpt)`.
     - If the insert fails (duplicate key), short-circuit with {"duplicate": true}.
  3. Try the business logic.
  4. Mark processed (success or error) via `_mark_webhook_processed`.
"""

import os  # noqa: F401 — re-exported for consistency across router modules
import json
import logging

from fastapi import HTTPException, Request

from emergentintegrations.payments.stripe.checkout import StripeCheckout

from server import (
    app,
    db,
    now_utc,
    _get_payment_config,
    _record_webhook_event,
    _mark_webhook_processed,
    _apply_successful_payment,
    _apply_entitlement,
    _verify_paypal_webhook,
)

logger = logging.getLogger("app.routers.webhooks")


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    cfg = await _get_payment_config()
    api_key = cfg.get("stripe_api_key") or os.environ.get("STRIPE_API_KEY", "")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    try:
        evt = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.exception("Webhook handling error: %s", e)
        raise HTTPException(400, "Invalid webhook")
    event_id = getattr(evt, "event_id", None) or getattr(evt, "id", None) or evt.session_id
    is_new = await _record_webhook_event(
        "stripe", str(event_id),
        {"session_id": evt.session_id, "payment_status": evt.payment_status},
    )
    if not is_new:
        return {"ok": True, "duplicate": True}
    try:
        if evt.payment_status == "paid":
            await _apply_successful_payment(evt.session_id, evt.metadata or {})
        await _mark_webhook_processed("stripe", str(event_id))
    except Exception as ex:
        await _mark_webhook_processed("stripe", str(event_id), error=str(ex)[:500])
        logger.exception("Stripe webhook processing failed: %s", ex)
        raise HTTPException(500, "Webhook processing failed")
    return {"ok": True}


@app.post("/api/webhook/paypal")
async def paypal_webhook(request: Request):
    """Handle PayPal webhook events (PAYMENT.CAPTURE.COMPLETED etc.)."""
    raw = await request.body()
    try:
        event = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    event_id = event.get("id") or event.get("event_id")
    event_type = event.get("event_type") or ""
    if not event_id:
        raise HTTPException(400, "Missing event id")
    cfg = await _get_payment_config()
    strict = bool(cfg.get("strict_webhook_verification", False))
    headers_lc = {k.lower(): v for k, v in request.headers.items()}
    verified = await _verify_paypal_webhook(cfg, headers_lc, raw, event)
    if strict and not verified:
        raise HTTPException(401, "Webhook signature invalid")
    if not verified:
        logger.warning("PayPal webhook %s accepted without verification (strict mode OFF).", event_id)
    is_new = await _record_webhook_event("paypal", str(event_id), {"event_type": event_type})
    if not is_new:
        return {"ok": True, "duplicate": True}
    try:
        resource = event.get("resource") or {}
        order_id = None
        supp = resource.get("supplementary_data") or {}
        rel = supp.get("related_ids") or {}
        order_id = rel.get("order_id") or resource.get("id")
        if event_type.startswith("CHECKOUT.ORDER."):
            order_id = resource.get("id") or order_id
        if not order_id:
            await _mark_webhook_processed("paypal", str(event_id), error="No order_id resolvable")
            return {"ok": True, "noop": True}
        txn = await db.payment_transactions.find_one({"provider": "paypal", "order_id": order_id})
        if not txn:
            await _mark_webhook_processed("paypal", str(event_id), error=f"Unknown order_id {order_id}")
            return {"ok": True, "noop": True}
        if txn.get("status") == "paid":
            await _mark_webhook_processed("paypal", str(event_id))
            return {"ok": True, "already_paid": True}
        if event_type in {"PAYMENT.CAPTURE.COMPLETED", "CHECKOUT.ORDER.COMPLETED"}:
            await db.payment_transactions.update_one(
                {"_id": txn["_id"]},
                {"$set": {"status": "paid", "paid_at": now_utc().isoformat(),
                          "webhook_event_id": event_id}},
            )
            await _apply_entitlement(txn.get("user_id"), txn.get("package_id"))
        elif event_type in {"PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.REFUNDED", "CHECKOUT.ORDER.VOIDED"}:
            await db.payment_transactions.update_one(
                {"_id": txn["_id"]},
                {"$set": {"status": "failed" if "DENIED" in event_type else "refunded",
                          "webhook_event_id": event_id}},
            )
        await _mark_webhook_processed("paypal", str(event_id))
    except Exception as ex:
        await _mark_webhook_processed("paypal", str(event_id), error=str(ex)[:500])
        logger.exception("PayPal webhook processing failed: %s", ex)
        raise HTTPException(500, "Webhook processing failed")
    return {"ok": True}


@app.post("/api/webhook/klarna")
async def klarna_push(request: Request):
    """Handle Klarna Order Management push notifications.

    Klarna POSTs JSON to this URL after order status changes. We use the `order_id`
    to reconcile our transaction. An optional shared secret can be validated via
    the `Eros-Klarna-Token` header when configured.
    """
    raw = await request.body()
    try:
        event = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    cfg = await _get_payment_config()
    keys = (cfg.get("provider_keys") or {}).get("klarna") or {}
    shared = keys.get("push_secret")
    if shared:
        incoming = request.headers.get("eros-klarna-token") or request.headers.get("Eros-Klarna-Token")
        if incoming != shared:
            raise HTTPException(401, "Invalid shared token")
    order_id = event.get("order_id") or event.get("orderId") or event.get("id")
    event_id = event.get("event_id") or f"klarna:{order_id}:{event.get('status') or event.get('fraud_status')}"
    if not order_id:
        raise HTTPException(400, "Missing order_id")
    is_new = await _record_webhook_event(
        "klarna", str(event_id),
        {"order_id": order_id, "status": event.get("status")},
    )
    if not is_new:
        return {"ok": True, "duplicate": True}
    try:
        txn = await db.payment_transactions.find_one({"provider": "klarna", "order_id": order_id})
        if not txn:
            await _mark_webhook_processed("klarna", str(event_id), error=f"Unknown order_id {order_id}")
            return {"ok": True, "noop": True}
        status = (event.get("status") or event.get("fraud_status") or "").upper()
        if status in {"AUTHORIZED", "CAPTURED", "ACCEPTED", "PAID"}:
            if txn.get("status") != "paid":
                await db.payment_transactions.update_one(
                    {"_id": txn["_id"]},
                    {"$set": {"status": "paid", "paid_at": now_utc().isoformat(),
                              "webhook_event_id": event_id}},
                )
                await _apply_entitlement(txn.get("user_id"), txn.get("package_id"))
        elif status in {"CANCELLED", "REJECTED", "FAILED", "REFUNDED"}:
            await db.payment_transactions.update_one(
                {"_id": txn["_id"]},
                {"$set": {"status": "refunded" if status == "REFUNDED" else "failed",
                          "webhook_event_id": event_id}},
            )
        await _mark_webhook_processed("klarna", str(event_id))
    except Exception as ex:
        await _mark_webhook_processed("klarna", str(event_id), error=str(ex)[:500])
        logger.exception("Klarna push processing failed: %s", ex)
        raise HTTPException(500, "Webhook processing failed")
    return {"ok": True}
