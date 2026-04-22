import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

const DEFAULT = { unread_messages: 0, unread_matches: 0, new_matches: 0 };

/**
 * Global polling hook for unread/notification counters used by
 * the AppHeader and MobileBottomNav. Polls every 30s while the
 * tab is visible and the user is logged in.
 */
export function useUnreadCounts(intervalMs = 30000) {
  const { user } = useAuth();
  const [counts, setCounts] = useState(DEFAULT);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCounts(DEFAULT);
      return;
    }
    try {
      const res = await api.get("/me/unread-summary");
      if (mountedRef.current) {
        setCounts({
          unread_messages: Number(res.data?.unread_messages || 0),
          unread_matches: Number(res.data?.unread_matches || 0),
          new_matches: Number(res.data?.new_matches || 0),
        });
      }
    } catch (e) {
      // silent fail – this is background info
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    timerRef.current = setInterval(tick, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs]);

  return { ...counts, refresh };
}
