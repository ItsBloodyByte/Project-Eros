import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Eye, ShieldCheck } from "lucide-react";
import { NsfwBlurOverlay } from "./NsfwBlurOverlay";

export function ProfileCard({ user, visited = false }) {
  const [revealed, setRevealed] = useState(false);
  const primary = (user.photos || []).find((p) => p.is_primary) || (user.photos || [])[0];
  const isNsfw = primary && primary.nsfw_score >= 0.75;

  return (
    <Link
      to={`/profile/${user.id}`}
      data-testid="profile-card"
      className="group relative block overflow-hidden rounded-[var(--radius-md)] border bg-card shadow-[var(--shadow-sm)] hover:border-[hsl(var(--accent))]/40 transition-colors"
    >
      <div className="aspect-[3/4] w-full relative bg-[hsl(var(--muted))]">
        {primary ? (
          <NsfwBlurOverlay
            active={isNsfw}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            className="h-full w-full"
          >
            <img
              src={primary.data}
              alt={user.display_name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          </NsfwBlurOverlay>
        ) : (
          <div className="h-full w-full grid place-items-center text-sm text-[hsl(var(--muted-foreground))]">
            No photo
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {user.id_verified && (
            <div className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))]/85 px-2 py-0.5 text-[11px] text-[hsl(var(--accent-foreground))] backdrop-blur" title="ID verifiziert">
              <ShieldCheck className="h-3 w-3" /> ID
            </div>
          )}
          {user.verified && !user.id_verified && (
            <div className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur">
              <BadgeCheck className="h-3 w-3" /> verified
            </div>
          )}
        </div>

        {user.boosted && (
          <div className="absolute left-2 bottom-14 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))]/85 px-2 py-0.5 text-[11px] text-[hsl(var(--accent-foreground))]" data-testid="profile-card-boosted">
            boosted
          </div>
        )}

        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {visited && (
            <div
              className="inline-grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
              title="Bereits angesehen"
              data-testid="profile-card-visited-eye"
            >
              <Eye className="h-3.5 w-3.5" />
            </div>
          )}
          {user.is_online && (
            <div
              className="online-dot"
              title="Online now"
              data-testid="profile-card-online-indicator"
            />
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <div className="font-display text-lg leading-tight">
            {user.display_name}
            <span className="ml-1.5 text-white/80 text-sm font-body">{user.age}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-white/85">
            {user.pronouns && <span>{user.pronouns}</span>}
            {typeof user.distance_km === "number" && (
              <span
                className="inline-flex items-center gap-1"
                data-testid="profile-card-distance-text"
              >
                <MapPin className="h-3 w-3" /> ~{user.distance_km} km
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
