import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

/**
 * useSparks — light-weight hook around `/api/me/sparks`.
 *
 * Returns the current balance plus the canonical earn/spend tables and
 * Stripe top-up packages so any UI that needs them can reuse the same
 * payload (avoids divergence between header pill, ledger page, premium
 * page, etc.).
 *
 * `refresh()` is exposed so spend buttons can re-pull the balance after
 * a successful spend without forcing a full page reload.
 *
 * Skips entirely when the user isn't logged in — the endpoint requires
 * auth and we don't want it to trigger the 401 interceptor on public
 * pages (e.g. /transparent or /premium for guests).
 */
export function useSparks() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) { setData(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/me/sparks");
      setData(data);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.detail || "Sparks konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    balance: data?.balance ?? 0,
    rates_earn: data?.rates_earn || {},
    rates_spend: data?.rates_spend || {},
    packages: data?.packages || [],
    loading,
    error,
    refresh,
  };
}
