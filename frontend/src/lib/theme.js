import { useEffect, useState, useCallback } from "react";

const KEY = "eros_theme";

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  } catch { /* noop */ }
  return "dark";
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try { localStorage.setItem(KEY, theme); } catch {}
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme());

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Listen to system preference changes ONLY if user hasn't explicitly set a choice.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") return;
      setTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return [theme, setTheme, toggle];
}
