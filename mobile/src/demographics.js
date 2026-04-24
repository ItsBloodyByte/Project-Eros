/**
 * Shared demographics helpers for the mobile app.
 *
 * Kept in sync with:
 *  - `/app/backend/helpers.py` → `is_gay_male_like(doc)`
 *  - `/app/frontend/src/pages/MyProfilePage.js` → `isGayMaleLike()` + `GAY_POSITIONS`
 *
 * The backend remains the source of truth — these helpers only drive UI
 * visibility (showing/hiding fields) on the client side. The backend enforces
 * the same rule when persisting `gay_position` or applying the position
 * filter to /discover, so a mismatched client cannot corrupt data.
 */

export const MASCULINE_GENDERS = new Set(["man", "trans_man"]);
export const FEMININE_GENDERS = new Set(["woman", "trans_woman"]);
export const NEUTRAL_GENDERS = new Set(["nonbinary", "genderqueer", "agender", "other"]);
export const GAY_ORIENTATIONS = new Set(["gay", "bisexual", "pansexual", "queer", "questioning"]);

export function isGayMaleLike(user) {
  if (!user) return false;
  const g = user.gender_identity;
  const o = user.orientation;
  return MASCULINE_GENDERS.has(g) && GAY_ORIENTATIONS.has(o);
}

/** Audience helpers for filter visibility (based on whom you are seeking). */
export function seeksWomen(seekingGenders) {
  if (!Array.isArray(seekingGenders) || seekingGenders.length === 0) return true;
  return seekingGenders.some((g) => FEMININE_GENDERS.has(g) || NEUTRAL_GENDERS.has(g));
}
export function seeksMen(seekingGenders) {
  if (!Array.isArray(seekingGenders) || seekingGenders.length === 0) return true;
  return seekingGenders.some((g) => MASCULINE_GENDERS.has(g) || NEUTRAL_GENDERS.has(g));
}

/** Ordered position options with German labels. */
export const GAY_POSITIONS = [
  { value: "top", label: "Top (aktiv)" },
  { value: "vers_top", label: "Vers-Top (eher aktiv)" },
  { value: "vers", label: "Vers (beides)" },
  { value: "vers_bottom", label: "Vers-Bottom (eher passiv)" },
  { value: "bottom", label: "Bottom (passiv)" },
  { value: "side", label: "Side (kein Analverkehr)" },
  { value: "prefer_not_say", label: "Keine Angabe" },
];

export const NSFW_OPTIONS = [
  { value: "na", label: "Keine Angabe" },
  { value: "yes", label: "Offen für NSFW-Inhalte" },
  { value: "no", label: "Nur SFW (keine NSFW-Inhalte)" },
];

export function nsfwToValue(nsfw) {
  if (nsfw === true) return "yes";
  if (nsfw === false) return "no";
  return "na";
}
export function valueToNsfw(v) {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}
