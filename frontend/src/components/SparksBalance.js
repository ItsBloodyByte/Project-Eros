import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useSparks } from "../lib/useSparks";

/**
 * SparksBalance — compact pill that renders the current Sparks balance in
 * the header. Clicking it deep-links into the ledger page.
 *
 * Hidden when the visitor isn't logged in (e.g. on the public transparency
 * or premium pages) so we never trigger the 401 interceptor for guests.
 * Hidden on small viewports to keep the mobile header lean — there's a
 * dedicated balance card on the Account page for phones.
 */
export function SparksBalance({ testid = "header-sparks-balance" }) {
  const { user } = useAuth();
  const { balance, loading } = useSparks();
  if (!user || loading) return null;
  return (
    <Link
      to="/sparks"
      data-testid={testid}
      title="Sparks – tippe für Kontoauszug"
      className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[hsl(var(--ring))]/40 bg-[hsl(var(--ring))]/10 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--ring))] hover:bg-[hsl(var(--ring))]/20 transition-colors"
    >
      <Sparkles className="h-3 w-3" />
      {balance.toLocaleString("de-DE")}
    </Link>
  );
}
