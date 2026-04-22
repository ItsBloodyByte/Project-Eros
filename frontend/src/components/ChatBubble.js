import { format } from "date-fns";

export function ChatBubble({ message, me }) {
  const isMe = message.sender_id === me?.id;
  const time = message.created_at
    ? format(new Date(message.created_at), "HH:mm")
    : "";
  const isNsfw = message.media_data_url && (message.nsfw_score ?? 0) >= 0.75;

  return (
    <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`} data-testid="chat-bubble">
      <div
        className={`max-w-[78%] rounded-[20px] px-3 py-2 shadow-sm ${
          isMe
            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
            : "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
        }`}
      >
        {message.text && (
          <div className="text-sm whitespace-pre-wrap" data-testid="chat-message-text">{message.text}</div>
        )}
        {message.media_data_url && (
          <div className="mt-1 overflow-hidden rounded-md">
            <img
              src={message.media_data_url}
              alt="media"
              className={`max-h-64 w-auto ${isNsfw ? "blur-xl" : ""}`}
            />
            {isNsfw && (
              <div className="text-[11px] opacity-80 mt-1">Sensitive media — tap to open separately.</div>
            )}
          </div>
        )}
        <div className="mt-1 text-[11px] opacity-70 font-mono flex items-center gap-2">
          <span>{time}</span>
          {isMe && (message.read_by?.length || 0) > 1 && (
            <span data-testid="chat-read-receipt">· read</span>
          )}
          {message.self_destruct_at && <span>· self-destruct</span>}
        </div>
      </div>
    </div>
  );
}
