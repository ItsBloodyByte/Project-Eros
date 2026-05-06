import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, TrendingDown, TrendingUp, ShoppingCart } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { useSparks } from "../lib/useSparks";
import { api } from "../lib/api";

/**
 * Public-facing ledger page (/sparks).
 *
 * Shows the current balance, the official earn/spend rate cards, and a
 * paginated transaction history that mirrors `db.sparks_ledger` exactly.
 * Per Kapitel 15.3 the ledger is the user's primary source of truth —
 * every credit/debit must be visible here, including admin adjustments.
 */
export default function SparksLedgerPage() {
  const { balance, rates_earn, rates_spend, packages, loading: balanceLoading, refresh } = useSparks();
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = async (before) => {
    setLoadingMore(true);
    try {
      const params = before ? `?before=${encodeURIComponent(before)}&limit=30` : "?limit=30";
      const { data } = await api.get(`/me/sparks/ledger${params}`);
      const newRows = data.rows || [];
      setRows((prev) => before ? [...prev, ...newRows] : newRows);
      setCursor(data.next_cursor);
      if (!data.next_cursor || newRows.length < 30) setHasMore(false);
    } finally { setLoadingMore(false); }
  };

  useEffect(() => { fetchPage(null); /* eslint-disable-next-line */ }, []);

  return (
    <div className="min-h-screen app-shell-bg">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Link to="/me" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="sparks-back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-2xl tracking-tight">Sparks-Kontoauszug</h1>
        </div>

        {/* Balance hero */}
        <Card className="p-6 bg-gradient-to-br from-[hsl(var(--ring))]/10 to-[hsl(var(--accent))]/5 border-[hsl(var(--ring))]/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">Aktueller Stand</div>
              {balanceLoading ? <Skeleton className="h-9 w-32" /> : (
                <div className="flex items-end gap-2" data-testid="sparks-balance-display">
                  <Sparkles className="h-7 w-7 text-[hsl(var(--ring))] mb-1" />
                  <span className="font-display text-4xl tracking-tight">{balance.toLocaleString("de-DE")}</span>
                  <span className="text-sm text-[hsl(var(--muted-foreground))] mb-1.5">Sparks</span>
                </div>
              )}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs hidden sm:block">
              Sparks verfallen nie. Du verdienst sie durch Aktivität oder kannst sie als Paket aufladen.
            </p>
          </div>
        </Card>

        {/* Earn vs spend rate tables */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Verdienen
            </div>
            <ul className="text-sm space-y-1.5">
              {EARN_LABELS.map(([key, label]) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">+{rates_earn[key] ?? "–"}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              <TrendingDown className="h-4 w-4 text-[hsl(var(--destructive))]" /> Ausgeben
            </div>
            <ul className="text-sm space-y-1.5">
              {SPEND_LABELS.map(([key, label]) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                  <span className="font-mono text-[hsl(var(--destructive))]">−{rates_spend[key] ?? "–"}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Top-up packages */}
        {packages?.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              <ShoppingCart className="h-4 w-4" /> Sparks aufladen
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {packages.map((p) => (
                <div key={p.id} data-testid={`sparks-pkg-${p.id}`} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-3 text-center">
                  <div className="font-display text-lg">{p.sparks.toLocaleString("de-DE")}</div>
                  {p.bonus > 0 && <div className="text-[11px] text-emerald-500">+{p.bonus} Bonus</div>}
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{(p.price_eur_cents / 100).toFixed(2).replace(".", ",")}&#8239;€</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-3">
              Pakete kannst du auf der <Link to="/premium" className="underline">Premium-Seite</Link> kaufen. Sparks verfallen nicht.
            </p>
          </Card>
        )}

        {/* Ledger */}
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] text-sm font-medium">Buchungen</div>
          {rows.length === 0 && !loadingMore ? (
            <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Noch keine Buchungen. Logge dich täglich ein, um Sparks zu sammeln.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3" data-testid={`ledger-row-${r.id}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {r.note || LABELS[r.transaction_type] || r.transaction_type}
                    </div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {new Date(r.created_at).toLocaleString("de-DE")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono text-sm ${r.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[hsl(var(--destructive))]"}`}>
                      {r.amount > 0 ? `+${r.amount}` : r.amount}
                    </div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono">{r.balance_after}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="p-3 border-t border-[hsl(var(--border))] flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => fetchPage(cursor)} disabled={loadingMore} data-testid="sparks-load-more">
                {loadingMore ? "Lädt…" : "Weitere laden"}
              </Button>
            </div>
          )}
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}

const EARN_LABELS = [
  ["daily_login", "Täglich einloggen"],
  ["profile_complete", "Profil vervollständigen"],
  ["verify_email", "E-Mail verifizieren"],
  ["verify_phone", "Telefon verifizieren"],
  ["first_match", "Erstes Match"],
  ["streak_7", "7-Tage-Streak"],
  ["streak_30", "30-Tage-Streak"],
  ["report_confirmed", "Bestätigter Report"],
  ["premium_monthly_bonus", "Premium-Monatsbonus"],
];

const SPEND_LABELS = [
  ["boost_1h", "Profil-Boost (1h)"],
  ["very_interested_signal", "„Sehr interessiert\u201c"],
  ["profile_rewind", "Profil zurückspulen"],
  ["extra_unlock_request", "Extra Album-Anfrage"],
  ["ai_chat_starter", "KI-Gesprächseinstieg"],
  ["profile_highlight_24h", "Profil-Highlight (24h)"],
  ["gift_premium_week", "Premium-Woche schenken"],
];

const LABELS = {
  daily_login: "Täglich einloggen",
  profile_complete: "Profil vervollständigt",
  verify_email: "E-Mail verifiziert",
  verify_phone: "Telefon verifiziert",
  first_match: "Erstes Match",
  streak_7: "7-Tage-Streak",
  streak_30: "30-Tage-Streak",
  report_confirmed: "Bestätigter Report",
  premium_monthly_bonus: "Premium-Monatsbonus",
  purchased: "Sparks gekauft",
  purchase_bonus: "Bonus-Sparks",
  admin_adjustment: "Admin-Anpassung",
  boost_1h: "Profil-Boost",
  very_interested_signal: "„Sehr interessiert\u201c-Signal",
  profile_rewind: "Profil zurückgespult",
  extra_unlock_request: "Extra Album-Anfrage",
  ai_chat_starter: "KI-Gesprächseinstieg",
  profile_highlight_24h: "Profil-Highlight",
  gift_premium_week: "Premium-Woche verschenkt",
};
