import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Crown, Eye, Users, Lock, Sparkles, UserRound } from "lucide-react";

function timeAgo(iso) {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    const delta = Math.max(0, Date.now() - then);
    const sec = Math.floor(delta / 1000);
    if (sec < 60) return "gerade eben";
    const min = Math.floor(sec / 60);
    if (min < 60) return `vor ${min} Min.`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `vor ${hr} Std.`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `vor ${d} T.`;
    return new Date(iso).toLocaleDateString("de-DE");
  } catch {
    return "";
  }
}

function VisitorCard({ v }) {
  const firstPhoto = Array.isArray(v.photos) && v.photos.length > 0
    ? (v.photos[0].data || v.photos[0].url || null)
    : null;
  return (
    <Link
      to={`/profile/${v.id}`}
      className="group relative block rounded-2xl overflow-hidden bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] transition-transform duration-[var(--dur-1)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
      data-testid={`visitor-card-${v.id}`}
    >
      <div className="aspect-[3/4] w-full bg-[hsl(var(--secondary))] overflow-hidden">
        {firstPhoto ? (
          <img
            src={firstPhoto}
            alt={v.display_name || "Profil"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            <UserRound className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate" data-testid={`visitor-name-${v.id}`}>
            {v.display_name || "—"}
            {typeof v.age === "number" && v.age > 0 && (
              <span className="text-[hsl(var(--muted-foreground))] ml-1">{v.age}</span>
            )}
          </span>
          {v.is_premium && (
            <Crown className="h-3.5 w-3.5 text-[hsl(var(--accent))] shrink-0" />
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
          <span>{timeAgo(v.visited_at)}</span>
          {v.visit_count > 1 && (
            <span className="inline-flex items-center gap-0.5" data-testid={`visitor-count-${v.id}`}>
              <Eye className="h-3 w-3" /> {v.visit_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function BlurredVisitorCard({ v, idx }) {
  return (
    <div
      className="group relative block rounded-2xl overflow-hidden bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] select-none"
      aria-label="Verborgener View — Premium erforderlich"
      data-testid={`visitor-blurred-${idx}`}
    >
      <div className="aspect-[3/4] w-full bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--muted))] relative overflow-hidden">
        {/* Silhouette */}
        <div className="absolute inset-0 flex items-center justify-center">
          <UserRound
            className="h-24 w-24 text-[hsl(var(--muted-foreground))]/40"
            strokeWidth={1.25}
            style={{ filter: "blur(2px)" }}
          />
        </div>
        {/* Noise / blur overlay */}
        <div
          className="absolute inset-0 backdrop-blur-sm bg-[hsl(var(--background))]/10"
          aria-hidden
        />
        {/* Lock badge */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--background))]/80 backdrop-blur px-3 py-1 text-xs font-medium text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--border))]">
            <Lock className="h-3.5 w-3.5" /> Premium
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="h-3.5 w-2/3 rounded bg-[hsl(var(--muted))]" aria-hidden />
        <div className="mt-2 flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
          <span>{timeAgo(v.visited_at)}</span>
          {v.visit_count > 1 && (
            <span className="inline-flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> {v.visit_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VisitorsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/me/visitors");
        if (active) setData(res.data);
      } catch (e) {
        if (active) setErr(e?.response?.data?.detail || "Fehler beim Laden");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const isPremium = !!(data?.is_premium ?? user?.is_premium);
  const visible = data?.visitors || [];
  const blurred = data?.blurred_visitors || [];
  const total = data?.total || 0;
  const freeVisible = data?.free_visible ?? 3;

  const windowLabel = useMemo(() => {
    if (isPremium) {
      const d = data?.window_days ?? 30;
      return `letzte ${d} Tage`;
    }
    const h = data?.window_hours_free ?? 24;
    return `letzte ${h} Std.`;
  }, [isPremium, data]);

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg min-h-screen">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <div className="uppercase tracking-widest text-[11px] text-[hsl(var(--muted-foreground))] mb-1">
                Views
              </div>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]" data-testid="visitors-title">
                Wer hat dich angesehen?
              </h1>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] max-w-xl">
                {isPremium
                  ? "Alle Profile, die dein Profil angesehen haben."
                  : `Du siehst die letzten ${freeVisible} Views. Weitere Views der ${data?.window_hours_free ?? 24} h werden verschleiert – schalte Premium frei, um alle zu sehen.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--foreground))]"
                data-testid="visitors-window-label"
              >
                <Users className="h-3.5 w-3.5" /> {windowLabel}
              </span>
              {typeof total === "number" && total > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/30 px-3 py-1 text-xs"
                  data-testid="visitors-total-label"
                >
                  <Eye className="h-3.5 w-3.5" /> {total} {total === 1 ? "View" : "Views"}
                </span>
              )}
            </div>
          </div>

          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-testid="visitors-loading">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden ring-1 ring-[hsl(var(--border))]">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && err && (
            <div className="rounded-2xl border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--destructive))]" data-testid="visitors-error">
              {err}
            </div>
          )}

          {!loading && !err && visible.length === 0 && blurred.length === 0 && (
            <div
              className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-10 text-center"
              data-testid="visitors-empty"
            >
              <UserRound className="h-10 w-10 mx-auto text-[hsl(var(--muted-foreground))]" />
              <div className="mt-3 font-medium">Noch keine Views</div>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Sobald jemand dein Profil ansieht, erscheint er oder sie hier.
              </p>
              <div className="mt-4">
                <Link to="/">
                  <Button variant="outline" className="rounded-full" data-testid="visitors-empty-cta">
                    Jetzt entdecken
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {!loading && !err && (visible.length > 0 || blurred.length > 0) && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-testid="visitors-grid">
                {visible.map((v) => (
                  <VisitorCard key={v.id} v={v} />
                ))}
                {blurred.map((b, idx) => (
                  <BlurredVisitorCard key={`b-${idx}`} v={b} idx={idx} />
                ))}
              </div>

              {!isPremium && blurred.length > 0 && (
                <div
                  className="mt-8 rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[hsl(var(--accent))]/15 to-[hsl(var(--accent))]/5 ring-1 ring-[hsl(var(--accent))]/30"
                  data-testid="visitors-premium-cta"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-[hsl(var(--accent))] mt-0.5" />
                      <div>
                        <div className="font-semibold">
                          {blurred.length} {blurred.length === 1 ? "weiterer View" : "weitere Views"} verschleiert
                        </div>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                          Mit Premium siehst du jede Person, die dein Profil angesehen hat – und das für bis zu {data?.window_days ?? 30} Tage rückwirkend.
                        </p>
                      </div>
                    </div>
                    <Link to="/account">
                      <Button className="rounded-full gap-1.5 whitespace-nowrap" data-testid="visitors-upgrade-btn">
                        <Crown className="h-4 w-4" /> Premium freischalten
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
