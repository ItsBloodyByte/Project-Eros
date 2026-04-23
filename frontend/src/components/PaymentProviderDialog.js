import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { CreditCard, Wallet, Building2, Loader2, Landmark } from "lucide-react";

/**
 * PaymentProviderDialog
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (v: boolean) => void
 *  - pkg: selected package { id, desc, amount, currency, kind, days?, minutes? }
 *  - providersLive: { stripe: bool, paypal: bool, klarna: bool }
 *
 * Behaviour:
 *  - Stripe: POST /payments/checkout → redirect to hosted checkout.
 *  - PayPal: POST /payments/paypal/create-order → redirect to approve_url.
 *      On return (/payments/paypal/return) we call capture from PaypalReturnPage.
 *  - Klarna: redirect to /payments/klarna/checkout?pkg=xxx, which mounts the Klarna widget.
 */
export function PaymentProviderDialog({ open, onOpenChange, pkg, providersLive }) {
  const [busy, setBusy] = useState(null); // provider id while request is in-flight

  const allowedHosts = useMemo(() => ([
    "checkout.stripe.com",
    "pay.stripe.com",
    "billing.stripe.com",
    "www.paypal.com",
    "checkout.paypal.com",
    "www.sandbox.paypal.com",
    "pay.mollie.com",
    "checkout.klarna.com",
    "buy.paddle.com",
  ]), []);

  const safeRedirect = (raw) => {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:") return false;
      if (!allowedHosts.includes(u.host)) return false;
      window.location.href = raw;
      return true;
    } catch {
      return false;
    }
  };

  const payStripe = async () => {
    if (!pkg) return;
    setBusy("stripe");
    try {
      const origin = window.location.origin;
      const { data } = await api.post("/payments/checkout", { package_id: pkg.id, origin_url: origin });
      if (!data?.url || !safeRedirect(data.url)) {
        toast.error("Ungültige Checkout-URL empfangen.");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Stripe-Checkout fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const payPayPal = async () => {
    if (!pkg) return;
    setBusy("paypal");
    try {
      const origin = window.location.origin;
      const { data } = await api.post("/payments/paypal/create-order", { package_id: pkg.id, origin_url: origin });
      // Persist context so the return page knows what to capture.
      sessionStorage.setItem("eros_pending_paypal", JSON.stringify({
        order_id: data.order_id, package_id: pkg.id, ts: Date.now(),
      }));
      if (!data?.approve_url || !safeRedirect(data.approve_url)) {
        toast.error("PayPal-Approval-URL nicht empfangen.");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "PayPal-Bestellung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const payKlarna = () => {
    if (!pkg) return;
    // Navigate to dedicated Klarna checkout page which loads the widget.
    window.location.href = `/payments/klarna/checkout?pkg=${encodeURIComponent(pkg.id)}`;
  };

  if (!pkg) return null;
  const price = `${Number(pkg.amount).toFixed(2)} ${(pkg.currency || "eur").toUpperCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="payment-provider-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Zahlungsart wählen</DialogTitle>
          <DialogDescription>
            <span className="block text-sm">{pkg.desc}</span>
            <span className="mt-1 inline-flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-mono">{price}</span>
              {pkg.days ? <Badge variant="secondary">{pkg.days} Tage</Badge> : null}
              {pkg.minutes ? <Badge variant="secondary">{pkg.minutes} Min.</Badge> : null}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <ProviderButton
            id="stripe"
            testid="pay-stripe"
            icon={<CreditCard className="h-4 w-4" />}
            label="Kreditkarte (Stripe)"
            hint="Visa · Mastercard · Apple Pay · Google Pay"
            disabled={!providersLive?.stripe}
            busy={busy === "stripe"}
            onClick={payStripe}
          />
          <ProviderButton
            id="paypal"
            testid="pay-paypal"
            icon={<Wallet className="h-4 w-4" />}
            label="PayPal"
            hint="Konto · Lastschrift · Kreditkarte über PayPal"
            disabled={!providersLive?.paypal}
            busy={busy === "paypal"}
            onClick={payPayPal}
          />
          <ProviderButton
            id="klarna"
            testid="pay-klarna"
            icon={<Landmark className="h-4 w-4" />}
            label="Klarna"
            hint="Rechnung · Sofortüberweisung · Ratenkauf"
            disabled={!providersLive?.klarna}
            busy={busy === "klarna"}
            onClick={payKlarna}
          />
        </div>

        <DialogFooter className="flex items-center justify-between">
          <p className="text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
            Du wirst zu unserem Zahlungspartner weitergeleitet. Eros speichert keine Kartendaten.
          </p>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="pay-cancel">Abbrechen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProviderButton({ id, icon, label, hint, disabled, busy, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      data-testid={testid}
      className={
        "group flex items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors " +
        "hover:border-[hsl(var(--accent))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/50 " +
        "disabled:opacity-50 disabled:cursor-not-allowed"
      }
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[hsl(var(--muted))]/60 text-[hsl(var(--accent))]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span className="flex-1">
        <span className="block font-display text-sm">{label}</span>
        <span className="block text-xs text-[hsl(var(--muted-foreground))]">{hint}</span>
      </span>
      {disabled && <Badge variant="outline" className="text-[10px]">Nicht konfiguriert</Badge>}
    </button>
  );
}

export default PaymentProviderDialog;
