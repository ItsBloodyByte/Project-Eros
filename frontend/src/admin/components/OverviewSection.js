import React, { useEffect, useState } from "react";
import {
  Flag, Image as ImageIcon, BadgeCheck, ShieldAlert, CreditCard, Sparkles,
  Users, Crown, Activity, AlertTriangle,
} from "lucide-react";
import { AdminKpiCard } from "./AdminKpiCard";
import { AdminPageHeader } from "./AdminPageHeader";
import { api } from "../../lib/api";

/**
 * OverviewSection — the Admin landing dashboard.
 *
 * Aggregates a handful of cheap GETs into a single grid of KPI cards.
 * Each card click jumps the parent shell to the relevant section so
 * mods can drill from "there are 12 reports" to "the report queue"
 * with one tap. This is the "calm under pressure" view.
 *
 * Sources (all cached on the server side already):
 *   - GET /admin/reports                    → open count
 *   - GET /admin/photo-queue                → pending count
 *   - GET /admin/verifications              → pending count
 *   - GET /admin/honeypots                  → honeypot count (super only)
 *   - GET /admin/payments/stale-stats       → stale_pending_to_sweep
 *   - GET /admin/users (limit=1)            → total users via response shape
 *
 * Each fetch is wrapped in try/except so a broken sub-endpoint never
 * black-holes the entire dashboard.
 */
export function OverviewSection({ onJumpTo, isSuper }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const next = {};
    const tryGet = async (path, mapper) => {
      try { const r = await api.get(path); return mapper(r.data); } catch { return undefined; }
    };
    next.reports       = await tryGet("/admin/reports?status=open", (d) => (d.reports || []).length);
    next.photos        = await tryGet("/admin/photo-queue",         (d) => (d.photos || d.queue || []).length);
    next.verifications = await tryGet("/admin/verifications",       (d) => (d.verifications || []).length);
    next.honeypots     = isSuper ? await tryGet("/admin/honeypots", (d) => (d.honeypots || []).length) : undefined;
    next.shadowBans    = isSuper ? await tryGet("/admin/shadow-bans", (d) => (d.users || []).length) : undefined;
    next.users         = await tryGet("/admin/users?limit=1",       (d) => d.total || (d.users || []).length);
    next.payments      = isSuper ? await tryGet("/admin/payments/stale-stats", (d) => d.stale_pending_to_sweep) : undefined;
    next.paymentBuckets = isSuper ? await tryGet("/admin/payments/stale-stats", (d) => d.buckets || {}) : {};
    setData(next);
    setUpdatedAt(new Date().toLocaleTimeString("de-DE"));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-5" data-testid="admin-overview">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Überblick über laufende Moderation und Betrieb."
        lastUpdated={updatedAt || "—"}
        actions={
          <button
            onClick={fetchAll}
            disabled={loading}
            className="text-[12px] px-3 py-1.5 rounded-md ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]/40 disabled:opacity-50"
            data-testid="overview-refresh"
          >
            {loading ? "Lädt…" : "Aktualisieren"}
          </button>
        }
      />

      <section className="space-y-2" data-testid="overview-kpi-moderation">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Moderations-Queues</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AdminKpiCard
            label="Offene Reports"
            icon={Flag}
            value={data.reports}
            loading={loading}
            tone={data.reports > 5 ? "warn" : "neutral"}
            onClick={() => onJumpTo("reports")}
            testid="kpi-reports"
          />
          <AdminKpiCard
            label="Foto-Queue"
            icon={ImageIcon}
            value={data.photos}
            loading={loading}
            tone={data.photos > 10 ? "warn" : "neutral"}
            onClick={() => onJumpTo("photos")}
            testid="kpi-photos"
          />
          <AdminKpiCard
            label="ID-Verifizierungen"
            icon={BadgeCheck}
            value={data.verifications}
            loading={loading}
            tone={data.verifications > 0 ? "accent" : "neutral"}
            onClick={() => onJumpTo("verifications")}
            testid="kpi-verifications"
          />
          {isSuper && (
            <AdminKpiCard
              label="Shadow-Bans"
              icon={ShieldAlert}
              value={data.shadowBans}
              loading={loading}
              tone={data.shadowBans > 20 ? "danger" : "neutral"}
              onClick={() => onJumpTo("honeypots")}
              testid="kpi-shadow-bans"
            />
          )}
        </div>
      </section>

      <section className="space-y-2" data-testid="overview-kpi-platform">
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Plattform</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AdminKpiCard
            label="Registrierte Users"
            icon={Users}
            value={data.users}
            loading={loading}
            onClick={() => onJumpTo("users")}
            testid="kpi-users"
          />
          {isSuper && (
            <AdminKpiCard
              label="Stale Zahlungen"
              icon={CreditCard}
              value={data.payments}
              loading={loading}
              tone={data.payments > 50 ? "warn" : "neutral"}
              onClick={() => onJumpTo("payments")}
              hint="über 60min"
              testid="kpi-payments"
            />
          )}
          <AdminKpiCard
            label="Honeypots aktiv"
            icon={ShieldAlert}
            value={data.honeypots}
            loading={loading}
            tone="neutral"
            onClick={() => onJumpTo("honeypots")}
            testid="kpi-honeypots"
          />
          <AdminKpiCard
            label="Sparks-System"
            icon={Sparkles}
            value="aktiv"
            formatted="OK"
            loading={false}
            tone="accent"
            onClick={() => onJumpTo("sparks")}
            testid="kpi-sparks"
          />
        </div>
      </section>

      {isSuper && data.paymentBuckets && Object.keys(data.paymentBuckets).length > 0 && (
        <section className="space-y-2" data-testid="overview-payment-buckets">
          <h2 className="text-[12px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Zahlungs-Status (alle Zeit)</h2>
          <div className="rounded-[var(--radius-md)] ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {["initiated","paid","expired","failed","refunded"].map((k) => (
                <div key={k} className="flex flex-col items-start gap-1">
                  <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{k}</div>
                  <div className="text-[18px] font-semibold tabular-nums">{(data.paymentBuckets[k] || 0).toLocaleString("de-DE")}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
