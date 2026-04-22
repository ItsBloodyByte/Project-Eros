import { Checkbox } from "./ui/checkbox";
import { useTranslation } from "react-i18next";

export function ConsentCheckboxGroup({ value, onChange }) {
  const { t } = useTranslation();
  const items = [
    { key: "terms", title: t("auth.consent_terms_title"), desc: t("auth.consent_terms_desc"), required: true },
    { key: "privacy", title: t("auth.consent_privacy_title"), desc: t("auth.consent_privacy_desc"), required: true },
    { key: "sensitive_data", title: t("auth.consent_sensitive_title"), desc: t("auth.consent_sensitive_desc"), required: true },
    { key: "nsfw_view", title: t("auth.consent_nsfw_title"), desc: t("auth.consent_nsfw_desc"), required: false },
  ];
  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  return (
    <div className="space-y-3" data-testid="consent-checkbox-group">
      {items.map((it) => (
        <label key={it.key} className="flex gap-3 rounded-[var(--radius-sm)] border bg-card p-3 cursor-pointer">
          <Checkbox
            checked={!!value[it.key]}
            onCheckedChange={() => toggle(it.key)}
            data-testid={`consent-${it.key}`}
          />
          <div>
            <div className="text-sm font-medium">
              {it.title}
              {it.required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{it.desc}</div>
          </div>
        </label>
      ))}
    </div>
  );
}
