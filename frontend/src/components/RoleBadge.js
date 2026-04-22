import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { ShieldCheck, Shield, Gavel, Scale, LifeBuoy, Eye } from "lucide-react";

/**
 * Role meta map — single source of truth for badge labels, explanations, icons and colors.
 * Labels intentionally kept compact so they fit the existing UI chrome.
 */
export const ROLE_META = {
  superadmin: {
    label: "Super-Admin",
    explanation:
      "Superadmin — volle Plattformhoheit: Systemkonfiguration, Rollenvergabe, Broadcasts, Audit & Zahlungen.",
    icon: ShieldCheck,
    className:
      "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive))]/40",
  },
  admin: {
    label: "Admin",
    explanation:
      "Admin — Moderation, Nutzerverwaltung, Reports, Fotos, Verifizierungen und Broadcasts.",
    icon: Shield,
    className:
      "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40",
  },
  moderator: {
    label: "Moderator",
    explanation:
      "Moderator:in — prüft Reports, Inhalte und Chats; kann verwarnen, verbergen oder eskalieren.",
    icon: Gavel,
    className:
      "bg-sky-500/10 text-sky-600 dark:text-sky-300 ring-1 ring-sky-500/30",
  },
  content_reviewer: {
    label: "Content-Review",
    explanation:
      "Content Reviewer — sichtet Fotos, Videos und KI-Flags; entscheidet über Freigabe oder Entfernung.",
    icon: Eye,
    className:
      "bg-violet-500/10 text-violet-600 dark:text-violet-300 ring-1 ring-violet-500/30",
  },
  support: {
    label: "Support",
    explanation:
      "Support — beantwortet Nutzeranfragen, eskaliert Moderation, kein Zugriff auf sensible Konfigs.",
    icon: LifeBuoy,
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500/30",
  },
  legal: {
    label: "Recht",
    explanation:
      "Recht & Compliance — pflegt rechtliche Inhalte (AGB, Datenschutz) und DSGVO-Anfragen.",
    icon: Scale,
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30",
  },
};

/**
 * RoleBadge — visual role marker with explanatory tooltip on hover/focus.
 *
 * Props:
 *   role: one of the keys of ROLE_META (or "user"/unknown → renders nothing).
 *   size: "sm" (default) | "xs"
 *   withIcon: boolean (default true)
 *   className: optional extra classes
 */
export function RoleBadge({ role, size = "sm", withIcon = true, className = "" }) {
  if (!role || role === "user") return null;
  const meta = ROLE_META[role];
  if (!meta) {
    // Unknown staff role — render minimal badge without tooltip text
    return (
      <span
        className={[
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium uppercase tracking-wide",
          size === "xs" ? "text-[10px]" : "text-[10.5px]",
          "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40",
          className,
        ].join(" ")}
        data-testid={`role-badge-${role}`}
      >
        {role}
      </span>
    );
  }
  const Icon = meta.icon;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={[
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium uppercase tracking-wide cursor-help",
              size === "xs" ? "text-[10px]" : "text-[10.5px]",
              meta.className,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/40",
              className,
            ].join(" ")}
            data-testid={`role-badge-${role}`}
            aria-label={`${meta.label}: ${meta.explanation}`}
          >
            {withIcon && Icon && <Icon className="h-3 w-3" aria-hidden />}
            {meta.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
          <div className="font-medium mb-0.5">{meta.label}</div>
          <div className="opacity-80">{meta.explanation}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default RoleBadge;
