import React from "react";
import { ArrowDown, ArrowUp, MoreHorizontal } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";

/**
 * AdminKpiCard — single KPI tile for the Overview dashboard.
 *
 * Visual recipe (per design_guidelines #kpi_card):
 *   • Compact card, p-4, subtle hover elevation
 *   • Top row: label + optional icon
 *   • Big tabular-nums value
 *   • Optional delta chip (color-coded green/red)
 *   • Optional click-through (renders as a button if `onClick` is given)
 *
 * No charting lib required — sparkline is OPTIONAL and rendered as inline
 * SVG path so the admin shell stays free of recharts.
 */
export function AdminKpiCard({
  label, value, formatted, delta, deltaLabel, loading, onClick, icon: Icon,
  spark = null, tone = "neutral", testid, hint,
}) {
  const positive = typeof delta === "number" ? delta >= 0 : null;
  const tones = {
    neutral: "",
    accent:  "ring-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/[0.04]",
    warn:    "ring-amber-500/30 bg-amber-500/[0.04]",
    danger:  "ring-red-500/30 bg-red-500/[0.04]",
  };
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      data-testid={testid || "overview-kpi-card"}
      className={`group relative text-left rounded-[var(--radius-md)] ring-1 ring-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-shadow ${onClick ? "hover:shadow-md hover:ring-[hsl(var(--accent))]/40 cursor-pointer" : ""} ${tones[tone] || ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <span className="truncate">{label}</span>
        </div>
        {hint && (
          <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]/70">{hint}</span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-2">
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span className="text-[22px] md:text-[24px] font-semibold tracking-[-0.01em] tabular-nums" data-testid="overview-kpi-value">
            {formatted ?? (value?.toLocaleString?.("de-DE") ?? value ?? "–")}
          </span>
        )}
        {typeof delta === "number" && !loading && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${positive ? "text-emerald-700 dark:text-emerald-200 bg-emerald-500/12 ring-emerald-500/25" : "text-red-700 dark:text-red-200 bg-red-500/12 ring-red-500/25"}`}>
            {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} {Math.abs(delta).toLocaleString("de-DE")}{deltaLabel || ""}
          </span>
        )}
      </div>
      {Array.isArray(spark) && spark.length > 1 && (
        <Sparkline values={spark} />
      )}
      {onClick && <MoreHorizontal className="absolute top-3 right-3 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]/50 opacity-0 group-hover:opacity-100" />}
    </Wrapper>
  );
}

function Sparkline({ values }) {
  // Normalize to 0..1 then map onto a 0..28 viewbox so the sparkline always
  // fits regardless of the absolute scale.
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const W = 100, H = 28;
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full h-7 stroke-[hsl(var(--accent))]" preserveAspectRatio="none" data-testid="overview-kpi-sparkline">
      <polyline fill="none" strokeWidth="1.4" points={pts} />
    </svg>
  );
}
