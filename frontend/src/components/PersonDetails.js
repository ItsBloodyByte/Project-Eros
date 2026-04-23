import { Badge } from "./ui/badge";
import { useTranslation } from "react-i18next";
import { PENIS_RANGES } from "../lib/constants";

/**
 * PersonDetails — renders one person's body/lifestyle/kinks block.
 *
 * Props:
 *   person  – { height_cm, body_type, ethnicity, smoking, drinking, diet, sti_status,
 *              sti_tested_on, cup_size, penis_length_cm, penis_category, languages,
 *              relationship_types, seeking_roles, kinks, pronouns, orientation,
 *              gender_identity, display_name, age, interests }
 *   title   – optional header (e.g. partner name). When set, the component renders
 *             inside its own bordered card so two persons can be visually separated
 *             (couple view). When NOT set, the component renders borderless so it
 *             can seamlessly extend the enclosing profile card (single-person view).
 *   compact – boolean; compact means smaller spacing / smaller labels.
 *
 * Note: the caller is responsible for rendering the bio — PersonDetails
 * intentionally does NOT render `person.bio` to avoid duplication.
 *
 * The "Körper & Life-Style" and "Kinks" sections are ALWAYS rendered,
 * even when all underlying values are empty (displays "Keine Angaben").
 */
export function PersonDetails({ person, title, compact = false }) {
  const { t } = useTranslation();
  if (!person) return null;

  const hasBodyRow =
    person.height_cm || person.body_type || person.ethnicity ||
    person.smoking || person.drinking || person.diet ||
    person.sti_status || person.sti_tested_on ||
    person.cup_size || person.penis_length_cm ||
    (person.languages && person.languages.length);

  const wrapperClass = title
    ? [
        "rounded-[var(--radius-md)] ring-1 ring-[hsl(var(--border))]/60 bg-[hsl(var(--card))]/60 p-4",
        compact ? "space-y-2.5" : "space-y-3.5",
      ].join(" ")
    : compact ? "space-y-3" : "space-y-4";

  return (
    <div
      className={wrapperClass}
      data-testid={`person-details-${person.id || title || "persona"}`}
    >
      {title && (
        <div className="flex items-center justify-between">
          <div className="font-display text-lg tracking-tight">
            {title}
            {person.age && <span className="ml-2 text-sm text-[hsl(var(--muted-foreground))] font-sans">{person.age}</span>}
          </div>
          {person.pronouns && (
            <Badge variant="outline" className="text-[10px]">{person.pronouns}</Badge>
          )}
        </div>
      )}

      {/* Bio: rendered only inside titled (couple/duo) blocks — the single-person
          case is handled by the parent ProfileViewPage to avoid duplication. */}
      {title && person.bio && (
        <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]">{person.bio}</p>
      )}

      {/* Körper & Life-Style — always visible */}
      <section>
        <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1.5">
          Körper &amp; Life-Style
        </div>
        {hasBodyRow ? (
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Größe" value={person.height_cm ? `${person.height_cm} cm` : null} />
            <DetailRow label="Körpertyp" value={person.body_type ? t(`body_types.${person.body_type}`, { defaultValue: person.body_type }) : null} />
            <DetailRow label="Ethnie" value={person.ethnicity} />
            <DetailRow label="Rauchen" value={person.smoking ? t(`lifestyle.smoking.${person.smoking}`, { defaultValue: person.smoking }) : null} />
            <DetailRow label="Alkohol" value={person.drinking ? t(`lifestyle.drinking.${person.drinking}`, { defaultValue: person.drinking }) : null} />
            <DetailRow label="Ernährung" value={person.diet ? t(`lifestyle.diet.${person.diet}`, { defaultValue: person.diet }) : null} />
            <DetailRow label="STI-Status" value={person.sti_status ? t(`lifestyle.sti.${person.sti_status}`, { defaultValue: person.sti_status }) : null} />
            <DetailRow label="Zuletzt getestet" value={person.sti_tested_on} />
            <DetailRow label="Körbchen" value={person.cup_size} />
            <DetailRow
              label="Penis"
              value={person.penis_category ? `${person.penis_category} (${PENIS_RANGES[person.penis_category] || ""})` : null}
            />
            <DetailRow label="Sprachen" value={person.languages} />
          </div>
        ) : (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Keine Angaben</div>
        )}
      </section>

      {/* Kinks — always visible */}
      <section data-testid="person-details-kinks">
        <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1.5">Kinks</div>
        {person.kinks && person.kinks.length ? (
          <div className="flex flex-wrap gap-1.5">
            {person.kinks.map((k) => (
              <Badge key={k} variant="outline" className="capitalize">{k}</Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Keine Angaben</div>
        )}
      </section>

      {(person.relationship_types?.length > 0 || person.seeking_roles?.length > 0 || person.interests?.length > 0) && (
        <section>
          {person.relationship_types?.length > 0 && (
            <div className="mt-1">
              <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Beziehungsart</div>
              <div className="flex flex-wrap gap-1.5">
                {person.relationship_types.map((r) => (
                  <Badge key={r} variant="secondary">{t(`relationships.${r}`, { defaultValue: r })}</Badge>
                ))}
              </div>
            </div>
          )}
          {person.seeking_roles?.length > 0 && (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Rollen</div>
              <div className="flex flex-wrap gap-1.5">
                {person.seeking_roles.map((r) => (
                  <Badge key={r} variant="outline">{t(`roles.${r}`, { defaultValue: r })}</Badge>
                ))}
              </div>
            </div>
          )}
          {person.interests?.length > 0 && (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Interessen</div>
              <div className="flex flex-wrap gap-1.5">
                {person.interests.map((r) => (
                  <Badge key={r} variant="outline">{r}</Badge>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    value = value.join(", ");
  }
  if (typeof value === "string" && !value.trim()) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export default PersonDetails;
