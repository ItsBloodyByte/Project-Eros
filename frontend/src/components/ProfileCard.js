import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Eye, ShieldCheck } from "lucide-react";
import { NsfwBlurOverlay } from "./NsfwBlurOverlay";
import { RoleBadge } from "./RoleBadge";

export function ProfileCard({ user, visited = false }) {
  const [revealed, setRevealed] = useState(false);
  const primary = (user.photos || []).find((p) => p.is_primary) || (user.photos || [])[0];
  const isNsfw = primary && primary.nsfw_score >= 0.75;

  return (
    <Link
      to={`/profile/${user.id}`}
      data-testid="profile-card"
      className="group relative block overflow-hidden rounded-[var(--radius-lg)] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60 card-hover"
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
              className="h-full w-full object-cover"
            />
          </NsfwBlurOverlay>
        ) : (
          <div className="h-full w-full grid place-items-center text-xs text-[hsl(var(--muted-foreground))]">
            Kein Foto
          </div>
        )}

        {/* Subtle bottom scrim for text legibility */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Top-left badges — only ID-verified users get a visible badge */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1">
          {user.id_verified && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--verified))]/90 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm"
              title="ID verifiziert"
              data-testid="profile-card-id-badge"
            >
              <ShieldCheck className="h-3 w-3" /> ID
            </span>
          )}
          {/* Admin-mode diagnostic flags */}
          {user.admin_flags?.banned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--destructive))] text-white px-2 py-0.5 text-[10.5px] font-medium" data-testid="profile-admin-flag-banned">gebannt</span>
          )}
          {user.admin_flags?.hidden_mode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 text-white px-2 py-0.5 text-[10.5px] font-medium">versteckt</span>
          )}
          {user.admin_flags?.shadow_restricted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 text-white px-2 py-0.5 text-[10.5px] font-medium">shadow</span>
          )}
          {user.admin_flags?.role && user.admin_flags.role !== "user" && (
            <RoleBadge role={user.admin_flags.role} size="xs" />
          )}
        </div>

        {/* Top-right state */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          {visited && (
            <span
              className="inline-grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"
              title="Bereits angesehen"
              data-testid="profile-card-visited-eye"
            >
              <Eye className="h-3.5 w-3.5" />
            </span>
          )}
          {user.is_online && (
            <span className="online-dot" title="Gerade online" data-testid="profile-card-online-indicator" />
          )}
        </div>

        {/* Boosted ribbon */}
        {user.boosted && (
          <div
            className="absolute left-2.5 bottom-20 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-sm)]"
            data-testid="profile-card-boosted"
          >
            boosted
          </div>
        )}

        {/* Bottom info overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
          <div className="font-display text-xl leading-tight tracking-tight">
            {user.display_name}
            <span className="ml-1.5 text-white/80 text-[13px] font-sans font-normal">{user.age}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11.5px] text-white/85">
            {user.city && (
              <span
                className="inline-flex items-center gap-1 truncate"
                data-testid="profile-card-city"
                title={user.city}
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{user.city}</span>
              </span>
            )}
            {typeof user.distance_km === "number" && (
              <span
                className="inline-flex items-center gap-1 shrink-0"
                data-testid="profile-card-distance-text"
              >
                {!user.city && <MapPin className="h-3 w-3" />}
                ~{user.distance_km} km
              </span>
            )}
            {!user.city && !(typeof user.distance_km === "number") && user.pronouns && (
              <span className="truncate">{user.pronouns}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
