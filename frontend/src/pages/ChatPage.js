import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, getStoredToken, wsChatUrl } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { ChatBubble } from "../components/ChatBubble";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Send, Paperclip, ArrowLeft, Timer, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ReportDialog } from "../components/ReportDialog";

export default function ChatPage() {
  const { matchId } = useParams();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [peer, setPeer] = useState(null);
  const [typing, setTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const wsRef = useRef(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/matches");
        const m = data.matches.find((x) => x.id === matchId);
        if (!m) { toast.error("Match not found"); nav("/matches"); return; }
        setPeer(m.user);
        const res = await api.get(`/matches/${matchId}/messages`);
        setMessages(res.data.messages);
      } catch (e) {
        toast.error("Failed to load chat");
      }
    })();
  }, [matchId, nav]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    let ws;
    try {
      ws = new WebSocket(wsChatUrl(matchId, token));
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "message") {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
          } else if (data.type === "typing" && data.from !== user?.id) {
            setPeerTyping(Boolean(data.is_typing));
          } else if (data.type === "screenshot" && data.from !== user?.id) {
            toast.info("Someone took a screenshot of this chat.");
          }
        } catch {}
      };
    } catch {}
    return () => { try { ws && ws.close(); } catch {} };
  }, [matchId, user?.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, peerTyping]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      await api.post("/messages", {
        match_id: matchId,
        text: text.trim(),
        self_destruct_seconds: selfDestruct ? 60 : null,
      });
      setText("");
    } catch (e) {
      toast.error("Send failed");
    }
  };

  const emitTyping = (flag) => {
    try { wsRef.current?.send(JSON.stringify({ type: "typing", is_typing: flag })); } catch {}
  };

  useEffect(() => {
    if (!typing) return;
    emitTyping(true);
    const t = setTimeout(() => { setTyping(false); emitTyping(false); }, 1500);
    return () => clearTimeout(t);
  }, [typing, text]);

  const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

  const sendMedia = async (file) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      await api.post("/messages", {
        match_id: matchId,
        media_data_url: dataUrl,
        self_destruct_seconds: selfDestruct ? 60 : null,
      });
    } catch (e) {
      toast.error("Media send failed");
    }
  };

  const toggleReadReceipts = async (val) => {
    await api.patch("/me/chat-prefs", { read_receipts: val });
    await refresh();
  };

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content h-screen flex flex-col">
        <AppHeader />
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-2 sm:px-4 pb-4">
          <div className="flex items-center justify-between py-3">
            <Link to="/matches" className="inline-flex items-center gap-1 text-sm underline text-[hsl(var(--muted-foreground))]" data-testid="back-to-matches">
              <ArrowLeft className="h-4 w-4" /> Matches
            </Link>
            {peer && (
              <div className="flex items-center gap-2">
                <div className="font-display text-lg">{peer.display_name}</div>
                {peer.is_online && <span className="online-dot" />}
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="chat-menu"><Shield className="h-4 w-4 mr-1" /> Privacy</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Chat privacy</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 flex items-center justify-between text-sm">
                  <span>Read receipts</span>
                  <Switch
                    checked={user?.privacy?.read_receipts ?? true}
                    onCheckedChange={toggleReadReceipts}
                    data-testid="chat-read-receipts-toggle"
                  />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <div className="w-full">
                    <ReportDialog
                      targetType="user"
                      targetId={peer?.id}
                      trigger={<button className="w-full text-left text-sm">Report user</button>}
                    />
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto rounded-md border bg-card p-3 space-y-2" data-testid="chat-message-list">
            {messages.map((m) => <ChatBubble key={m.id} message={m} me={user} />)}
            {peerTyping && <div className="text-xs text-[hsl(var(--muted-foreground))]">typing…</div>}
            {messages.length === 0 && <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-10">Say hi — be warm and specific.</div>}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Label className="flex items-center gap-2">
              <Switch checked={selfDestruct} onCheckedChange={setSelfDestruct} data-testid="self-destruct-toggle" />
              <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> Self-destruct 60s</span>
            </Label>
          </div>

          <div className="mt-2 flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendMedia(e.target.files[0])} data-testid="chat-media-input" />
            <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} data-testid="chat-attach-button"><Paperclip className="h-4 w-4" /></Button>
            <Textarea
              value={text}
              rows={1}
              className="min-h-10"
              onChange={(e) => { setText(e.target.value); setTyping(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Write a message"
              data-testid="chat-text-input"
            />
            <Button onClick={send} data-testid="chat-send-button" className="gap-1"><Send className="h-4 w-4" /> Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
