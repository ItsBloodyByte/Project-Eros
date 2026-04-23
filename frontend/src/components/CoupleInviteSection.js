import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Heart, Users, Link2Off, Check, X } from "lucide-react";
import { Button } from "./ui/button";

/**
 * CoupleInviteSection — profile-page equivalent of AcquaintancesSection
 * for "Als Partner verknüpfen". Uses the bilateral in-app invite flow
 * (chat system message + Accept/Decline), NOT email.
 *
 * Props:
 *  - profile: the profile being viewed (must contain id, display_name,
 *             account_type, partner_user_id, allow_couple_invites)
 *  - me: current authenticated user object
 *  - previewMode: true when viewed as a preview (disables all actions)
 */
export function CoupleInviteSection({ profile, me, previewMode = false }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // { id, direction: "incoming"|"outgoing" }
  const [dismissed, setDismissed] = useState(false);

  const isOwnProfile = previewMode || !me || profile.id === me.id;
  const viewerIsDuo = me?.account_type === "duo";
  const viewerHasPartner = !!me?.partner_user_id;
  const targetIsDuo = profile.account_type === "duo";
  const targetHasPartner = !!profile.partner_user_id;
  const targetOptedOut = profile.allow_couple_invites === false;

  const canInvite =
    !isOwnProfile && !previewMode &&
    !viewerIsDuo && !viewerHasPartner &&
    !targetIsDuo && !targetHasPartner && !targetOptedOut;

  // Check for an existing pending invite between us.
  useEffect(() => {
    if (!me || isOwnProfile) return;
    let active = true;
    (async () => {
      try {
        const { data } = await api.get("/couples/invites");
        const outgoing = (data.outgoing || []).find((i) => i.to_user_id === profile.id);
        const incoming = (data.incoming || []).find((i) => i.from_user_id === profile.id);
        if (!active) return;
        if (outgoing) setPending({ id: outgoing.id, direction: "outgoing" });
        else if (incoming) setPending({ id: incoming.id, direction: "incoming" });
        else setPending(null);
      } catch { /* silent */ }
    })();
    return () => { active = false; };
  }, [me, profile.id, isOwnProfile]);

  const sendInvite = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/couples/invite", { user_id: profile.id });
      toast.success(data.already_pending
        ? "Es besteht bereits eine offene Einladung."
        : `Einladung an ${profile.display_name || "die Person"} verschickt. Sie erscheint als Chatnachricht.`);
      setPending({ id: data.invite_id, direction: "outgoing" });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Einladung konnte nicht gesendet werden");
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!pending?.id) return;
    setBusy(true);
    try {
      await api.delete(`/couples/invites/${pending.id}`);
      toast.success("Einladung zurückgezogen");
      setPending(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const respond = async (action) => {
    if (!pending?.id) return;
    setBusy(true);
    try {
      await api.post(`/couples/invites/${pending.id}/${action}`);
      toast.success(action === "accept" ? "Partnerprofile verknüpft!" : "Einladung abgelehnt.");
      setPending(null);
      if (action === "accept") {
        // Full reload so AuthContext picks up the new partner.
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehlgeschlagen");
    } finally { setBusy(false); }
  };

  // Hide the section entirely when nothing meaningful can be shown.
  if (isOwnProfile) return null;
  if (dismissed) return null;
  const showAnything =
    canInvite || pending || targetHasPartner || targetIsDuo || viewerHasPartner || viewerIsDuo || targetOptedOut;
  if (!showAnything) return null;

  return (
    <section
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 sm:p-6 shadow-[var(--shadow-sm)]"
      data-testid="couple-invite-section"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="inline-grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">Partner verknüpfen</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Beide Konten bilden ein gemeinsames Paarprofil.
            </div>
          </div>
        </div>

        {/* Action area — mirrors AcquaintancesSection layout */}
        <div className="flex items-center gap-2">
          {pending?.direction === "outgoing" && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] ring-1 ring-[hsl(var(--border))] px-3 py-1 text-xs font-medium" data-testid="couple-invite-pending-outgoing">
                Einladung offen
              </span>
              <Button size="sm" variant="outline" onClick={revoke} disabled={busy} data-testid="couple-invite-revoke" className="gap-1">
                <Link2Off className="h-3.5 w-3.5" /> Zurückziehen
              </Button>
            </>
          )}
          {pending?.direction === "incoming" && (
            <>
              <Button size="sm" onClick={() => respond("accept")} disabled={busy} data-testid="couple-invite-accept" className="gap-1">
                <Check className="h-3.5 w-3.5" /> Annehmen
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond("decline")} disabled={busy} data-testid="couple-invite-decline" className="gap-1">
                <X className="h-3.5 w-3.5" /> Ablehnen
              </Button>
            </>
          )}
          {!pending && canInvite && (
            <Button size="sm" onClick={sendInvite} disabled={busy} data-testid="couple-invite-request" className="gap-1">
              <Heart className="h-3.5 w-3.5" /> Als Partner verknüpfen
            </Button>
          )}
        </div>
      </div>

      {/* Reason pills — explain why the button is hidden, in plain German. */}
      {!pending && !canInvite && (
        <div className="mt-3 text-[12px] text-[hsl(var(--muted-foreground))]" data-testid="couple-invite-reason">
          {targetIsDuo && "Dieses Profil ist bereits ein Paar-Account."}
          {!targetIsDuo && targetHasPartner && "Dieses Profil ist bereits mit jemandem verknüpft."}
          {!targetIsDuo && !targetHasPartner && viewerIsDuo && "Du bist bereits Teil eines Paar-Accounts."}
          {!targetIsDuo && !targetHasPartner && !viewerIsDuo && viewerHasPartner && "Du bist bereits mit einem Partner verknüpft."}
          {!targetIsDuo && !targetHasPartner && !viewerIsDuo && !viewerHasPartner && targetOptedOut &&
            "Diese:r Nutzer:in hat Partner-Einladungen deaktiviert."}
        </div>
      )}
    </section>
  );
}

export default CoupleInviteSection;
