import { useEffect, useState } from "react";

const KEY = "eros_theme";

export function getInitialTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem(KEY, theme);
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme());
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return [theme, setTheme];
}
