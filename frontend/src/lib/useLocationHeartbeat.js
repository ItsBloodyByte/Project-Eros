import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

/**
 * useLocationHeartbeat – pingt alle `intervalMs` den aktuellen GPS-Standort
 * (navigator.geolocation) und überträgt ihn an /api/me/location. Läuft nur:
 *   • wenn der User eingeloggt ist,
 *   • wenn der Tab sichtbar ist (document.visibilityState === "visible"),
 *   • wenn der User nicht explizit stealth_mode aktiv hat (Privacy-Schutz).
 *
 * Default-Intervall: 15 min. Der erste Heartbeat wird ~20s nach Mount gesendet.
 *
 * Die Permission-Entscheidung wird nicht erzwungen; ein einmaliger Fehler führt
 * nur zu einem Konsolenlog und wird stillschweigend ignoriert.
 */
export function useLocationHeartbeat({ intervalMs = 15 * 60 * 1000, firstDelayMs = 20 * 1000 } = {}) {
  const { user } = useAuth();
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!user) return undefined;
    if (user?.privacy?.stealth_mode) return undefined;
    if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;

    let cancelled = false;

    const readPosition = () =>
      new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
            accuracy: pos.coords.accuracy,
          }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60 * 1000 }
        );
      });

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const pos = await readPosition();
        if (!pos || cancelled) return;
        await api.post("/me/location", {
          coordinates: [pos.lng, pos.lat],
          accuracy_m: pos.accuracy || null,
        });
      } catch (e) {
        // Silent fail – heartbeat is best-effort
        if (process.env.NODE_ENV !== "production") {
          console.debug("[location-heartbeat] skipped:", e?.message || e);
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    const firstT = setTimeout(tick, firstDelayMs);
    timerRef.current = setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(firstT);
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, user?.privacy?.stealth_mode, intervalMs, firstDelayMs]);
}
