import { NavLink, useLocation } from "react-router-dom";
import { Compass, MessagesSquare, Images, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/AuthContext";
import { useUnreadCounts } from "../lib/useUnreadCounts";

/**
 * Persistent bottom navigation strictly for mobile (hidden on md+).
 * Order (left → right): Entdecken, Besucher, Chats, Alben.
 *
 * Hidden on public/auth routes via `hideOn` check.
 */
export function MobileBottomNav() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const { unread_messages, new_matches } = useUnreadCounts();
  const matchesBadge = (unread_messages || 0) + (new_matches || 0);

  // Hide for unauthenticated users and on auth/legal routes
  if (!user) return null;
  const path = location.pathname || "/";
  const hideOn = ["/login", "/register", "/onboarding", "/legal"];
  if (hideOn.some((p) => path === p || path.startsWith(p + "/"))) return null;
  // Hide on chat detail pages (immersive conversation view)
  if (/^\/chat\//.test(path)) return null;

  const items = [
    {
      to: "/",
      label: t("nav.discover"),
      icon: Compass,
      testid: "bottom-nav-discover",
      end: true,
    },
    {
      to: "/visitors",
      label: t("nav.visitors", "Besucher:innen"),
      icon: Eye,
      testid: "bottom-nav-visitors",
    },
    {
      to: "/matches",
      label: t("nav.matches"),
      icon: MessagesSquare,
      testid: "bottom-nav-matches",
      badge: matchesBadge,
    },
    {
      to: "/albums",
      label: t("nav.albums"),
      icon: Images,
      testid: "bottom-nav-albums",
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[hsl(var(--border))] glass-surface pb-[env(safe-area-inset-bottom)]"
      data-testid="mobile-bottom-nav"
      aria-label="Mobile bottom navigation"
    >
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex">
              <NavLink
                to={it.to}
                end={it.end}
                data-testid={it.testid}
                className={({ isActive }) =>
                  [
                    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors relative",
                    isActive
                      ? "text-[hsl(var(--accent))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                  ].join(" ")
                }
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {it.badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-semibold leading-none bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-sm)]"
                      data-testid={`${it.testid}-badge`}
                    >
                      {it.badge > 99 ? "99+" : it.badge}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-full px-1">{it.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
