import { useRef, useState } from "react";
import { Camera, X, Lock, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { toast } from "sonner";

/**
 * Pic4PicPanel — sealed bidirectional photo exchange inside a chat.
 *
 * Backend endpoints (already implemented):
 *   POST /api/pic4pic/initiate            { match_id, data_url }
 *   POST /api/pic4pic/respond             { exchange_id, data_url }
 *   POST /api/pic4pic/cancel              { exchange_id }
 *   GET  /api/pic4pic/match/{match_id}    -> { exchange | null }
 *
 * State machine for the panel (driven by `exchange` from the GET endpoint):
 *  - null / cancelled / expired / completed → "Start Pic4Pic" idle row
 *  - pending + initiator                    → "Waiting for response" row + cancel
 *  - pending + recipient                    → "Sealed photo waiting" row + respond + cancel
 *
 * The panel never shows the partner's bytes itself — the actual photos are
 * delivered via two `kind=pic4pic_photo` chat messages (each carrying a
 * `media_data_url`) that are rendered by the regular `ChatBubble`.
 */
export function Pic4PicPanel({ exchange, matchId, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const status = exchange?.status || null;
  const role = exchange?.your_role || null;

  // Convert browser File → data URL (the backend expects a data: prefix)
  const fileToDataUrl = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const handleFile = async (file) => {
    if (!file) return;
    // 6 MB hard cap on the client; server compresses but we want to fail
    // fast for obviously oversized uploads.
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Bild zu groß (max. 6 MB).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (status === "pending" && role === "recipient" && exchange?.id) {
        await api.post("/pic4pic/respond", { exchange_id: exchange.id, data_url: dataUrl });
        toast.success("Antwort gesendet — beide Fotos sind jetzt im Chat sichtbar.");
      } else {
        await api.post("/pic4pic/initiate", { match_id: matchId, data_url: dataUrl });
        toast.success("Foto versiegelt – warte auf Antwort.");
      }
      onChange?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(detail || "Pic4Pic fehlgeschlagen");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const cancel = async () => {
    if (!exchange?.id) return;
    setBusy(true);
    try {
      await api.post("/pic4pic/cancel", { exchange_id: exchange.id });
      toast.success("Bildertausch abgebrochen.");
      onChange?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Abbruch fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  // Idle state — "Start Pic4Pic" CTA
  if (!status || status === "completed" || status === "cancelled" || status === "expired") {
    return (
      <div
        className="mb-2 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[hsl(var(--secondary))]/40 ring-1 ring-[hsl(var(--border))] px-3 py-2"
        data-testid="pic4pic-panel-idle"
      >
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <ShieldCheck className="h-4 w-4 text-[hsl(var(--accent))]" />
          <span>
            <span className="font-medium text-[hsl(var(--foreground))]">Pic4Pic</span> — sicherer
            Foto-Tausch. Beide Bilder werden erst sichtbar, wenn auch die Gegenseite eines schickt.
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          data-testid="pic4pic-file-input"
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          data-testid="pic4pic-start-btn"
        >
          <Camera className="h-3.5 w-3.5" /> Pic4Pic starten
        </Button>
      </div>
    );
  }

  // Pending — show role-specific state
  if (status === "pending") {
    const isRecipient = role === "recipient";
    return (
      <div
        className="mb-2 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[hsl(var(--accent))]/10 ring-1 ring-[hsl(var(--accent))]/40 px-3 py-2"
        data-testid="pic4pic-panel-pending"
      >
        <div className="flex items-center gap-2 text-xs">
          <Lock className="h-4 w-4 text-[hsl(var(--accent))]" />
          <span className="text-[hsl(var(--foreground))]">
            {isRecipient ? (
              <>
                <span className="font-medium">Versiegeltes Foto wartet auf dich.</span>{" "}
                <span className="text-[hsl(var(--muted-foreground))]">
                  Sende dein eigenes Foto, um beide gleichzeitig zu sehen.
                </span>
              </>
            ) : (
              <>
                <span className="font-medium">Dein Foto ist versiegelt.</span>{" "}
                <span className="text-[hsl(var(--muted-foreground))]">
                  Du erhältst die Antwort, sobald die Gegenseite ein Foto sendet.
                </span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRecipient && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
                data-testid="pic4pic-respond-input"
              />
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={disabled || busy}
                data-testid="pic4pic-respond-btn"
              >
                <Camera className="h-3.5 w-3.5" /> Antworten
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
            onClick={cancel}
            disabled={disabled || busy}
            data-testid="pic4pic-cancel-btn"
            title="Tausch abbrechen"
          >
            {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
