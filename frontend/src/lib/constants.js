export const GENDERS = [
  "woman", "man", "nonbinary", "trans_woman", "trans_man", "genderqueer", "agender", "other",
];
export const ORIENTATIONS = [
  "straight", "gay", "lesbian", "bisexual", "pansexual", "asexual", "queer", "questioning", "other",
];
export const RELATIONSHIP_TYPES = ["casual", "serious", "friendship", "open", "undecided"];
export const SEEKING_ROLES = ["top", "bottom", "versatile", "any"];
export const BODY_TYPES = [
  "slim", "athletic", "average", "muscular", "curvy", "bear", "cub", "chub", "twink", "jock", "dad",
];
export const SMOKING_VALUES = ["never", "sometimes", "often", "prefer_not_say"];
export const DRINKING_VALUES = ["never", "sometimes", "often", "prefer_not_say"];
export const DIET_VALUES = ["omnivore", "vegetarian", "vegan", "pescetarian", "kosher", "halal", "other"];
export const STI_VALUES = ["negative", "positive_undetectable", "positive", "on_prep", "prefer_not_say"];
export const CUP_SIZES = ["A", "B", "C", "D", "DD", "E", "F", "G", "H", "I"];
export const PENIS_CATEGORIES = ["S", "M", "L", "XL", "XXL"];
export const PENIS_RANGES = {
  S: "≤ 12 cm",
  M: "12–15 cm",
  L: "15–18 cm",
  XL: "18–21 cm",
  XXL: "> 21 cm",
};

export const COMMON_KINKS = [
  "BDSM", "Rope / Bondage", "Leather", "Latex", "Rubber",
  "Feet", "Socks", "Sneaker", "Underwear", "Jockstrap",
  "Uniform", "Sportswear", "Lycra", "Spandex",
  "Role-play", "Daddy", "Boy", "Pup play",
  "Voyeur", "Exhibition", "Group", "Threesome",
  "Dom", "Sub", "Switch", "Edging", "Teasing",
  "Spanking", "Tickling", "Oral", "Kissing",
];

export const COMMON_LANGUAGES = [
  "Deutsch", "English", "Français", "Español", "Italiano", "Português",
  "Nederlands", "Polski", "Türkçe", "Русский", "العربية", "中文", "日本語",
];

export const COMMON_ETHNICITIES = [
  "European", "Asian", "African", "Latino/Latina", "Middle Eastern",
  "Indigenous", "Pacific Islander", "Mixed", "Other",
];

/** Auto-categorize penis length in cm to S/M/L/XL/XXL */
export function penisCategoryFor(lengthCm) {
  const v = Number(lengthCm);
  if (!v || v <= 0) return null;
  if (v <= 12) return "S";
  if (v <= 15) return "M";
  if (v <= 18) return "L";
  if (v <= 21) return "XL";
  return "XXL";
}
