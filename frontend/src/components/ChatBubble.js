import { format } from "date-fns";
import { Check, CheckCheck, Clock, MoreHorizontal } from "lucide-react";
import { ReportDialog } from "./ReportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useState } from "react";

export function ChatBubble({ message, me }) {
  const isMe = message.sender_id === me?.id;
  const time = message.created_at ? format(new Date(message.created_at), "HH:mm") : "";
  const isNsfw = message.media_data_url && (message.nsfw_score ?? 0) >= 0.75;
  const isRead = isMe && (message.read_by?.length || 0) > 1;
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className={`group flex w-full items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`} data-testid="chat-bubble">
      {!isMe && (
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
          isMe
            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] bubble-mine"
            : "bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] ring-1 ring-[hsl(var(--border))]/70 bubble-theirs",
        ].join(" ")}
      >
        {message.text && (
          <div className="whitespace-pre-wrap" data-testid="chat-message-text">{message.text}</div>
        )}
        {message.media_data_url && (
          <div className="mt-1.5 overflow-hidden rounded-[var(--radius-sm)]">
            <img src={message.media_data_url} alt="media" className={`max-h-64 w-auto ${isNsfw ? "blur-xl" : ""}`} />
            {isNsfw && <div className="text-[11px] opacity-80 mt-1">Sensibler Inhalt — tippe, um separat zu öffnen.</div>}
          </div>
        )}
        <div className={`mt-1 flex items-center gap-1.5 text-[10.5px] font-mono ${isMe ? "opacity-80 justify-end" : "text-[hsl(var(--muted-foreground))]"}`}>
          <span>{time}</span>
          {message.self_destruct_at && <><span>·</span><Clock className="h-3 w-3" /></>}
          {isMe && (
            isRead
              ? <CheckCheck className="h-3.5 w-3.5" aria-label="gelesen" data-testid="chat-read-receipt" />
              : <Check className="h-3.5 w-3.5" aria-label="gesendet" />
          )}
        </div>
      </div>
      {!isMe && (
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
