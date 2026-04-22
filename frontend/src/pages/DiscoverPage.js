import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { FilterDrawer } from "../components/FilterDrawer";
import { ProfileCard } from "../components/ProfileCard";
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
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="flex items-center justify-between py-5 gap-2">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl">{t("discover.title")}</h1>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">{t("discover.hello", { name: user?.display_name || "" })}</div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/me" className="text-sm underline text-[hsl(var(--muted-foreground))]" data-testid="edit-profile-link">{t("nav.edit_profile")}</Link>
              <FilterDrawer prefs={user?.preferences || {}} onChange={() => {}} onApply={saveFilters} />
            </div>
          </div>

          {loading && results.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="grid place-items-center py-20 text-center">
              <div className="font-display text-2xl">{t("discover.no_results_title")}</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-md">{t("discover.no_results_desc")}</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="discover-grid">
                {results.map((u) => <ProfileCard key={u.id} user={u} />)}
              </div>
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={onLoadMore} data-testid="discover-load-more">{t("discover.load_more")}</Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
