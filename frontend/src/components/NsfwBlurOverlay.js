import { useState } from "react";
import { Eye, ShieldAlert } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";

export function NsfwBlurOverlay({ active, onReveal, revealed, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const [consented, setConsented] = useState(false);

  const show = active && !revealed;

  return (
    <div className={`relative overflow-hidden ${className}`} data-testid="nsfw-overlay">
      {children}
      {show && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <div className="absolute inset-0 backdrop-blur-[18px]" />
          <div className="relative flex flex-col items-center gap-2 p-4 text-center">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white border border-white/15">
              <ShieldAlert className="h-3.5 w-3.5" />
              Sensitive media
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-white/10 text-white border border-white/15 hover:bg-white/20"
              data-testid="nsfw-reveal-button"
              onClick={() => setOpen(true)}
            >
              <Eye className="h-4 w-4 mr-1.5" /> Reveal (18+)
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sensitive media</AlertDialogTitle>
            <AlertDialogDescription>
              This image may contain nudity or explicit content. Confirm you are 18+ and consent to view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              checked={consented}
              onCheckedChange={(v) => setConsented(Boolean(v))}
              data-testid="nsfw-consent-checkbox"
            />
            <span className="text-sm">I am 18+ and I consent to view sensitive media.</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConsented(false); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="nsfw-consent-confirm-button"
              disabled={!consented}
              onClick={() => { if (consented) { onReveal && onReveal(); setOpen(false); } }}
            >
              View
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
