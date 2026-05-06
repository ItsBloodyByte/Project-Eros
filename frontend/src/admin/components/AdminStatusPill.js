import React from "react";

/**
 * AdminStatusPill — small colored chip for the moderation/payment/verification
 * states. The status → color mapping is centralised here so every list
 * column in the admin uses the exact same visual vocabulary.
 *
 * Status families (see /app/design_guidelines.md `status_colors`):
 *   open / pending  → amber-warning
 *   resolved / paid → emerald-success
 *   banned / failed → destructive-red
 *   info / approved → blue-info
 *   neutral         → muted
 */
const MAP = {
  // Reports / queue
  open:       { label: "Offen",       cls: "text-amber-700 dark:text-amber-200 bg-amber-500/15 ring-amber-500/30" },
  pending:    { label: "Ausstehend",  cls: "text-blue-700 dark:text-blue-200 bg-blue-500/15 ring-blue-500/30" },
  in_review:  { label: "In Prüfung",  cls: "text-blue-700 dark:text-blue-200 bg-blue-500/15 ring-blue-500/30" },
  resolved:   { label: "Gelöst",       cls: "text-emerald-700 dark:text-emerald-200 bg-emerald-500/15 ring-emerald-500/30" },
  approved:   { label: "Bestätigt",   cls: "text-emerald-700 dark:text-emerald-200 bg-emerald-500/15 ring-emerald-500/30" },
  // Users
  active:     { label: "Aktiv",       cls: "text-emerald-700 dark:text-emerald-200 bg-emerald-500/12 ring-emerald-500/25" },
  banned:     { label: "Gesperrt",    cls: "text-red-700 dark:text-red-200 bg-red-500/15 ring-red-500/30" },
  shadow:     { label: "Shadow",      cls: "text-orange-700 dark:text-orange-200 bg-orange-500/15 ring-orange-500/30" },
  honeypot:   { label: "Honeypot",    cls: "text-purple-700 dark:text-purple-200 bg-purple-500/15 ring-purple-500/30" },
  // Payments
  paid:       { label: "Bezahlt",     cls: "text-emerald-700 dark:text-emerald-200 bg-emerald-500/15 ring-emerald-500/30" },
  initiated:  { label: "Eingeleitet", cls: "text-blue-700 dark:text-blue-200 bg-blue-500/15 ring-blue-500/30" },
  expired:    { label: "Abgelaufen",  cls: "text-zinc-600 dark:text-zinc-300 bg-zinc-500/12 ring-zinc-500/25" },
  failed:     { label: "Fehlgeschlagen", cls: "text-red-700 dark:text-red-200 bg-red-500/15 ring-red-500/30" },
  refunded:   { label: "Erstattet",   cls: "text-amber-700 dark:text-amber-200 bg-amber-500/15 ring-amber-500/30" },
  // Verifications
  rejected:   { label: "Abgelehnt",   cls: "text-red-700 dark:text-red-200 bg-red-500/15 ring-red-500/30" },
  // Generic
  neutral:    { label: "—",            cls: "text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/40 ring-[hsl(var(--border))]" },
  premium:    { label: "Premium",     cls: "text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/12 ring-[hsl(var(--accent))]/30" },
};

export function AdminStatusPill({ status, label, className = "", testid }) {
  const k = (status || "neutral").toLowerCase();
  const cfg = MAP[k] || MAP.neutral;
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 leading-none ${cfg.cls} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label || cfg.label}
    </span>
  );
}
