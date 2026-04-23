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
  Sliders, Sparkles, Users, Video, Zap,
} from "lucide-react";

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
