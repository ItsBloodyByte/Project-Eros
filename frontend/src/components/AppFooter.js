import { Link } from "react-router-dom";

/** Minimal, centered legal-links footer — subtle and editorial. */
export function AppFooter() {
  const year = new Date().getFullYear();
  const links = [
    { to: "/premium",            label: "Premium",             tid: "footer-premium" },
    { to: "/blog",               label: "Blog",                tid: "footer-blog" },
    { to: "/legal/terms",        label: "Nutzungsbedingungen", tid: "footer-terms" },
    { to: "/legal/privacy",      label: "Datenschutz",         tid: "footer-privacy" },
    { to: "/legal/imprint",      label: "Impressum",           tid: "footer-imprint" },
    { to: "/legal/community",    label: "Community",           tid: "footer-community" },
    { to: "/legal/cookies",      label: "Cookies",             tid: "footer-cookies" },
    { to: "/legal/cancellation", label: "Widerruf",            tid: "footer-cancellation" },
  ];
  return (
    <footer className="mt-auto border-t border-[hsl(var(--border))]/70" data-testid="app-footer">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="font-display text-lg tracking-tight">Eros</div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">© {year}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            {links.map((l) => (
              <Link
                key={l.tid}
                to={l.to}
                data-testid={l.tid}
                className="hover:text-[hsl(var(--foreground))] transition-colors duration-[var(--dur-2)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
