import { BadgeCheck, Eye, Image as ImageIcon, Zap, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Horizontal scrollable chip bar for quick toggles. Mobile-first, sticky-friendly. */
export function QuickFilterBar({ prefs, onChange, onOpenAdvanced }) {
  const { t } = useTranslation();
  const toggle = (key) => onChange({ ...prefs, [key]: !prefs[key] });
  const chips = [
    { key: "online_only",      icon: Zap,         label: t("filters.online_only") },
    { key: "only_verified",    icon: BadgeCheck,  label: t("filters.only_verified") },
    { key: "only_face_photo",  icon: Eye,         label: t("filters.only_face_photo") },
    { key: "only_with_photos", icon: ImageIcon,   label: t("filters.only_with_photos") },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" data-testid="quick-filter-bar">
      {chips.map(({ key, icon: Icon, label }) => {
        const on = !!prefs?.[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            data-testid={`quick-filter-${key}`}
            aria-pressed={on}
            className={[
              "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium",
              "transition-[background-color,color,border-color,box-shadow] duration-[var(--dur-2)] ease-[var(--ease-out)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
              "active:scale-[0.98]",
              on
                ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent shadow-[var(--shadow-sm)]"
                : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
      {onOpenAdvanced && (
        <button
          type="button"
          onClick={onOpenAdvanced}
          data-testid="quick-filter-advanced-button"
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-1.5 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors duration-[var(--dur-2)]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{t("filters.advanced") || "Mehr Filter"}</span>
        </button>
      )}
    </div>
  );
}
