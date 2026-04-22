import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Flag } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

export function ReportDialog({ targetType, targetId, trigger }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("harassment");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/reports", { target_type: targetType, target_id: targetId, reason, detail });
      toast.success("Report submitted. Thank you.");
      setOpen(false); setDetail("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" data-testid="report-open-button" className="gap-1 text-[hsl(var(--muted-foreground))]">
            <Flag className="h-4 w-4" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="text-sm">Reason</label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger data-testid="report-reason-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spam">Spam</SelectItem>
              <SelectItem value="harassment">Harassment</SelectItem>
              <SelectItem value="nudity">Nudity</SelectItem>
              <SelectItem value="underage">Underage</SelectItem>
              <SelectItem value="impersonation">Impersonation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <label className="text-sm">Detail (optional)</label>
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={4}
            data-testid="report-detail-textarea"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={submit} data-testid="report-submit-button">
            {busy ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
