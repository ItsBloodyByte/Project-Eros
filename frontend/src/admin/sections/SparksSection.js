import React, { useEffect, useMemo, useState } from "react";
import {
  Sparkles, RefreshCw, Search, ArrowUpRight, ArrowDownRight,
  Plus, Minus, ExternalLink, History, TrendingUp, TrendingDown, Coins,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import { Skeleton } from "../../components/ui/skeleton";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminKpiCard } from "../components/AdminKpiCard";
import { AdminEmptyState } from "../components/AdminEmptyState";
import { AdminStatusPill } from "../components/AdminStatusPill";

/**
 * SparksSection — Admin tab for the virtual currency.
 *
 * Reads
 *   - GET /api/admin/sparks/stats         → economy KPIs
 *   - GET /api/admin/sparks/recent        → cross-user ledger feed
 *   - GET /api/admin/sparks/{user_id}     → per-user inspect
 *
 * Writes
 *   - POST /api/admin/sparks/{user_id}/adjust → manual credit/debit (audited)
 *
 * The page is laid out as:
 *   1. Page header (title, refresh, last-updated)
 *   2. KPI grid: minted / burned / active / users with balance / 24h tx / 7d tx
 *   3. Two-column body:
 *      - Left: Top earn types + Top spend types (mini bars)
 *      - Right: User lookup card → balance, ledger, adjust dialog
 *   4. Recent ledger feed (cross-user, newest-first)
 */
const TX_LABELS = {
  daily_login: "Daily Login",
  profile_complete: "Profil komplett",
  verify_email: "E-Mail verifiziert",
  verify_phone: "Telefon verifiziert",
  first_match: "Erstes Match",
  streak_bonus: "Streak Bonus",
  confirmed_report: "Report bestätigt",
  profile_quiz: "Profil-Quiz",
  premium_monthly_bonus: "Premium-Monatsbonus",
  purchased: "Sparks-Kauf",
  purchase_bonus: "Bonus-Sparks",
  refund: "Refund",
  admin_adjustment: "Manuelle Anpassung",
  // Spending
  boost_1h: "Boost 1h",
  very_interested_signal: "Sehr interessiert",
  rewind: "Rewind",
  extra_unlock_request: "Extra Album-Unlock",
  ai_chat_starter: "AI Chat-Starter",
  profile_highlight_24h: "Profil-Highlight 24h",
  gift_premium_week: "Premium-Woche schenken",
};

function txLabel(t) { return TX_LABELS[t] || t; }

function fmt(n) {
  if (n == null) return "–";
  return Number(n).toLocaleString("de-DE");
}

function formatDate(iso) {
  if (!iso) return "–";
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso.slice(0, 16).replace("T", " "); }
}

export default function SparksSection() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [filterTx, setFilterTx] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  // Lookup state
  const [lookupQ, setLookupQ] = useState("");
  const [lookupResults, setLookupResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState(null); // { id, email, display_name, balance, ledger }
  const [targetLoading, setTargetLoading] = useState(false);

  // Adjust dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustSign, setAdjustSign] = useState("+");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const lastUpdated = stats?.as_of ? formatDate(stats.as_of) : null;

  async function loadAll(silent = false) {
    if (!silent) setLoading(true); else setReloading(true);
    try {
      const [s, r] = await Promise.all([
        api.get("/admin/sparks/stats"),
        api.get(`/admin/sparks/recent`, { params: { limit: 60, transaction_type: filterTx || undefined } }),
      ]);
      setStats(s.data);
      setRecent(r.data.rows || []);
    } catch (e) {
      toast.error("Konnte Sparks-Daten nicht laden", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-line */ }, []);
  useEffect(() => {
    // Reload feed when filter changes (after first mount)
    if (loading) return;
    (async () => {
      try {
        const r = await api.get(`/admin/sparks/recent`, { params: { limit: 60, transaction_type: filterTx || undefined } });
        setRecent(r.data.rows || []);
      } catch { /* ignore */ }
    })();
    /* eslint-disable-next-line */
  }, [filterTx]);

  async function searchUser() {
    const q = lookupQ.trim();
    if (!q) { setLookupResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/admin/users`, { params: { q } });
      setLookupResults((data.users || []).slice(0, 8));
    } catch (e) {
      toast.error("Suche fehlgeschlagen");
    } finally {
      setSearching(false);
    }
  }

  async function loadTarget(userId) {
    setTargetLoading(true);
    try {
      const { data } = await api.get(`/admin/sparks/${userId}`);
      setTarget({ ...data.user, balance: data.balance, ledger: data.ledger || [] });
    } catch (e) {
      toast.error("Konnte User-Sparks nicht laden");
    } finally {
      setTargetLoading(false);
    }
  }

  async function submitAdjust() {
    if (!target) return;
    const amt = parseInt(adjustAmount, 10);
    if (!amt || amt <= 0) {
      toast.error("Bitte einen positiven Betrag eingeben");
      return;
    }
    const signed = adjustSign === "+" ? amt : -amt;
    setAdjustSaving(true);
    try {
      const { data } = await api.post(`/admin/sparks/${target.id}/adjust`, {
        amount: signed,
        note: adjustNote.trim() || undefined,
      });
      toast.success("Anpassung verbucht", {
        description: `Neuer Saldo: ${fmt(data?.row?.balance_after ?? "–")} Sparks`,
      });
      setAdjustOpen(false);
      setAdjustAmount("");
      setAdjustNote("");
      await loadTarget(target.id);
      await loadAll(true);
    } catch (e) {
      toast.error("Anpassung fehlgeschlagen", { description: e?.response?.data?.detail || e.message });
    } finally {
      setAdjustSaving(false);
    }
  }

  const txTypes = useMemo(() => {
    const set = new Set();
    (stats?.top_earn || []).forEach(r => set.add(r.transaction_type));
    (stats?.top_spend || []).forEach(r => set.add(r.transaction_type));
    return Array.from(set).sort();
  }, [stats]);

  return (
    <div data-testid="admin-sparks-section" className="space-y-5">
      <AdminPageHeader
        title="Sparks-Ökonomie"
        subtitle="Live-Bilanz der virtuellen Währung – Inflow, Outflow, Salden, manuelle Anpassungen"
        lastUpdated={lastUpdated}
        actions={
          <Button
            onClick={() => loadAll(true)}
            variant="outline"
            size="sm"
            data-testid="sparks-refresh"
            disabled={reloading || loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${reloading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        }
      />

      {/* KPI grid */}
      <section aria-label="Wirtschafts-Kennzahlen">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <AdminKpiCard
            label="Aktiver Bestand" icon={Coins} tone="accent"
            loading={loading} value={stats?.active_balance}
            hint="Sparks im Umlauf"
            testid="sparks-kpi-active"
          />
          <AdminKpiCard
            label="Gesamt Inflow" icon={ArrowUpRight}
            loading={loading} value={stats?.total_minted}
            hint="seit Launch"
            testid="sparks-kpi-minted"
          />
          <AdminKpiCard
            label="Gesamt Outflow" icon={ArrowDownRight}
            loading={loading} value={stats?.total_burned}
            hint="ausgegeben"
            testid="sparks-kpi-burned"
          />
          <AdminKpiCard
            label="User mit Balance" icon={Sparkles}
            loading={loading} value={stats?.users_with_balance}
            testid="sparks-kpi-users"
          />
          <AdminKpiCard
            label="Transaktionen 24h" icon={TrendingUp}
            loading={loading} value={stats?.tx_24h}
            testid="sparks-kpi-tx-24h"
          />
          <AdminKpiCard
            label="Transaktionen 7T" icon={History}
            loading={loading} value={stats?.tx_7d}
            testid="sparks-kpi-tx-7d"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: top earn / top spend */}
        <section className="lg:col-span-2 space-y-4">
          <DistributionCard
            title="Top Inflow-Typen"
            icon={TrendingUp}
            rows={stats?.top_earn || []}
            tone="emerald"
            loading={loading}
            empty="Noch keine Einnahmen verbucht."
            onSelect={(t) => setFilterTx(t)}
          />
          <DistributionCard
            title="Top Ausgabe-Typen"
            icon={TrendingDown}
            rows={stats?.top_spend || []}
            tone="rose"
            loading={loading}
            empty="Noch keine Ausgaben verbucht."
            onSelect={(t) => setFilterTx(t)}
          />
        </section>

        {/* Right: user lookup card */}
        <section className="space-y-3">
          <div className="rounded-[var(--radius-lg)] ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h3 className="text-[14px] font-semibold tracking-tight flex items-center gap-1.5">
              <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> User suchen
            </h3>
            <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
              E-Mail oder Anzeigename, dann Saldo prüfen oder anpassen.
            </p>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); searchUser(); }}
            >
              <Input
                value={lookupQ}
                onChange={(e) => setLookupQ(e.target.value)}
                placeholder="z. B. alice@…"
                data-testid="sparks-lookup-input"
              />
              <Button type="submit" size="sm" disabled={searching} data-testid="sparks-lookup-submit">
                {searching ? "…" : "Suchen"}
              </Button>
            </form>

            {lookupResults.length > 0 && (
              <ul className="mt-3 max-h-56 overflow-y-auto divide-y divide-[hsl(var(--border))]/60 rounded-md ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--background))]/50">
                {lookupResults.map(u => (
                  <li key={u.id}>
                    <button
                      onClick={() => { setLookupResults([]); setLookupQ(u.display_name || u.email); loadTarget(u.id); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[hsl(var(--muted))]/40"
                      data-testid={`sparks-lookup-result-${u.id}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium truncate">{u.display_name || "(ohne Name)"}</span>
                        <span className="block text-[11px] font-mono text-[hsl(var(--muted-foreground))] truncate">{u.email}</span>
                      </span>
                      <span className="text-[11px] text-[hsl(var(--accent))] tabular-nums">{fmt(u.sparks_balance ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {target && (
              <div className="mt-4 rounded-md ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">
                      {target.display_name || "(ohne Name)"}
                    </div>
                    <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] truncate">{target.email}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))]/10 ring-1 ring-[hsl(var(--accent))]/30 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[hsl(var(--accent))]" data-testid="sparks-target-balance">
                    <Sparkles className="h-3 w-3" /> {fmt(target.balance)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => { setAdjustSign("+"); setAdjustOpen(true); }}
                    data-testid="sparks-adjust-credit"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Gutschreiben
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setAdjustSign("-"); setAdjustOpen(true); }}
                    disabled={(target.balance || 0) <= 0}
                    data-testid="sparks-adjust-debit"
                  >
                    <Minus className="h-3.5 w-3.5 mr-1" /> Abbuchen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTarget(null)}
                    className="ml-auto text-[hsl(var(--muted-foreground))]"
                  >
                    Schließen
                  </Button>
                </div>

                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">Letzte 50 Einträge</div>
                  {targetLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (target.ledger?.length ? (
                    <ul className="max-h-72 overflow-y-auto divide-y divide-[hsl(var(--border))]/50">
                      {target.ledger.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="min-w-0 truncate">
                            <span className="text-[12px] font-medium">{txLabel(row.transaction_type)}</span>
                            <span className="ml-2 text-[10px] font-mono text-[hsl(var(--muted-foreground))]">{formatDate(row.created_at)}</span>
                          </span>
                          <span className={`text-[12px] font-mono tabular-nums ${row.amount >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                            {row.amount > 0 ? "+" : ""}{fmt(row.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[12px] text-[hsl(var(--muted-foreground))] py-3 text-center">Keine Einträge.</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Recent ledger feed */}
      <section>
        <div className="rounded-[var(--radius-lg)] ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold tracking-tight">Live-Ledger (Cross-User)</h3>
              <p className="text-[12px] text-[hsl(var(--muted-foreground))]">Neueste 60 Buchungen über alle User. Append-only.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterTx}
                onChange={(e) => setFilterTx(e.target.value)}
                className="h-8 rounded-md ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-[12px]"
                data-testid="sparks-filter-tx"
              >
                <option value="">Alle Typen</option>
                {txTypes.map(t => (
                  <option key={t} value={t}>{txLabel(t)}</option>
                ))}
              </select>
              {filterTx && (
                <Button size="sm" variant="ghost" onClick={() => setFilterTx("")}>
                  Filter aus
                </Button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="p-6 space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
          ) : (recent.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-[hsl(var(--muted))]/30 text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Zeit</th>
                    <th className="text-left font-medium px-4 py-2">User</th>
                    <th className="text-left font-medium px-4 py-2">Typ</th>
                    <th className="text-left font-medium px-4 py-2">Notiz</th>
                    <th className="text-right font-medium px-4 py-2">Δ</th>
                    <th className="text-right font-medium px-4 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]/40">
                  {recent.map((row) => (
                    <tr key={row.id} className="hover:bg-[hsl(var(--muted))]/20" data-testid={`sparks-ledger-row-${row.id}`}>
                      <td className="px-4 py-2 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => loadTarget(row.user_id)}
                          className="inline-flex items-center gap-1 hover:text-[hsl(var(--accent))]"
                          title="Zum User"
                        >
                          <span className="font-medium truncate max-w-[140px]">{row.user_display_name || "(ohne Name)"}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </button>
                        <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">{row.user_email}</div>
                      </td>
                      <td className="px-4 py-2">
                        <AdminStatusPill
                          status={row.amount >= 0 ? "approved" : "neutral"}
                          label={txLabel(row.transaction_type)}
                          className={row.amount >= 0 ? "" : "text-rose-700 dark:text-rose-200 bg-rose-500/12 ring-rose-500/30"}
                        />
                      </td>
                      <td className="px-4 py-2 text-[12px] text-[hsl(var(--muted-foreground))] max-w-[220px] truncate">{row.note || "—"}</td>
                      <td className={`px-4 py-2 text-right font-mono tabular-nums ${row.amount >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                        {row.amount > 0 ? "+" : ""}{fmt(row.amount)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-[hsl(var(--foreground))]">{fmt(row.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmptyState
              icon={Sparkles}
              title="Keine Bewegungen"
              body={filterTx ? "Für den gewählten Typ liegen aktuell keine Buchungen vor." : "Sobald User Sparks verdienen oder ausgeben, erscheinen Buchungen hier."}
            />
          ))}
        </div>
      </section>

      {/* Adjust dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md" data-testid="sparks-adjust-dialog">
          <DialogHeader>
            <DialogTitle>Sparks anpassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3 text-[13px]">
              <div className="font-medium truncate">{target?.display_name || "(ohne Name)"}</div>
              <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] truncate">{target?.email}</div>
              <div className="mt-1 text-[12px]">Aktueller Saldo: <span className="font-mono tabular-nums text-[hsl(var(--accent))]">{fmt(target?.balance)}</span></div>
            </div>
            <div>
              <Label className="text-[12px]">Aktion</Label>
              <div className="mt-1 inline-flex rounded-md ring-1 ring-[hsl(var(--border))] overflow-hidden text-[12px]">
                <button
                  onClick={() => setAdjustSign("+")}
                  className={`px-3 py-1.5 ${adjustSign === "+" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : "hover:bg-[hsl(var(--muted))]/40"}`}
                  data-testid="sparks-adjust-sign-credit"
                >
                  <Plus className="h-3.5 w-3.5 inline-block -mt-0.5" /> Gutschrift
                </button>
                <button
                  onClick={() => setAdjustSign("-")}
                  className={`px-3 py-1.5 border-l border-[hsl(var(--border))] ${adjustSign === "-" ? "bg-rose-500/15 text-rose-700 dark:text-rose-200" : "hover:bg-[hsl(var(--muted))]/40"}`}
                  data-testid="sparks-adjust-sign-debit"
                >
                  <Minus className="h-3.5 w-3.5 inline-block -mt-0.5" /> Abbuchung
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="sparks-adjust-amount" className="text-[12px]">Betrag (Sparks)</Label>
              <Input
                id="sparks-adjust-amount"
                type="number"
                min={1}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="z. B. 50"
                data-testid="sparks-adjust-amount"
              />
            </div>
            <div>
              <Label htmlFor="sparks-adjust-note" className="text-[12px]">Notiz (im Audit-Log gespeichert)</Label>
              <Input
                id="sparks-adjust-note"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Refund #1234, Kulanz, …"
                maxLength={240}
                data-testid="sparks-adjust-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)} disabled={adjustSaving}>Abbrechen</Button>
            <Button onClick={submitAdjust} disabled={adjustSaving || !adjustAmount} data-testid="sparks-adjust-submit">
              {adjustSaving ? "Buche…" : adjustSign === "+" ? "Gutschreiben" : "Abbuchen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DistributionCard({ title, rows, tone = "emerald", icon: Icon, loading, empty, onSelect }) {
  const max = Math.max(1, ...rows.map(r => r.amount || 0));
  const barCls = tone === "emerald"
    ? "bg-emerald-500/30 group-hover:bg-emerald-500/45"
    : "bg-rose-500/30 group-hover:bg-rose-500/45";
  return (
    <div className="rounded-[var(--radius-lg)] ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h3 className="text-[14px] font-semibold tracking-tight flex items-center gap-1.5">
        {Icon && <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
        {title}
      </h3>
      {loading ? (
        <div className="mt-3 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /></div>
      ) : (rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map(r => {
            const pct = Math.round(((r.amount || 0) / max) * 100);
            return (
              <li key={r.transaction_type}>
                <button
                  onClick={() => onSelect && onSelect(r.transaction_type)}
                  className="group block w-full text-left"
                  data-testid={`sparks-dist-${r.transaction_type}`}
                  title="Im Live-Ledger filtern"
                >
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate">{txLabel(r.transaction_type)}</span>
                    <span className="font-mono tabular-nums text-[hsl(var(--muted-foreground))]">
                      {fmt(r.amount)} <span className="opacity-60">/ {r.count}×</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-[hsl(var(--muted))]/50 overflow-hidden">
                    <div className={`h-full ${barCls} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}
