import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Handshake, UserCheck, Plus, UserRound } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

/**
 * "Persönlich bekannte Profile" section rendered on a public profile page.
 *
 * Props:
 *  - userId: the profile being viewed
 *  - viewerId: current authenticated user id (null if own profile)
 *  - isOwnProfile: true when the viewer is looking at themselves (hides request button)
 *  - targetDisplayName: used for the confirmation dialog copy
 *  - disableRequest: hide the request button completely (e.g. preview mode)
 */
export function AcquaintancesSection({ userId, viewerId, isOwnProfile = false, targetDisplayName = "", disableRequest = false }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ count: 0, users: [] });
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/users/${userId}/acquaintances`);
        if (active) setData(res.data || { count: 0, users: [] });
      } catch {
        if (active) setData({ count: 0, users: [] });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  const alreadyMarked = !!viewerId && data.users.some((u) => u.id === viewerId);

  const requestAcquaintance = async () => {
    if (!userId) return;
    setRequesting(true);
    try {
      await api.post("/acquaintances/request", { target_user_id: userId });
      toast.success(`Anfrage an ${targetDisplayName || "die Person"} verschickt. Sie erscheint als Chatnachricht.`);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Anfrage konnte nicht gesendet werden";
      toast.error(msg);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <section
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 sm:p-6 shadow-[var(--shadow-sm)]"
      data-testid="acquaintances-section"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="inline-grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]">
            <Handshake className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">Persönlich bekannt</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Beidseitig bestätigte Bekanntschaften ({data.count})
            </div>
          </div>
        </div>

        {!isOwnProfile && !disableRequest && (
          alreadyMarked ? (
            <div
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/30 px-3 py-1 text-xs font-medium"
              data-testid="acq-already-marked"
            >
              <UserCheck className="h-3.5 w-3.5" /> Ihr seid persönlich bekannt
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={requestAcquaintance}
              disabled={requesting}
              className="gap-1.5 rounded-full"
              data-testid="acq-request-button"
            >
              <Plus className="h-3.5 w-3.5" />
              {requesting ? "Wird gesendet …" : "Als persönlich bekannt markieren"}
            </Button>
          )
        )}
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-full bg-[hsl(var(--muted))] animate-pulse" />
          ))}
        </div>
      ) : data.users.length === 0 ? (
        <div
          className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[hsl(var(--border))] p-5 text-center text-sm text-[hsl(var(--muted-foreground))]"
          data-testid="acq-empty"
        >
          Noch keine bestätigten Bekanntschaften.
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3" data-testid="acq-list">
          {data.users.slice(0, 12).map((u) => {
            const photo = Array.isArray(u.photos) && u.photos.length > 0
              ? (u.photos[0].data || u.photos[0].url || null)
              : null;
            return (
              <Link
                key={u.id}
                to={`/profile/${u.id}`}
                title={u.display_name}
                className="group flex flex-col items-center gap-1.5 w-[64px] focus-visible:outline-none"
                data-testid={`acq-chip-${u.id}`}
              >
                <div className="h-14 w-14 rounded-full overflow-hidden ring-2 ring-[hsl(var(--border))] group-hover:ring-[hsl(var(--accent))]/60 transition-colors">
                  {photo ? (
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
                      <UserRound className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <span className="text-[11px] truncate w-full text-center text-[hsl(var(--foreground))]">
                  {u.display_name || "—"}
                </span>
              </Link>
            );
          })}
          {data.users.length > 12 && (
            <div className="flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
              +{data.users.length - 12} weitere
            </div>
          )}
        </div>
      )}
    </section>
  );
}
