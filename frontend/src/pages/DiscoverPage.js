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
import { useTranslation } from "react-i18next";

export default function DiscoverPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);

  const load = useCallback(async (skipValue = 0) => {
    setLoading(true);
    try {
      const { data } = await api.get("/discover", { params: { limit: 20, skip: skipValue } });
      if (skipValue === 0) setResults(data.results);
      else setResults((prev) => [...prev, ...data.results]);
      setHasMore(data.has_more);
    } catch (e) {
      toast.error(e.response?.data?.detail || t("filters.save_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/me" data-testid="edit-profile-link">{t("nav.edit_profile")}</Link>
                </Button>
                <FilterDrawer prefs={user?.preferences || {}} onChange={() => {}} onApply={saveFilters} />
              </div>
            </div>
          </section>

          {/* Quick filter bar — sticky under header on desktop; static on mobile to avoid 2-row header overlap */}
          <div className="md:sticky md:top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 md:glass-surface mb-5">
            <QuickFilterBar
              prefs={user?.preferences || {}}
              onChange={(next) => saveFilters(next)}
            />
          </div>

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
