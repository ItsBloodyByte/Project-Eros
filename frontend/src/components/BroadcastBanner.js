import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { BadgeCheck, X, AlertTriangle, Megaphone, Pin } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

/**
 * Shows unread authenticated platform broadcasts to signed-in users.
 * Pinned broadcasts appear as a persistent bar at the top; urgent/warning ones open a modal.
 */
export function BroadcastBanner() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get("/me/broadcasts", { params: { unread_only: true, limit: 10 } });
        if (cancelled) return;
        setList(data.broadcasts || []);
        const urgent = (data.broadcasts || []).find((b) => b.severity === "urgent" || b.severity === "warning");
        if (urgent) setFocused(urgent);
      } catch {}
    };
    load();
    const t = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user?.id]);

  const ack = async (b) => {
    try {
      await api.post(`/me/broadcasts/${b.id}/ack`);
      setList((l) => l.filter((x) => x.id !== b.id));
      if (focused?.id === b.id) setFocused(null);
    } catch {}
  };

  if (!user) return null;
  const visibleBar = list.find((b) => b.pinned && b.severity !== "urgent");

  return (
    <>
      {visibleBar && (
        <div
          data-testid="broadcast-banner-pinned"
          className={[
            "w-full px-4 py-2.5 text-sm flex items-center gap-2 border-b",
            visibleBar.severity === "warning"
              ? "bg-[hsl(var(--destructive))]/10 border-[hsl(var(--destructive))]/40 text-[hsl(var(--destructive))]"
              : "bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/40 text-[hsl(var(--accent-foreground))]",
          ].join(" ")}
        >
          <AuthenticSeal authentic={!!visibleBar.authentic} />
          <Megaphone className="h-4 w-4 shrink-0" />
          <span className="font-medium">{visibleBar.title}</span>
          <span className="truncate text-[hsl(var(--foreground))]/90 hidden sm:inline">— {visibleBar.body.slice(0, 140)}{visibleBar.body.length > 140 ? "…" : ""}</span>
          <button className="ml-auto text-xs underline opacity-90 hover:opacity-100" onClick={() => setFocused(visibleBar)} data-testid="broadcast-banner-open">Mehr</button>
          <button className="rounded-full p-1 hover:bg-black/5" onClick={() => ack(visibleBar)} aria-label="Schliessen"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <Dialog open={!!focused} onOpenChange={(v) => { if (!v) setFocused(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              {focused?.severity === "warning" && <AlertTriangle className="h-5 w-5 text-[hsl(var(--destructive))]" />}
              {focused?.severity === "urgent" && <AlertTriangle className="h-5 w-5 text-[hsl(var(--destructive))]" />}
              {focused?.severity === "info" && <Megaphone className="h-5 w-5 text-[hsl(var(--accent))]" />}
              {focused?.title}
            </DialogTitle>
          </DialogHeader>
          {focused && (
            <div className="space-y-4">
              {/* Authenticity seal */}
              <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 px-3 py-2">
                <AuthenticSeal authentic={!!focused.authentic} large />
                <div className="text-xs leading-tight">
                  <div className="font-medium text-[hsl(var(--foreground))]">
                    {focused.authentic ? "Verifizierte offizielle Mitteilung" : "⚠ Signatur konnte nicht verifiziert werden"}
                  </div>
                  <div className="text-[hsl(var(--muted-foreground))]">
                    Gesendet von {focused.author?.display_name || "Eros-Team"} · Rolle: {focused.author?.role || "admin"}
                    {focused.pinned && <> · <Pin className="h-3 w-3 inline" /> angeheftet</>}
                  </div>
                </div>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="broadcast-dialog-body">{focused.body}</div>

              <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] break-all">
                Signatur: {focused.signature?.slice(0, 32)}…
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => focused && ack(focused)} data-testid="broadcast-dialog-ack">Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AuthenticSeal({ authentic, large }) {
  return (
    <span
      data-testid="broadcast-authentic-seal"
      title={authentic ? "Authentisch signierte Mitteilung vom Eros-Team" : "Signatur konnte nicht verifiziert werden"}
      className={[
        "inline-flex items-center gap-1 rounded-full font-medium",
        large ? "h-7 px-2 text-[11px]" : "h-5 px-1.5 text-[10px]",
        authentic
          ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
          : "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] ring-1 ring-[hsl(var(--destructive))]/40",
      ].join(" ")}
    >
      <BadgeCheck className={large ? "h-4 w-4" : "h-3 w-3"} />
      {authentic ? "Verifiziert" : "Ungültig"}
    </span>
  );
}
