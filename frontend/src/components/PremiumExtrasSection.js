import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Ticket, Sparkles, Eye, EyeOff, Heart, Crown, Lock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

/**
 * Consolidated Premium-benefits + Promo-redeem + Visitors + Stealth panel.
 * Renders read-only informative states for free users & interactive controls for premium users.
 */
export function PremiumExtrasSection() {
  const { user, refresh } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [quota, setQuota] = useState(null);
  const [visitors, setVisitors] = useState(null);
  const [stealth, setStealth] = useState(!!(user?.privacy?.stealth_mode));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [{ data: pc }, { data: q }] = await Promise.all([
        api.get("/platform-config"),
        api.get("/likes/quota"),
      ]);
      setCfg(pc);
      setQuota(q);
      try {
        const { data: v } = await api.get("/me/visitors");
        setVisitors(v);
      } catch {
        setVisitors(null);
      }
    } catch (e) { /* non-fatal */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => { setStealth(!!(user?.privacy?.stealth_mode)); }, [user?.privacy?.stealth_mode]);

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/promo/redeem", { code: code.trim().toUpperCase() });
      if (data.kind === "premium_days") {
        toast.success(`Code eingelöst: ${data.value} Tage Premium freigeschaltet 🎉`);
      } else if (data.kind === "boost_minutes") {
        toast.success(`Code eingelöst: ${data.value} Minuten Boost aktiv`);
      } else {
        toast.success("Code eingelöst");
      }
      setCode("");
      await refresh();
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Einlösung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const toggleStealth = async (v) => {
    if (!isPremium) {
      toast.error("Inkognito-Modus ist ein Premium-Feature");
      return;
    }
    try {
      const nextPrivacy = { ...(user.privacy || {}), stealth_mode: !!v };
      await api.patch("/me", { privacy: nextPrivacy });
      setStealth(!!v);
      await refresh();
      toast.success(v ? "Inkognito-Modus aktiv" : "Inkognito-Modus deaktiviert");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen");
    }
  };

  const isPremium = !!quota?.is_premium;
  const limit = quota?.daily_like_limit;
  const remaining = quota?.likes_remaining;
  const likesToday = quota?.likes_today || 0;
  const visitorsTotal = visitors?.total ?? 0;

  return (
    <section
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-5 shadow-[var(--shadow-sm)]"
      data-testid="premium-extras-section"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" /> Premium-Vorteile
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {isPremium
              ? "Alle Premium-Funktionen sind freigeschaltet."
              : "Schalte mehr Sichtbarkeit, Filter und Einsichten frei."}
          </div>
        </div>
        {isPremium ? (
          <Badge className="gap-1 bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40" data-testid="premium-active-badge">
            <Crown className="h-3 w-3" /> Premium aktiv
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Free-Tarif</Badge>
        )}
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Daily likes */}
        <div className="rounded-md border p-3" data-testid="feature-likes">
          <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" /> Likes heute
          </div>
          <div className="text-lg font-display mt-1">
            {isPremium ? "Unbegrenzt" : `${likesToday} / ${limit ?? "∞"}`}
          </div>
          {!isPremium && typeof remaining === "number" && (
            <div className="mt-1 h-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--accent))]"
                style={{ width: `${limit ? Math.min(100, (likesToday / limit) * 100) : 0}%` }}
              />
            </div>
          )}
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
            {isPremium ? "Keine Tageslimits mit Premium." : `Noch ${remaining ?? 0} heute übrig. Premium = unbegrenzt.`}
          </div>
        </div>

        {/* Super-like */}
        <div className="rounded-md border p-3" data-testid="feature-super-like">
          <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Super-Like
          </div>
          <div className="text-lg font-display mt-1">
            {isPremium
              ? `${quota?.super_likes_remaining ?? 0} / ${cfg?.super_like_daily_limit ?? 1} verfügbar`
              : "Premium erforderlich"}
          </div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
            {isPremium
              ? "Hebe dich in der Inbox der Empfänger:innen hervor."
              : "Dein Like rutscht an die Spitze der Empfänger-Inbox."}
          </div>
        </div>

        {/* Visitors */}
        <div className="rounded-md border p-3" data-testid="feature-visitors">
          <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> Profil-Besucher:innen
          </div>
          <div className="text-lg font-display mt-1">
            {visitorsTotal} {visitorsTotal === 1 ? "Besuch" : "Besuche"}
            <span className="ml-1 text-xs font-sans text-[hsl(var(--muted-foreground))]">
              (letzte {cfg?.visitors_window_days ?? 30} Tage)
            </span>
          </div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
            {isPremium ? "Scroll nach unten für die Liste." : "Premium zeigt dir, wer dein Profil besucht hat."}
          </div>
        </div>

        {/* Stealth */}
        <div className="rounded-md border p-3" data-testid="feature-stealth">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                <EyeOff className="h-3.5 w-3.5" /> Inkognito-Modus
              </div>
              <div className="text-lg font-display mt-1">
                {stealth ? "Aktiv" : "Aus"}
              </div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                Browse, ohne als „Besucher:in" oder „gesehen"-Markierung zu erscheinen.
              </div>
            </div>
            <Switch
              checked={stealth}
              onCheckedChange={toggleStealth}
              disabled={!isPremium}
              data-testid="stealth-toggle"
            />
          </div>
        </div>
      </div>

      {/* Promo redeem */}
      <div className="rounded-md border-2 border-dashed border-[hsl(var(--border))] p-4">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-[hsl(var(--accent))]" />
          <div className="font-display">Promo-Code einlösen</div>
        </div>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="z. B. WELCOME30"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="sm:max-w-xs font-mono tracking-wider"
            maxLength={40}
            data-testid="promo-redeem-input"
          />
          <Button onClick={redeem} disabled={busy || !code.trim()} data-testid="promo-redeem-btn" className="gap-1">
            <Ticket className="h-4 w-4" /> {busy ? "Einlösen…" : "Einlösen"}
          </Button>
        </div>
        <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2">
          Gültige Codes schalten Premium-Tage oder Boost-Minuten frei. Jeder Code kann je nach Kampagne nur einmal eingelöst werden.
        </div>
      </div>

      {/* Visitors list (premium only) */}
      {isPremium && visitors && visitors.visitors && visitors.visitors.length > 0 && (
        <div>
          <div className="font-display text-sm mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4 text-[hsl(var(--accent))]" /> Letzte Besucher:innen
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="visitors-grid">
            {visitors.visitors.slice(0, 12).map((v) => {
              const primary = (v.photos || []).find((p) => p.is_primary) || (v.photos || [])[0];
              return (
                <Link
                  to={`/profile/${v.id}`}
                  key={v.id}
                  className="group rounded-md overflow-hidden ring-1 ring-[hsl(var(--border))]/60 bg-[hsl(var(--card))] hover:shadow-[var(--shadow-md)] transition-shadow"
                  data-testid={`visitor-card-${v.id}`}
                >
                  <div className="aspect-[3/4] bg-[hsl(var(--muted))] relative">
                    {primary ? (
                      <img src={primary.data} alt={v.display_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-[hsl(var(--muted-foreground))]">Kein Foto</div>
                    )}
                    {v.visit_count > 1 && (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                        {v.visit_count}×
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-sm font-medium truncate">{v.display_name} <span className="text-[hsl(var(--muted-foreground))] text-xs font-normal">{v.age}</span></div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-1 truncate">
                      {v.city && <><MapPin className="h-3 w-3 shrink-0" /> {v.city}</>}
                      {v.visited_at && <span className="ml-auto">{new Date(v.visited_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default PremiumExtrasSection;
