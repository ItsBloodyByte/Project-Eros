import { format } from "date-fns";
import { Check, CheckCheck, Clock, MoreHorizontal, BadgeCheck, UserCheck, X, Handshake } from "lucide-react";
import { ReportDialog } from "./ReportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function ChatBubble({ message, me, senders = {}, showSenderLabel = false }) {
  // With couple-aware chats, "isMe" means either the viewing user OR their linked partner.
  const selfIds = new Set([me?.id, me?.partner_user_id].filter(Boolean));
  const isMe = selfIds.has(message.sender_id);
  const [reportOpen, setReportOpen] = useState(false);

  // Acquaintance request/response renders as a full-width centered card
  if (message.kind === "acquaintance_request") {
    return <AcquaintanceRequestCard message={message} me={me} isMe={isMe} senders={senders} />;
  }
  if (message.kind === "acquaintance_response") {
    return <AcquaintanceResponseCard message={message} />;
  }

  const isBroadcast = !!message.is_broadcast;
  const time = message.created_at ? format(new Date(message.created_at), "HH:mm") : "";
  const isNsfw = message.media_data_url && (message.nsfw_score ?? 0) >= 0.75;
  const isRead = isMe && (message.read_by?.length || 0) > 1;
  const senderProfile = message.sender || senders[message.sender_id] || null;

  // Split **Title**\n\nBody into title + body for broadcast
  let bcTitle = null, bcBody = message.text;
  if (isBroadcast && message.text) {
    const m = message.text.match(/^\*\*(.+?)\*\*\n\n([\s\S]*)$/);
    if (m) { bcTitle = m[1]; bcBody = m[2]; }
  }

  return (
    <div className={`group flex w-full items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`} data-testid="chat-bubble">
      {!isMe && !isBroadcast && senderProfile?.avatar && (
        <img
          src={senderProfile.avatar}
          alt={senderProfile.display_name || "Sender"}
          className="h-7 w-7 rounded-full object-cover ring-1 ring-[hsl(var(--border))] shrink-0 mb-2"
          title={senderProfile.display_name}
          data-testid={`chat-sender-avatar-${message.sender_id}`}
        />
      )}
      {!isMe && !isBroadcast && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="mb-2 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full p-1 hover:bg-[hsl(var(--secondary))] transition-opacity"
              aria-label="Nachrichten-Optionen"
              data-testid={`chat-message-menu-${message.id}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setReportOpen(true); }} data-testid={`chat-report-message-${message.id}`}>
              Nachricht melden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div
        className={[
          "max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed shadow-[var(--shadow-sm)]",
          isBroadcast
            ? "bg-[hsl(var(--accent))]/10 ring-1 ring-[hsl(var(--accent))]/40 text-[hsl(var(--foreground))] rounded-[var(--radius-lg)]"
            : isMe
              ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] bubble-mine"
              : "bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] ring-1 ring-[hsl(var(--border))]/70 bubble-theirs",
        ].join(" ")}
        data-testid={isBroadcast ? "chat-broadcast-bubble" : "chat-bubble-content"}
      >
        {isBroadcast && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                message.broadcast_authentic
                  ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                  : "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]"
              }`}
              title={message.broadcast_authentic ? "HMAC-SHA256 signiert vom Eros-Team" : "Signatur ungültig"}
              data-testid="chat-authentic-seal"
            >
              <BadgeCheck className="h-3 w-3" /> {message.broadcast_authentic ? "Verifiziert" : "Ungültig"}
            </span>
            {message.broadcast_severity && message.broadcast_severity !== "info" && (
              <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--destructive))]">
                {message.broadcast_severity === "urgent" ? "Dringend" : "Warnung"}
              </span>
            )}
          </div>
        )}
        {/* Per-message sender label when the thread is couple-enabled and senders differ */}
        {!isBroadcast && showSenderLabel && senderProfile?.display_name && (
          <div
            className={`text-[10.5px] font-medium mb-0.5 ${isMe ? "opacity-80" : "text-[hsl(var(--accent))]"}`}
            data-testid={`chat-sender-label-${message.sender_id}`}
          >
            {senderProfile.display_name}
          </div>
        )}
        {bcTitle && <div className="font-display text-base mb-1">{bcTitle}</div>}
        {bcBody && (
          <div className="whitespace-pre-wrap" data-testid="chat-message-text">{bcBody}</div>
        )}
        {message.media_data_url && (
          <div className="mt-1.5 overflow-hidden rounded-[var(--radius-sm)]">
            <img src={message.media_data_url} alt="media" className={`max-h-64 w-auto ${isNsfw ? "blur-xl" : ""}`} />
            {isNsfw && <div className="text-[11px] opacity-80 mt-1">Sensibler Inhalt — tippe, um separat zu öffnen.</div>}
          </div>
        )}
        <div className={`mt-1 flex items-center gap-1.5 text-[10.5px] font-mono ${isMe && !isBroadcast ? "opacity-80 justify-end" : "text-[hsl(var(--muted-foreground))]"}`}>
          <span>{time}</span>
          {isBroadcast && message.broadcast_signature && (
            <span className="truncate opacity-70" title={`Signatur: ${message.broadcast_signature}`}>
              · sig {message.broadcast_signature.slice(0, 10)}…
            </span>
          )}
          {message.self_destruct_at && !isBroadcast && <><span>·</span><Clock className="h-3 w-3" /></>}
          {isMe && !isBroadcast && (
            isRead
              ? <CheckCheck className="h-3.5 w-3.5" aria-label="gelesen" data-testid="chat-read-receipt" />
              : <Check className="h-3.5 w-3.5" aria-label="gesendet" />
          )}
        </div>
      </div>
      {!isMe && !isBroadcast && (
        <ReportHiddenTrigger open={reportOpen} onOpenChange={setReportOpen} targetId={message.id} />
      )}
    </div>
  );
}

// Renders a ReportDialog without its trigger, controlled externally from the dropdown menu.
function ReportHiddenTrigger({ open, onOpenChange, targetId }) {
  if (!open) return null;
  return (
    <ReportDialog
      targetType="message"
      targetId={targetId}
      trigger={<span style={{ display: "none" }} />}
      _externalOpen={open}
      _externalOnOpenChange={onOpenChange}
    />
  );
}

function AcquaintanceRequestCard({ message, me, isMe, senders }) {
  const [status, setStatus] = useState(message.acquaintance_status || "pending");
  const [busy, setBusy] = useState(false);
  const selfIds = new Set([me?.id, me?.partner_user_id].filter(Boolean));
  const isRecipient = selfIds.has(message.acquaintance_target_id);
  const senderProfile = message.sender || senders[message.sender_id] || null;
  const requesterName = senderProfile?.display_name || "Jemand";

  const respond = async (action) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/acquaintances/${message.acquaintance_id}/respond`, { action });
      setStatus(data?.status || action === "confirm" ? "confirmed" : "rejected");
      toast.success(
        data?.status === "confirmed"
          ? "Bestätigt – ihr seid nun als persönlich bekannt markiert."
          : "Anfrage abgelehnt."
      );
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Konnte nicht gespeichert werden");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex justify-center my-2" data-testid={`acq-request-${message.acquaintance_id}`}>
      <div className="max-w-[92%] rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--accent))]/30 px-4 py-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 inline-grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] shrink-0">
            <Handshake className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-snug">
              {isRecipient
                ? `${requesterName} möchte dich als persönlich bekannt markieren.`
                : "Du hast eine Anfrage zur persönlichen Bekanntschaft gesendet."}
            </div>
            <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Diese Markierung wird auf beiden Profilen öffentlich sichtbar.
            </div>

            {status === "pending" && isRecipient && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => respond("confirm")}
                  disabled={busy}
                  className="rounded-full gap-1.5"
                  data-testid={`acq-confirm-${message.acquaintance_id}`}
                >
                  <UserCheck className="h-3.5 w-3.5" /> Bestätigen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond("reject")}
                  disabled={busy}
                  className="rounded-full gap-1.5"
                  data-testid={`acq-reject-${message.acquaintance_id}`}
                >
                  <X className="h-3.5 w-3.5" /> Ablehnen
                </Button>
              </div>
            )}
            {status === "pending" && !isRecipient && (
              <div className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]" data-testid={`acq-pending-${message.acquaintance_id}`}>
                Warten auf Antwort …
              </div>
            )}
            {status === "confirmed" && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/30 px-2 py-0.5 text-[11px] font-medium" data-testid={`acq-confirmed-${message.acquaintance_id}`}>
                <UserCheck className="h-3 w-3" /> Persönlich bekannt
              </div>
            )}
            {status === "rejected" && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] ring-1 ring-[hsl(var(--border))] px-2 py-0.5 text-[11px] font-medium" data-testid={`acq-rejected-${message.acquaintance_id}`}>
                <X className="h-3 w-3" /> Abgelehnt
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AcquaintanceResponseCard({ message }) {
  const confirmed = message.acquaintance_status === "confirmed";
  return (
    <div className="w-full flex justify-center my-1" data-testid={`acq-response-${message.acquaintance_id}`}>
      <div className={`rounded-full px-3 py-1 text-[11px] font-medium ring-1 ${
        confirmed
          ? "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] ring-[hsl(var(--accent))]/30"
          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] ring-[hsl(var(--border))]"
      }`}>
        {confirmed ? "✓ Als persönlich bekannt bestätigt" : "Anfrage abgelehnt"}
      </div>
    </div>
  );
}
