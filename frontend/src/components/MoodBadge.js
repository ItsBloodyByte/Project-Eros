import { getMood } from "../lib/moods";

/**
 * Visual badge for a user's current mood indicator.
 *
 * Props:
 *  - mood: mood key ("sex_meet" | "dating" | "chatting" | "online") or null
 *  - size: "xs" | "sm" | "md"   (default: "sm")
 *  - compact: when true, render a small dot + short label
 *  - className: extra classes to merge on the outer element
 *  - onClick: optional click handler (render as a button)
 */
export function MoodBadge({ mood, size = "sm", compact = false, className = "", onClick = null, testid }) {
  const m = getMood(mood);
  if (!m) return null;

  const Icon = m.icon;
  const sizes = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  };
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  const classes = [
    "inline-flex items-center rounded-full font-medium leading-none ring-1 whitespace-nowrap",
    m.bgClass, m.textClass, m.ringClass,
    sizes[size] || sizes.sm,
    onClick ? "cursor-pointer hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" : "",
    className,
  ].join(" ");

  if (compact) {
    return (
      <span
        className={classes}
        data-testid={testid || `mood-badge-${m.key}`}
        aria-label={m.label}
        title={m.label}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${m.dotClass}`} aria-hidden />
        <span>{m.short}</span>
      </span>
    );
  }

  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={classes}
      data-testid={testid || `mood-badge-${m.key}`}
      aria-label={m.label}
      title={m.label}
      onClick={onClick}
    >
      <Icon className={iconSize} />
      <span>{m.label}</span>
    </Tag>
  );
}
