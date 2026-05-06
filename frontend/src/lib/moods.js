/**
 * Mood / Status-Indikator System.
 * Single source of truth for mood keys, labels, icons, and colors.
 * Backend enum lives in /app/backend/models.py (Mood).
 */
import { Flame, Heart, MessageCircle } from "lucide-react";

export const MOOD_KEYS = ["sex_meet", "dating", "chatting"];

/**
 * Definitions. Colors map into distinct HSL tokens so each mood has its own
 * identity without overpowering the main brand accent.
 *  - sex_meet uses the "destructive" hue for its bold/adult vibe
 *  - dating uses the accent hue (hearts & connection)
 *  - chatting uses a neutral blue-ish from "ring"
 *
 *  Note (2026-05): the "online" mood was removed because every authenticated
 *  user already exposes a generic online indicator. Keeping it as a mood
 *  caused a duplicate "Online" pill on profiles that confused users. Legacy
 *  documents whose `current_mood` is still "online" no-op gracefully because
 *  `getMood("online")` returns null and `MoodBadge` short-circuits.
 */
export const MOODS = {
  sex_meet: {
    key: "sex_meet",
    label: "Sex-Treffen",
    short: "Sex",
    icon: Flame,
    // Bold red-ish using destructive token
    ringClass: "ring-[hsl(var(--destructive))]/45",
    bgClass: "bg-[hsl(var(--destructive))]/12",
    textClass: "text-[hsl(var(--destructive))]",
    dotClass: "bg-[hsl(var(--destructive))]",
    description: "Klar kommuniziert: ich suche intime Treffen.",
  },
  dating: {
    key: "dating",
    label: "Dating",
    short: "Dating",
    icon: Heart,
    ringClass: "ring-[hsl(var(--accent))]/45",
    bgClass: "bg-[hsl(var(--accent))]/12",
    textClass: "text-[hsl(var(--accent))]",
    dotClass: "bg-[hsl(var(--accent))]",
    description: "Ich bin offen fürs Daten – ob locker oder ernst.",
  },
  chatting: {
    key: "chatting",
    label: "Chatten",
    short: "Chat",
    icon: MessageCircle,
    ringClass: "ring-[hsl(var(--ring))]/45",
    bgClass: "bg-[hsl(var(--ring))]/12",
    textClass: "text-[hsl(var(--ring))]",
    dotClass: "bg-[hsl(var(--ring))]",
    description: "Nur zum Quatschen – kein Druck.",
  },
};

export function getMood(key) {
  if (!key) return null;
  return MOODS[key] || null;
}

export const MOOD_LIST = MOOD_KEYS.map((k) => MOODS[k]);
