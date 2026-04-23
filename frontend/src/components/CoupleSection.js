import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Heart, UserPlus, X, Check, Unlink2, Mail } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";

/**
 * CoupleSection — lets the user invite another Eros account to link profiles,
 * accept/decline incoming invites, and unlink an existing partner.
 */
export function CoupleSection() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null); // { account_type, couple_id, partner, persona_b }
  const [invites, setInvites] = useState({ incoming: [], outgoing: [] });
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = async () => {
    try {
      const [{ data: m }, { data: iv }] = await Promise.all([
        api.get("/couples/me"),
        api.get("/couples/invites"),
      ]);
      setData(m);
      setInvites(iv);
    } catch (e) {
      /* noop */
    }
  };
  useEffect(() => { load(); }, [user?.id]);

  const invite = async () => {
    const val = inviteEmail.trim();
    if (!val) return;
    setBusy(true);
    try {
      const payload = val.includes("@") ? { email: val } : { user_id: val };
      await api.post("/couples/invite", payload);
      toast.success("Einladung gesendet");
      setInviteEmail("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Einladung fehlgeschlagen");
    } finally { setBusy(false); }
  };
  const accept = async (id) => {
    setBusy(true);
    try {
      await api.post(`/couples/invites/${id}/accept`);
      toast.success("Verknüpft");
      await refresh(); await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
    finally { setBusy(false); }
  };
  const decline = async (id) => {
    try {
      await api.post(`/couples/invites/${id}/decline`);
      toast.success("Abgelehnt");
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };
  const revoke = async (id) => {
    try {
      await api.delete(`/couples/invites/${id}`);
      toast.success("Einladung zurückgezogen");
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };
  const unlink = async () => {
    try {
      await api.post("/couples/unlink");
      toast.success("Partner-Verknüpfung aufgehoben");
      setConfirmUnlink(false);
      await refresh(); await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };

  if (!data) {
    return (
      <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6">
        <div className="text-sm text-[hsl(var(--muted-foreground))]">Lade Paar-Daten …</div>
      </section>
    );
  }

  const isDuo = data.account_type === "duo";
  const isLinked = !!data.partner;

  return (
    <section
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)]"
      data-testid="couple-section"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg flex items-center gap-2">
            <Heart className="h-4 w-4 text-[hsl(var(--accent))]" /> Partner-Profil
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {isDuo && "Dein Konto ist ein Paar-Account (beide Personen im selben Login)."}
            {!isDuo && isLinked && "Du bist mit einem zweiten Konto verknüpft."}
            {!isDuo && !isLinked && "Verknüpfe dich mit einem Partner-Konto oder lade jemanden ein."}
          </div>
        </div>
        {(isDuo || isLinked) && (
          <Badge className="gap-1 bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40">
            {isDuo ? "Paar-Account" : "Verknüpft"}
          </Badge>
        )}
      </div>

      {/* Linked partner info */}
      {isLinked && (
        <div className="flex items-center gap-3 rounded-md border p-3" data-testid="couple-partner-card">
          <div className="h-12 w-12 rounded-full bg-[hsl(var(--muted))] overflow-hidden grid place-items-center text-xs">
            {(data.partner.photos && data.partner.photos[0]?.data) ? (
              <img src={data.partner.photos[0].data} alt={data.partner.display_name} className="h-full w-full object-cover" />
            ) : (
              <span>{(data.partner.display_name || "?").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium">{data.partner.display_name}</div>
            <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {data.partner.gender_identity} · {data.partner.age} J.
            </div>
          </div>
          <Button size="sm" variant="destructive" className="gap-1" onClick={() => setConfirmUnlink(true)} data-testid="couple-unlink">
            <Unlink2 className="h-4 w-4" /> Aufheben
          </Button>
        </div>
      )}

      {/* Persona B (single-account duo) */}
      {isDuo && data.persona_b && (
        <div className="rounded-md border p-3" data-testid="couple-persona-b-card">
          <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Person B</div>
          <div className="font-medium">{data.persona_b.display_name}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
            {data.persona_b.gender_identity} · {data.persona_b.age ? `${data.persona_b.age} J.` : "Alter nicht gesetzt"}
          </div>
          {data.persona_b.bio && <div className="text-sm mt-1.5 text-[hsl(var(--muted-foreground))]">{data.persona_b.bio}</div>}
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2">
            Bearbeite Person B im Profil-Editor ("Mein Profil" → Tab "Person B").
          </div>
        </div>
      )}

      {/* Incoming invites */}
      {invites.incoming?.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Eingehende Einladungen</div>
          {invites.incoming.map((iv) => (
            <div key={iv.id} className="flex items-center gap-2 rounded-md border p-3" data-testid={`couple-invite-incoming-${iv.id}`}>
              <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <div className="flex-1">
                <div className="text-sm">
                  <strong>{iv.from_display_name}</strong> möchte sich mit dir als Paar verknüpfen.
                </div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{new Date(iv.created_at).toLocaleString()}</div>
              </div>
              <Button size="sm" className="gap-1" onClick={() => accept(iv.id)} disabled={busy} data-testid={`couple-invite-accept-${iv.id}`}>
                <Check className="h-4 w-4" /> Annehmen
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => decline(iv.id)} data-testid={`couple-invite-decline-${iv.id}`}>
                <X className="h-4 w-4" /> Ablehnen
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Outgoing invites */}
      {invites.outgoing?.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Ausgehende Einladungen (wartend)</div>
          {invites.outgoing.map((iv) => (
            <div key={iv.id} className="flex items-center gap-2 rounded-md border p-3" data-testid={`couple-invite-outgoing-${iv.id}`}>
              <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <div className="flex-1">
                <div className="text-sm">
                  An <strong>{iv.to_display_name}</strong> gesendet — wartet auf Bestätigung.
                </div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{new Date(iv.created_at).toLocaleString()}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke(iv.id)}>Zurückziehen</Button>
            </div>
          ))}
        </div>
      )}

      {/* Invite hint — the actual invitation is triggered from the partner's profile page. */}
      {!isDuo && !isLinked && (
        <div className="rounded-md border-2 border-dashed p-4 space-y-2">
          <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Partner einladen</Label>
          <p className="text-sm leading-relaxed">
            Öffne das Profil deines Partners in der App und klicke dort auf
            <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/30 px-2 py-0.5 text-xs font-medium align-middle">
              <Heart className="h-3 w-3" /> Als Partner verknüpfen
            </span>
            . Die Einladung erscheint anschließend hier <em>und</em> als Chatnachricht auf beiden Seiten.
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Kein E-Mail-Versand — beide Konten müssen bereits bei Eros existieren.
          </p>
        </div>
      )}

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partner-Verknüpfung aufheben?</AlertDialogTitle>
            <AlertDialogDescription>
              Beide Konten werden wieder getrennt. Bestehende Matches und Chats bleiben bei demjenigen erhalten,
              der sie ursprünglich ausgelöst hat. Die Aktion kann später wieder rückgängig gemacht werden,
              indem ihr euch erneut verknüpft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={unlink} data-testid="couple-unlink-confirm">Verknüpfung aufheben</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default CoupleSection;
