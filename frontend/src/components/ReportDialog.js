import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Flag } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

export function ReportDialog({ targetType, targetId, trigger, _externalOpen, _externalOnOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof _externalOpen === "boolean";
  const open = isControlled ? _externalOpen : internalOpen;
  const setOpen = isControlled ? (_externalOnOpenChange || (() => {})) : setInternalOpen;
  const [reason, setReason] = useState("harassment");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const detailRequired = ["spam", "harassment", "other"].includes(reason);
  const detailTooShort = detailRequired && detail.trim().length < 10;

  const submit = async () => {
    if (detailTooShort) {
      toast.error("Bitte gib den Moderator:innen etwas Kontext (mind. 10 Zeichen).");
      return;
    }
    setBusy(true);
    try {
      await api.post("/reports", { target_type: targetType, target_id: targetId, reason, detail: detail.trim() });
      toast.success("Meldung eingereicht — danke für deine Hilfe.");
      setOpen(false); setDetail("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Meldung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" data-testid="report-open-button" className="gap-1 text-[hsl(var(--muted-foreground))]">
            <Flag className="h-4 w-4" /> Melden
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Melden</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="text-sm font-medium">Grund</label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger data-testid="report-reason-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spam">Spam / Werbung</SelectItem>
              <SelectItem value="harassment">Belästigung / Hass</SelectItem>
              <SelectItem value="nudity">Unerlaubte Nacktheit / Minderjährig abgebildet</SelectItem>
              <SelectItem value="underage">Minderjährig</SelectItem>
              <SelectItem value="impersonation">Fake-Profil / Identitätsdiebstahl</SelectItem>
              <SelectItem value="other">Sonstiges</SelectItem>
            </SelectContent>
          </Select>
          <label className="text-sm font-medium">
            Beschreibung {detailRequired ? <span className="text-[hsl(var(--destructive))]">*</span> : <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span>}
          </label>
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={4}
            placeholder="Bitte schildere kurz, was vorgefallen ist. Je konkreter, desto schneller können wir handeln (z. B. unerwünschte Kontaktaufnahme, beleidigende Wörter, verdächtige Links, …)."
            maxLength={1000}
            data-testid="report-detail-textarea"
          />
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center justify-between">
            <span>{detailRequired ? "Pflicht ab 10 Zeichen — hilft der Moderation, den Kontext zu verstehen." : " "}</span>
            <span>{detail.length}/1000</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button disabled={busy || detailTooShort} onClick={submit} data-testid="report-submit-button">
            {busy ? "Sende…" : "Meldung absenden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
