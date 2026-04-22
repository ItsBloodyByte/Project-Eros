import { format } from "date-fns";
import { Check, CheckCheck, Clock, MoreHorizontal, BadgeCheck } from "lucide-react";
import { ReportDialog } from "./ReportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useState } from "react";

export function ChatBubble({ message, me, senders = {}, showSenderLabel = false }) {
  // With couple-aware chats, "isMe" means either the viewing user OR their linked partner.
  const selfIds = new Set([me?.id, me?.partner_user_id].filter(Boolean));
  const isMe = selfIds.has(message.sender_id);
  const isBroadcast = !!message.is_broadcast;
  const time = message.created_at ? format(new Date(message.created_at), "HH:mm") : "";
  const isNsfw = message.media_data_url && (message.nsfw_score ?? 0) >= 0.75;
  const isRead = isMe && (message.read_by?.length || 0) > 1;
  const [reportOpen, setReportOpen] = useState(false);
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
