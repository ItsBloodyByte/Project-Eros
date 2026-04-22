import { useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { MOOD_LIST, getMood } from "../lib/moods";
import { Button } from "./ui/button";
import { X } from "lucide-react";

/**
 * Lets the user pick (or clear) their current mood indicator.
 * Shown on the profile edit page. Uses PATCH /api/me/mood for quick updates.
 */
export function MoodSelector() {
  const { user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const current = user?.current_mood || null;
  const currentDef = getMood(current);

  const setMood = async (key) => {
    setSaving(true);
    try {
      const next = current === key ? null : key;
      await api.patch("/me/mood", { current_mood: next });
      await refresh();
      if (next) {
        toast.success(`Status gesetzt: ${getMood(next)?.label}`);
      } else {
        toast.success("Status entfernt");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Status konnte nicht gesetzt werden");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)]"
      data-testid="mood-selector"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg">Aktueller Status</div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 max-w-prose">
            Zeige anderen auf einen Blick, wonach dir gerade ist. Dein Status erscheint auf deinem Profil und lässt sich jederzeit ändern oder entfernen.
          </p>
        </div>
        {current && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMood(current)}
            disabled={saving}
            className="gap-1.5 rounded-full"
            data-testid="mood-clear-button"
          >
            <X className="h-3.5 w-3.5" /> Status entfernen
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="mood-options">
        {MOOD_LIST.map((m) => {
          const Icon = m.icon;
          const active = current === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMood(m.key)}
              disabled={saving}
              aria-pressed={active}
              data-testid={`mood-option-${m.key}`}
              className={[
                "group flex flex-col items-start gap-1.5 rounded-[var(--radius-md)] p-3 text-left transition-colors ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]",
                active
                  ? `${m.bgClass} ${m.textClass} ${m.ringClass}`
                  : "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] ring-[hsl(var(--border))] hover:ring-[hsl(var(--accent))]/40",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5 font-medium text-sm">
                <Icon className="h-4 w-4" />
                {m.label}
                {active && <span className={`ml-auto h-1.5 w-1.5 rounded-full ${m.dotClass}`} aria-hidden />}
              </span>
              <span className="text-[11px] leading-snug opacity-80">
                {m.description}
              </span>
            </button>
          );
        })}
      </div>

      {currentDef && (
        <div
          className="text-xs text-[hsl(var(--muted-foreground))]"
          data-testid="mood-current-hint"
        >
          Aktuell sichtbar: <strong className={currentDef.textClass}>{currentDef.label}</strong>
        </div>
      )}
    </section>
  );
}
