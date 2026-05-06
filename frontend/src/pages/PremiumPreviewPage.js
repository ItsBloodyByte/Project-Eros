import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import {
  Check, Crown, Eye, Ghost, Heart, MessageSquareText, Rocket, Shield,
  Sliders, Sparkles, Users, Video, Zap, X,
} from "lucide-react";

/**
 * Per-cycle price tiles (Phase 15.3 — Kapitel 15.2 prices).
 *
 * The numbers are rendered as plain JSX rather than fetched from
 * `/api/payments/packages` because they need to be readable for guests
 * (who may not be authenticated) and for SEO crawlers. The /account
 * page is the source of truth for actual purchase — that's where Stripe
 * runs and where the per-package idempotency keys are issued.
 */
function PricingSection({ isPremium }) {
  const cycles = [
    { id: "monthly",  label: "Monatlich",     monthly: "9,99\u202f\u20ac",  total: "9,99\u202f\u20ac / Monat",       savings: null,        popular: false },
    { id: "biannual", label: "Halbj\u00e4hrlich",  monthly: "7,99\u202f\u20ac", total: "47,94\u202f\u20ac / 6\u202fMonate",   savings: "\u201320\u202f%",  popular: true },
    { id: "annual",   label: "J\u00e4hrlich",      monthly: "5,99\u202f\u20ac", total: "71,88\u202f\u20ac / Jahr",         savings: "\u201340\u202f%",  popular: false },
    { id: "student",  label: "Studierende",  monthly: "3,99\u202f\u20ac", total: "47,88\u202f\u20ac / Jahr",         savings: "\u201360\u202f%",  popular: false },
  ];
  return (
    <section className="space-y-4" data-testid="premium-pricing">
      <h2 className="font-display text-2xl tracking-tight text-center">Preise</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] text-center max-w-xl mx-auto">
        Kündige jederzeit, pausiere bis 90 Tage, oder verschenke das Abo. Sparks verfallen nie.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cycles.map((c) => (
          <div
            key={c.id}
            data-testid={`pricing-${c.id}`}
            className={`relative rounded-[var(--radius-lg)] p-5 ring-1 flex flex-col ${
              c.popular
                ? "bg-[hsl(var(--accent))]/10 ring-[hsl(var(--accent))]/40 shadow-[var(--shadow-md)]"
                : "bg-[hsl(var(--card))] ring-[hsl(var(--border))]/60"
            }`}
          >
            {c.popular && (
              <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-wider bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] rounded-full px-2 py-0.5 font-medium">
                Beliebt
              </span>
            )}
            <div className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{c.label}</div>
            <div className="font-display text-3xl tracking-tight mt-1">{c.monthly}<span className="text-base text-[hsl(var(--muted-foreground))] font-sans">/Mon.</span></div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{c.total}</div>
            {c.savings && (
              <div className="text-xs font-medium text-emerald-500 mt-1">{c.savings} günstiger</div>
            )}
            {c.id === "student" && (
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 italic">
                Verifizierung erforderlich
              </div>
            )}
            <div className="mt-auto pt-3" />
          </div>
        ))}
      </div>
      {!isPremium && (
        <p className="text-center text-xs text-[hsl(var(--muted-foreground))] pt-1">
          Auswahl &amp; Bezahlung im{" "}
          <Link to="/account" className="underline hover:text-[hsl(var(--foreground))]">Account-Bereich</Link>.
        </p>
      )}
    </section>
  );
}

/**
 * Honest comparison table — what's actually different between Free and
 * Premium. We deliberately *don't* gate filters or basic discovery, so
 * the row count is small. Lying here would erode trust faster than any
 * paywall could ever earn back.
 */
function ComparisonSection() {
  const ROWS = [
    { label: "Profile durchsuchen, liken, matchen",       free: true,         premium: true },
    { label: "Alle Filter (Position, Kinks, Sprache, \u2026)", free: true,         premium: true },
    { label: "Fotos pro Profil",                            free: "8",           premium: "30" },
    { label: "Alben pro Profil",                            free: "2",           premium: "15" },
    { label: "Medien pro Album",                            free: "20",          premium: "100" },
    { label: "Suchradius",                                  free: "50\u202fkm",  premium: "300\u202fkm + global" },
    { label: "Wer hat mich geliked? \u2014 volle Profile",   free: false,        premium: true },
    { label: "Profil-Besucher mit Zeitstempel",             free: false,        premium: true },
    { label: "Inkognito-Modus",                             free: false,        premium: true },
    { label: "Unsichtbar browsen",                          free: false,        premium: true },
    { label: "Statistiken (Reichweite)",                    free: "7 Tage",     premium: "90 Tage" },
    { label: "Boost (1 Stunde)",                             free: "via Sparks", premium: "3\u00d7/Monat inkl." },
    { label: "Sparks-Monatsbonus",                          free: false,        premium: "+50/Monat" },
  ];
  const Cell = ({ v }) => {
    if (v === true)  return <Check className="h-4 w-4 text-emerald-500 mx-auto" />;
    if (v === false) return <X className="h-4 w-4 text-[hsl(var(--muted-foreground))] mx-auto opacity-50" />;
    return <span className="text-sm font-mono">{v}</span>;
  };
  return (
    <section className="space-y-4" data-testid="premium-comparison">
      <h2 className="font-display text-2xl tracking-tight text-center">Free vs. Premium — ehrlich</h2>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] ring-1 ring-[hsl(var(--border))]/60 bg-[hsl(var(--card))]">
        <table className="w-full text-sm">
          <thead className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-4 py-3">Funktion</th>
              <th className="text-center font-medium px-4 py-3 w-32">Free „Entdecken“</th>
              <th className="text-center font-medium px-4 py-3 w-32 bg-[hsl(var(--accent))]/5">Premium „Verbinden“</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]/60">
            {ROWS.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-center"><Cell v={r.free} /></td>
                <td className="px-4 py-2.5 text-center bg-[hsl(var(--accent))]/5"><Cell v={r.premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ICONS = {
  heart: Heart,
  eye: Eye,
  ghost: Ghost,
  users: Users,
  video: Video,
  zap: Zap,
  sliders: Sliders,
  shield: Shield,
  "message-check": MessageSquareText,
  rocket: Rocket,
};

function FeatureCard({ feature }) {
  const Icon = ICONS[feature.icon] || Sparkles;
  return (
    <div
      data-testid={`premium-feature-${feature.id}`}
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-3 shadow-[var(--shadow-sm)] h-full flex flex-col"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary))]/20">
        <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />
      </div>
      <div className="space-y-1 flex-1">
        <h3 className="font-display text-base leading-tight">{feature.title}</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{feature.description}</p>
      </div>
      {feature.limits && (
        <div className="text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))]/60 pt-2 flex flex-wrap gap-2">
          {feature.limits.max_videos && (
            <Badge variant="secondary">max. {feature.limits.max_videos}</Badge>
          )}
          {feature.limits.max_duration_seconds && (
            <Badge variant="secondary">bis {feature.limits.max_duration_seconds}s</Badge>
          )}
          {feature.limits.max_resolution && (
            <Badge variant="secondary">{feature.limits.max_resolution}</Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default function PremiumPreviewPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/premium/features");
        setData(data);
      } catch {
        // Non-fatal: render static fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const features = data?.features || [];
  const isPremium = !!user?.premium_until && new Date(user.premium_until) > new Date();

  const ctaPrimary = () => {
    if (!user) return nav("/register");
    if (isPremium) return nav("/account");
    return nav("/account#premium");
  };

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-var(--header-h,56px))] bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-6xl px-4 py-12 space-y-10" data-testid="premium-preview-page">
          {/* Hero */}
          <section className="text-center space-y-4">
            <div className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/30 px-3 py-1 text-xs font-medium">
              <Crown className="h-3.5 w-3.5" /> Eros Premium
            </div>
            <h1 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight">
              Alle Funktionen. Mehr Matches.<br className="hidden md:block" /> Mehr Freiheit.
            </h1>
            <p className="text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto text-base md:text-lg">
              Entdecke, was dich mit Premium erwartet – und entscheide erst dann, ob du
              upgraden möchtest. Keine versteckten Kosten, jederzeit kündbar.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <Button size="lg" onClick={ctaPrimary} data-testid="premium-cta-primary">
                {!user ? "Jetzt kostenlos registrieren" : isPremium ? "Mein Abo verwalten" : "Premium werden"}
              </Button>
              {!user && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => nav("/login")}
                  data-testid="premium-cta-login"
                >
                  Anmelden
                </Button>
              )}
            </div>
            {isPremium && (
              <div className="inline-flex items-center gap-1 text-sm text-[hsl(var(--accent-foreground))] bg-[hsl(var(--accent))]/10 ring-1 ring-[hsl(var(--accent))]/30 px-3 py-1 rounded-full">
                <Check className="h-3.5 w-3.5" /> Du bist bereits Premium-Mitglied
              </div>
            )}
          </section>

          {/* Feature grid */}
          <section className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-2">
              <h2 className="font-display text-2xl tracking-tight">Was ist enthalten?</h2>
              <Link
                to="/blog"
                className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline-offset-4 hover:underline"
              >
                Mehr über Eros im Blog →
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {features.map((f) => (
                  <FeatureCard key={f.id} feature={f} />
                ))}
              </div>
            )}
          </section>

          {/* Video spotlight (since it's the focus of this release) */}
          {data?.video_limits && (
            <section
              className="rounded-[var(--radius-lg)] bg-[hsl(var(--primary))]/5 ring-1 ring-[hsl(var(--primary))]/20 p-6 md:p-8 grid md:grid-cols-[auto_1fr] gap-5 items-center"
              data-testid="premium-video-spotlight"
            >
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 ring-1 ring-[hsl(var(--primary))]/30">
                <Video className="h-7 w-7 text-[hsl(var(--primary))]" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-xl">Zeig dich in Bewegung</h3>
                <p className="text-[hsl(var(--muted-foreground))] text-sm">
                  Premium-Mitglieder dürfen bis zu{" "}
                  <strong>{data.video_limits.max_videos} Kurzvideos</strong> (je max.{" "}
                  <strong>{data.video_limits.max_duration_seconds} Sekunden</strong>, bis{" "}
                  <strong>{data.video_limits.max_resolution}</strong>, maximal{" "}
                  {data.video_limits.max_file_size_mb} MB) hochladen. Alle Uploads werden vor
                  der Veröffentlichung manuell geprüft.
                </p>
              </div>
            </section>
          )}

          {/* Pricing tiers (Phase 15.3) */}
          <PricingSection isPremium={isPremium} />

          {/* Free vs Premium comparison */}
          <ComparisonSection />

          {/* Transparency callout */}
          <section className="rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
            <Shield className="h-7 w-7 text-[hsl(var(--accent))] shrink-0" />
            <div className="flex-1">
              <h3 className="font-display text-lg">Transparent verdient. Fair berechnet.</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Wir veröffentlichen unsere Galerie-Gewichtungen, Sparks-Mathematik und Anti-Dark-Pattern Garantien öffentlich.
              </p>
            </div>
            <Link
              to="/transparent"
              className="text-sm font-medium text-[hsl(var(--accent))] hover:underline shrink-0"
              data-testid="premium-transparent-link"
            >
              Mehr erfahren →
            </Link>
          </section>

          {/* Closing CTA */}
          <section className="text-center space-y-3 pt-4 pb-8">
            <h2 className="font-display text-2xl">Bereit für mehr?</h2>
            <p className="text-[hsl(var(--muted-foreground))] max-w-xl mx-auto text-sm">
              Probiere Eros erst komplett kostenlos aus. Premium ist da, wenn du bereit
              bist – kein Zwang.
            </p>
            <Button size="lg" onClick={ctaPrimary} data-testid="premium-cta-footer">
              {!user ? "Account erstellen" : isPremium ? "Mein Abo verwalten" : "Premium freischalten"}
            </Button>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
