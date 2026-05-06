import { useEffect, useState } from "react";
import { Pause, Play, X, Crown, Gift, Calendar } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { api } from "../lib/api";

/**
 * SubscriptionSection — Pause/Resume/Cancel UI for the Account page.
 *
 * The fairness guarantees of Kapitel 15.4 are surfaced verbatim so users
 * understand they aren't punished for cancelling. Pause and resume each
 * make a single POST and re-pull the subscription state to keep the
 * displayed timestamps in sync with the server.
 */
export function SubscriptionSection() {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pauseDays, setPauseDays] = useState(30);
  const [showRedeem, setShowRedeem] = useState(false);
  const [giftCode, setGiftCode] = useState("");

  const refresh = async () => {
    try {
      const { data } = await api.get("/me/subscription");
      setSub(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const cancel = async () => {
    if (!window.confirm("Wirklich kündigen? Premium bleibt bis zum Periodenende aktiv.")) return;
    setBusy(true);
    try {
      await api.post("/me/subscription/cancel");
      toast.success("Abo gekündigt – Premium läuft bis Periodenende weiter.");
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Kündigung fehlgeschlagen"); }
    finally { setBusy(false); }
  };
  const pause = async () => {
    setBusy(true);
    try {
      await api.post("/me/subscription/pause", { days: Math.max(1, Math.min(90, Number(pauseDays) || 30)) });
      toast.success("Abo pausiert. Wir verlieren keine Zeit – die Tage werden hinten angehängt.");
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Pause fehlgeschlagen"); }
    finally { setBusy(false); }
  };
  const resume = async () => {
    setBusy(true);
    try {
      await api.post("/me/subscription/resume");
      toast.success("Abo läuft wieder.");
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Fortsetzen fehlgeschlagen"); }
    finally { setBusy(false); }
  };
  const redeemGift = async () => {
    const code = (giftCode || "").trim();
    if (!code) return;
    setBusy(true);
    try {
      await api.post("/me/subscription/redeem-gift", { code });
      toast.success("Geschenk eingelöst – Premium aktiviert.");
      setGiftCode("");
      setShowRedeem(false);
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Code ungültig oder bereits eingelöst"); }
    finally { setBusy(false); }
  };

  if (loading) return <Card className="p-6 animate-pulse h-32" />;

  const isPremium = sub?.tier === "premium";
  const isPaused = !!sub?.is_paused;
  const cancelled = !!sub?.cancelled_at;

  return (
    <Card className="p-5 space-y-4" data-testid="subscription-section">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-[hsl(var(--accent))]" />
        <h3 className="font-display text-lg">Abo &amp; Status</h3>
      </div>

      <div className="text-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[hsl(var(--muted-foreground))]">Tarif</span>
          <span className="font-medium capitalize" data-testid="sub-tier">
            {isPremium ? `Premium · ${formatCycle(sub.billing_cycle)}` : "Entdecken (Free)"}
          </span>
        </div>
        {isPremium && (
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Aktiv bis</span>
            <span className="font-mono text-xs" data-testid="sub-active-until">
              {fmt(sub.subscription_active_until)}
            </span>
          </div>
        )}
        {isPaused && (
          <div className="flex items-center justify-between text-[hsl(var(--accent))]">
            <span>⏸ Pausiert bis</span>
            <span className="font-mono text-xs">{fmt(sub.paused_until)}</span>
          </div>
        )}
        {cancelled && !isPaused && (
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] italic">
            Bereits gekündigt – Funktionen bleiben bis Periodenende aktiv.
          </div>
        )}
      </div>

      {isPremium && (
        <div className="flex flex-wrap gap-2 pt-1">
          {!isPaused ? (
            <div className="flex items-center gap-2">
              <Input
                type="number" min={1} max={90}
                value={pauseDays}
                onChange={(e) => setPauseDays(e.target.value)}
                className="w-20 h-8 text-sm"
                data-testid="sub-pause-days"
              />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Tage</span>
              <Button size="sm" variant="outline" onClick={pause} disabled={busy} data-testid="sub-pause-btn" className="gap-1.5">
                <Pause className="h-3.5 w-3.5" /> Pausieren
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={resume} disabled={busy} data-testid="sub-resume-btn" className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> Fortsetzen
            </Button>
          )}
          {!cancelled && (
            <Button size="sm" variant="ghost" onClick={cancel} disabled={busy} data-testid="sub-cancel-btn" className="gap-1.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10">
              <X className="h-3.5 w-3.5" /> Kündigen
            </Button>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-[hsl(var(--border))]">
        {!showRedeem ? (
          <button onClick={() => setShowRedeem(true)} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))] inline-flex items-center gap-1" data-testid="sub-show-redeem">
            <Gift className="h-3 w-3" /> Geschenk-Code einlösen
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Code eingeben"
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
              className="h-8 text-sm font-mono"
              data-testid="sub-gift-code"
            />
            <Button size="sm" onClick={redeemGift} disabled={busy || !giftCode.trim()} data-testid="sub-redeem-btn">Einlösen</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRedeem(false)}>×</Button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
        <Calendar className="h-3 w-3 inline -mt-0.5" /> Faire Garantien: Pausieren bis 90 Tage, Kündigung wirkt erst zum Periodenende, keine Vertrag­slücke. Sparks verfallen nicht.
      </p>
    </Card>
  );
}

function formatCycle(c) {
  switch (c) {
    case "monthly": return "Monatlich";
    case "biannual": return "Halbjährlich";
    case "annual": return "Jährlich";
    case "student": return "Studierende (Jahr)";
    case "duo": return "Duo";
    case "gift": return "Geschenk";
    default: return c || "–";
  }
}
function fmt(iso) {
  if (!iso) return "–";
  try { return new Date(iso).toLocaleDateString("de-DE"); } catch { return iso; }
}
