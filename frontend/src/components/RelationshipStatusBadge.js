import { Heart, HeartHandshake, HelpCircle, Gem, Sparkles, Users } from "lucide-react";

/**
 * Canonical relationship status metadata used across profile view, settings,
 * and backend enum. Labels are in German.
 */
export const RELATIONSHIP_STATUSES = [
  { value: "not_specified", label: "Keine Angabe", icon: HelpCircle, tone: "muted" },
  { value: "single", label: "Single", icon: Heart, tone: "accent" },
  { value: "taken", label: "Vergeben", icon: HeartHandshake, tone: "primary" },
  { value: "married", label: "Verheiratet", icon: Gem, tone: "primary" },
  { value: "open_relationship", label: "Offene Beziehung", icon: Sparkles, tone: "accent" },
  { value: "polyamorous", label: "Polyamor", icon: Users, tone: "accent" },
  { value: "complicated", label: "Es ist kompliziert", icon: HelpCircle, tone: "muted" },
  { value: "divorced", label: "Geschieden", icon: HeartHandshake, tone: "muted" },
  { value: "widowed", label: "Verwitwet", icon: HeartHandshake, tone: "muted" },
];

export function getRelationshipStatusMeta(value) {
  if (!value) return RELATIONSHIP_STATUSES[0];
  return RELATIONSHIP_STATUSES.find((r) => r.value === value) || RELATIONSHIP_STATUSES[0];
}

export function RelationshipStatusBadge({ value, className = "" }) {
  if (!value || value === "not_specified") return null;
  const meta = getRelationshipStatusMeta(value);
  const Icon = meta.icon;
  const toneClass =
    meta.tone === "primary"
      ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] ring-[hsl(var(--primary))]/30"
      : meta.tone === "accent"
      ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent-foreground))] ring-[hsl(var(--accent))]/40"
      : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] ring-[hsl(var(--border))]";
  return (
    <span
      data-testid={`relationship-status-${meta.value}`}
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        toneClass,
        className,
      ].join(" ")}
      title={meta.label}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
