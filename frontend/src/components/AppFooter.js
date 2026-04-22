import { Link } from "react-router-dom";

/** Minimal, centered legal-links footer. */
export function AppFooter() {
  return (
    <footer className="mt-8 border-t text-xs text-[hsl(var(--muted-foreground))]" data-testid="app-footer">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span className="opacity-70">© {new Date().getFullYear()} Eros</span>
        <Link to="/legal/terms" className="hover:underline" data-testid="footer-terms">Nutzungsbedingungen</Link>
        <Link to="/legal/privacy" className="hover:underline" data-testid="footer-privacy">Datenschutz</Link>
        <Link to="/legal/imprint" className="hover:underline" data-testid="footer-imprint">Impressum</Link>
        <Link to="/legal/community" className="hover:underline" data-testid="footer-community">Community</Link>
        <Link to="/legal/cookies" className="hover:underline" data-testid="footer-cookies">Cookies</Link>
        <Link to="/legal/cancellation" className="hover:underline" data-testid="footer-cancellation">Widerruf</Link>
      </div>
    </footer>
  );
}
