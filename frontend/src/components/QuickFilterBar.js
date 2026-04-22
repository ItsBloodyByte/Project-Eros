import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { BadgeCheck, Eye, Image as ImageIcon, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Inline chip row for quick toggles. Tappable card-like chips for mobile-first. */
export function QuickFilterBar({ prefs, onChange }) {
  const { t } = useTranslation();
  const toggle = (key) => onChange({ ...prefs, [key]: !prefs[key] });
  const chips = [
    { key: "online_only",      icon: <Zap className="h-3.5 w-3.5" />,         label: t("filters.online_only") },
    { key: "only_verified",    icon: <BadgeCheck className="h-3.5 w-3.5" />,  label: t("filters.only_verified") },
    { key: "only_face_photo",  icon: <Eye className="h-3.5 w-3.5" />,         label: t("filters.only_face_photo") },
    { key: "only_with_photos", icon: <ImageIcon className="h-3.5 w-3.5" />,   label: t("filters.only_with_photos") },
  ];
  const count = chips.filter((c) => prefs?.[c.key]).length;
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" data-testid="quick-filter-bar">
      {chips.map((c) => {
        const on = !!prefs?.[c.key];
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            data-testid={`quick-filter-${c.key}`}
            className={[
              "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
              on
                ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent shadow-[var(--shadow-sm)]"
                : "bg-card hover:bg-[hsl(var(--secondary))]",
            ].join(" ")}
          >
            {c.icon}
            <span>{c.label}</span>
            {on && <Switch checked={true} className="pointer-events-none scale-75 ml-1" />}
          </button>
        );
      })}
      {count > 0 && (
        <Badge variant="secondary" className="shrink-0">{count}</Badge>
      )}
    </div>
  );
}
