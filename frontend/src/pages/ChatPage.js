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
import { Send, Paperclip, ArrowLeft, Timer, Shield, BadgeCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ReportDialog } from "../components/ReportDialog";
import { MoodBadge } from "../components/MoodBadge";

export default function ChatPage() {
  const { matchId } = useParams();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [peer, setPeer] = useState(null);
  const [matchMeta, setMatchMeta] = useState({ locked: false, system_match: false, locked_reason: null });
  const [senders, setSenders] = useState({});
  const [coupleMeta, setCoupleMeta] = useState({});
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
        setMatchMeta({ locked: !!m.locked, system_match: !!m.system_match, locked_reason: m.locked_reason || null });
        const res = await api.get(`/matches/${matchId}/messages`);
        setMessages(res.data.messages);
        setSenders(res.data.senders || {});
        setCoupleMeta(res.data.couple_meta || {});
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
            if (data.sender) {
              setSenders((prev) => ({ ...prev, [data.sender.id]: data.sender }));
            }
          } else if (data.type === "typing" && data.from !== user?.id) {
            setPeerTyping(Boolean(data.is_typing));
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
      const detail = e?.response?.data?.detail;
      toast.error(detail || "Nachricht konnte nicht gesendet werden");
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
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content h-screen flex flex-col">
        <AppHeader />
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-3 sm:px-4 pb-4">
          <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))]/60 mb-3">
            <Link to="/matches" className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors" data-testid="back-to-matches">
              <ArrowLeft className="h-4 w-4" /> Matches
            </Link>
            {peer && (
              (() => {
                const peerAvatar = Array.isArray(peer.photos) && peer.photos.length > 0
                  ? (peer.photos[0].data || peer.photos[0].url || null)
                  : null;
                const canLink = !peer.is_system && peer.id;
                const HeaderTag = canLink ? Link : "div";
                const headerProps = canLink
                  ? { to: `/profile/${peer.id}`, "data-testid": "chat-peer-profile-link",
                      "aria-label": `Profil von ${peer.display_name} öffnen` }
                  : {};
                return (
                  <HeaderTag
                    {...headerProps}
                    className={[
                      "flex items-center gap-2 rounded-full px-1.5 py-1 -mx-1.5 transition-colors",
                      canLink ? "hover:bg-[hsl(var(--secondary))] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" : "",
                    ].join(" ")}
                  >
                    {peerAvatar ? (
                      <img
                        src={peerAvatar}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover ring-1 ring-[hsl(var(--border))]"
                        data-testid="chat-peer-avatar"
                      />
                    ) : (
                      <span
                        className="h-8 w-8 rounded-full bg-[hsl(var(--secondary))] inline-flex items-center justify-center text-xs font-medium text-[hsl(var(--muted-foreground))] ring-1 ring-[hsl(var(--border))]"
                        data-testid="chat-peer-avatar-fallback"
                      >
                        {(peer.display_name || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="font-display text-lg tracking-tight leading-tight" data-testid="chat-peer-title">
                      {peer.display_name}
                      {peer.partner && (
                        <span className="text-[hsl(var(--muted-foreground))]"> &amp; {peer.partner.display_name}</span>
                      )}
                      {!peer.partner && peer.account_type === "duo" && peer.persona_b?.display_name && (
                        <span className="text-[hsl(var(--muted-foreground))]"> &amp; {peer.persona_b.display_name}</span>
                      )}
                    </div>
                    {(peer.partner || (peer.account_type === "duo" && peer.persona_b)) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40 px-2 py-0.5 text-[10.5px] font-medium" data-testid="chat-couple-badge">
                        Paar
                      </span>
                    )}
                    {peer.current_mood && (
                      <>
                        <span className="md:hidden">
                          <MoodBadge mood={peer.current_mood} iconOnly size="xs" testid="chat-peer-mood-mobile" />
                        </span>
                        <span className="hidden md:inline-flex">
                          <MoodBadge mood={peer.current_mood} size="xs" testid="chat-peer-mood" />
                        </span>
                      </>
                    )}
                    {peer.is_system && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] px-2 py-0.5 text-[10.5px] font-medium" data-testid="chat-official-badge" title="Offizielles Eros-Profil">
                        <BadgeCheck className="h-3 w-3" /> Offiziell
                      </span>
                    )}
                    {peer.is_online && !peer.is_system && <span className="online-dot" />}
                  </HeaderTag>
                );
              })()
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="chat-menu" className="gap-1"><Shield className="h-4 w-4" /> <span className="hidden sm:inline">Privatsphäre</span></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Chat-Privatsphäre</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 flex items-center justify-between text-sm">
                  <span>Lesebestätigungen</span>
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
                      trigger={<button className="w-full text-left text-sm">Nutzer melden</button>}
                    />
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-1 py-3 space-y-2.5" data-testid="chat-message-list">
            {(() => {
              // Show per-message sender label when the chat is couple-enabled on either side.
              const myIsCouple = (user?.partner_user_id) || coupleMeta?.user_a?.is_couple || coupleMeta?.user_b?.is_couple || (peer?.partner) || (peer?.account_type === "duo");
              return messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  me={user}
                  senders={senders}
                  showSenderLabel={!!myIsCouple}
                />
              ));
            })()}
            {peerTyping && <div className="text-xs text-[hsl(var(--muted-foreground))] pl-2">tippt …</div>}
            {messages.length === 0 && <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-16">Schreib hallo — sei warm und konkret.</div>}
          </div>

          {matchMeta.locked ? (
            <div
              className="mt-3 rounded-[var(--radius-lg)] bg-[hsl(var(--accent))]/10 ring-1 ring-[hsl(var(--accent))]/30 p-4 flex items-start gap-3"
              data-testid="chat-locked-banner"
            >
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-[hsl(var(--accent))]" />
              <div className="text-sm">
                <div className="font-medium text-[hsl(var(--foreground))]">Offizielle Mitteilung — du kannst hierauf nicht antworten</div>
                <div className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">
                  Dieses Gespräch stammt vom verifizierten Eros-Team. Bei Fragen wende dich bitte an den Support.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={selfDestruct} onCheckedChange={setSelfDestruct} data-testid="self-destruct-toggle" />
                  <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> Selbstzerstörung nach 60 s</span>
                </Label>
              </div>

              <div className="mt-2 flex items-end gap-2 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-2 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendMedia(e.target.files[0])} data-testid="chat-media-input" />
                <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} data-testid="chat-attach-button"><Paperclip className="h-4 w-4" /></Button>
                <Textarea
                  value={text}
                  rows={1}
                  className="min-h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 resize-none"
                  onChange={(e) => { setText(e.target.value); setTyping(true); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Nachricht schreiben …"
                  data-testid="chat-text-input"
                />
                <Button onClick={send} data-testid="chat-send-button" className="gap-1 rounded-full"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
