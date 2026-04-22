import { Button } from "./ui/button";
import { Ban, EyeOff, Eye, ShieldOff, ShieldCheck, BadgeAlert, CheckSquare, Square, X } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";

const ACTIONS = [
  { key: "ban", label: "Bannen", tone: "destructive", icon: Ban, confirm: "Die ausgewählten Konten werden gebannt. Fortfahren?" },
  { key: "unban", label: "Entbannen", tone: "secondary", icon: ShieldCheck, confirm: "Bann für die ausgewählten Konten aufheben?" },
  { key: "hide", label: "Verstecken", tone: "secondary", icon: EyeOff, confirm: "Ausgewählte Profile werden versteckt." },
  { key: "unhide", label: "Sichtbar", tone: "secondary", icon: Eye, confirm: "Ausgewählte Profile wieder sichtbar schalten?" },
  { key: "shadow", label: "Shadow", tone: "secondary", icon: ShieldOff, confirm: "Ausgewählte Konten werden shadow-restricted." },
  { key: "unshadow", label: "Shadow aus", tone: "secondary", icon: ShieldCheck, confirm: "Shadow-Restriction für Auswahl entfernen?" },
  { key: "require_id_verification", label: "ID anfordern", tone: "secondary", icon: BadgeAlert, confirm: "Die ausgewählten Konten müssen sich ID-verifizieren." },
];

/**
 * Sticky bulk action bar for admin discover grid.
 *
 * Props:
 *  - selectedIds: string[]
 *  - totalCount: number (for display)
 *  - onSelectAll: () => void
 *  - onClear: () => void
 *  - onAction: async (actionKey, reason?: string) => void
 *  - allVisibleSelected: boolean
 */
export function AdminBulkBar({
  selectedIds,
  totalCount,
  onSelectAll,
  onClear,
  onAction,
  allVisibleSelected,
  busy,
}) {
  const [pending, setPending] = useState(null); // { action, confirm }
  const count = selectedIds.length;
  if (count === 0) return null;

  return (
    <>
      <div
        className="sticky top-16 z-40 mb-5 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--accent))]/40 shadow-[var(--shadow-md)] p-3 flex flex-wrap items-center gap-2"
        data-testid="admin-bulk-bar"
      >
        <div className="flex items-center gap-2 pr-2 border-r border-[hsl(var(--border))]">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] px-2.5 py-0.5 text-xs font-medium"
            data-testid="admin-bulk-count"
          >
            {count} ausgewählt
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={onSelectAll}
            data-testid="admin-bulk-select-all"
            title="Alle sichtbaren auswählen"
          >
            {allVisibleSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {allVisibleSelected ? "Alle abwählen" : `Alle ${totalCount} sichtbar`}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.key}
                size="sm"
                variant={a.tone === "destructive" ? "destructive" : "outline"}
                className="h-8 gap-1 text-xs rounded-full"
                disabled={busy}
                onClick={() => setPending({ action: a, confirm: a.confirm })}
                data-testid={`admin-bulk-action-${a.key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {a.label}
              </Button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs"
          onClick={onClear}
          data-testid="admin-bulk-clear"
        >
          <X className="h-3.5 w-3.5" /> Auswahl leeren
        </Button>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action.label} — {count} Nutzer:innen
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.confirm}
              <br />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Diese Aktion wird in den Audit-Log geschrieben.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="admin-bulk-confirm-cancel">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="admin-bulk-confirm-apply"
              onClick={async () => {
                const a = pending?.action;
                setPending(null);
                if (a) await onAction(a.key);
              }}
            >
              Anwenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AdminBulkBar;
