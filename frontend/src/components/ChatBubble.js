import { format } from "date-fns";
import { Check, CheckCheck, Clock } from "lucide-react";

export function ChatBubble({ message, me }) {
  const isMe = message.sender_id === me?.id;
  const time = message.created_at ? format(new Date(message.created_at), "HH:mm") : "";
  const isNsfw = message.media_data_url && (message.nsfw_score ?? 0) >= 0.75;
  const isRead = isMe && (message.read_by?.length || 0) > 1;

  return (
    <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`} data-testid="chat-bubble">
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
    </div>
  );
}
