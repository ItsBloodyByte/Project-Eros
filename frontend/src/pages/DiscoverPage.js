import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { FilterDrawer } from "../components/FilterDrawer";
import { QuickFilterBar } from "../components/QuickFilterBar";
import { ProfileCard } from "../components/ProfileCard";
import { AppFooter } from "../components/AppFooter";
import { AppHeader } from "../components/AppHeader";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function DiscoverPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);

  const isStaff = user && ["admin", "moderator", "superadmin", "content_reviewer", "support"].includes(user.role);
  const [adminMode, setAdminMode] = useState(false);
  const [adminQuery, setAdminQuery] = useState("");
  const [adminOpts, setAdminOpts] = useState({ include_hidden: true, include_banned: true });
  const [adminTotal, setAdminTotal] = useState(0);

  const load = useCallback(async (skipValue = 0) => {
    setLoading(true);
    try {
      const params = { limit: 20, skip: skipValue };
      if (adminMode && isStaff) {
        params.admin_mode = true;
        params.include_hidden = adminOpts.include_hidden;
        params.include_banned = adminOpts.include_banned;
        if (adminQuery.trim()) params.admin_q = adminQuery.trim();
      }
      const { data } = await api.get("/discover", { params });
      if (adminMode && data.admin_mode) {
        const batch = data.users || [];
        if (skipValue === 0) setResults(batch);
        else setResults((prev) => [...prev, ...batch]);
        setAdminTotal(data.total || 0);
        setHasMore(batch.length === 20);
      } else {
        if (skipValue === 0) setResults(data.results || []);
        else setResults((prev) => [...prev, ...(data.results || [])]);
        setHasMore(data.has_more);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || t("filters.save_failed"));
    } finally {
      setLoading(false);
    }
  }, [t, adminMode, isStaff, adminOpts.include_hidden, adminOpts.include_banned, adminQuery]);

  useEffect(() => { load(0); setSkip(0); }, [load]);

  const saveFilters = async (prefs) => {
    try {
      await api.patch("/me", { preferences: prefs });
      await refresh();
      load(0); setSkip(0);
      toast.success(t("filters.filters_applied"));
    } catch (e) {
      toast.error(t("filters.save_failed"));
    }
  };

  const onLoadMore = () => {
    const next = skip + 20;
    setSkip(next);
    load(next);
  };

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-16">
          {/* Editorial hero intro */}
          <section className="pt-8 sm:pt-12 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">
                  {t("discover.hello", { name: user?.display_name || "" })}
                </div>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] tracking-tight leading-[1.02]" data-testid="discover-heading">
                  {t("discover.title")}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-[hsl(var(--muted-foreground))] max-w-prose">
                  {t("discover.subtitle") || "Die Plattform für alle, die wissen, was sie wollen."}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isStaff && (
                  <Button
                    variant={adminMode ? "default" : "outline"}
                    size="sm"
                    className="rounded-full gap-1"
                    onClick={() => { setAdminMode((m) => !m); setSkip(0); }}
                    data-testid="discover-admin-toggle"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {adminMode ? "Admin-Ansicht aktiv" : "Admin-Ansicht"}
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/me" data-testid="edit-profile-link">{t("nav.edit_profile")}</Link>
                </Button>
                <FilterDrawer prefs={user?.preferences || {}} onChange={() => {}} onApply={saveFilters} />
              </div>
            </div>
            {isStaff && adminMode && (
              <div className="mt-4 rounded-[var(--radius-lg)] bg-[hsl(var(--accent))]/10 ring-1 ring-[hsl(var(--accent))]/30 p-3 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="admin-discover-bar">
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--foreground))]">
                  <Shield className="h-4 w-4 text-[hsl(var(--accent))]" />
                  <span className="font-medium">Admin-Moderationsansicht</span>
                  <span className="text-[hsl(var(--muted-foreground))]">· {adminTotal} Nutzer</span>
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={adminQuery}
                    onChange={(e) => setAdminQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && load(0)}
                    placeholder="Suche nach Name, E-Mail, Bio …"
                    className="flex-1 min-w-[200px] h-8 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/40"
                    data-testid="admin-discover-search"
                  />
                  <label className="flex items-center gap-1 text-xs cursor-pointer" title="Versteckte Profile einbeziehen">
                    <input type="checkbox" checked={adminOpts.include_hidden} onChange={(e) => setAdminOpts({ ...adminOpts, include_hidden: e.target.checked })} /> versteckt
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer" title="Gebannte Profile einbeziehen">
                    <input type="checkbox" checked={adminOpts.include_banned} onChange={(e) => setAdminOpts({ ...adminOpts, include_banned: e.target.checked })} /> gebannt
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* Quick filter bar — hidden in admin mode */}
          {!(isStaff && adminMode) && (
            <div className="md:sticky md:top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 md:glass-surface mb-5">
              <QuickFilterBar
                prefs={user?.preferences || {}}
                onChange={(next) => saveFilters(next)}
              />
            </div>
          )}

          {loading && results.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full rounded-[var(--radius-lg)]" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="grid place-items-center py-24 text-center">
              <div className="font-display text-3xl tracking-tight">{t("discover.no_results_title")}</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-md">{t("discover.no_results_desc")}</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5" data-testid="discover-grid">
                {results.map((u) => (
                  <ProfileCard
                    key={u.id}
                    user={u}
                    visited={(user?.seen_user_ids || []).includes(u.id)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <Button variant="outline" onClick={onLoadMore} data-testid="discover-load-more" className="rounded-full px-6">
                    {t("discover.load_more")}
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
