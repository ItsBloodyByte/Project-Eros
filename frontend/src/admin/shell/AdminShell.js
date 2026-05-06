import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, Flag, Image as ImageIcon, BadgeCheck, ShieldAlert, Users,
  Sparkles, Crown, FileText, Scale, Megaphone, Ticket, CreditCard,
  SlidersHorizontal, ScrollText, MessagesSquare, ChevronLeft, ChevronRight,
  PanelLeft, ServerCog, LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { useTheme } from "../../lib/theme";

/**
 * AdminShell — the persistent chrome for the entire /admin area.
 *
 * Composition:
 *   ┌─ Sidebar (collapsible, w-264 ↔ w-72) ─┐ ┌─ Topbar (sticky, h-14) ─────┐
 *   │  Branding                              │ │  Breadcrumb / env / user  │
 *   │  Group: Overview                       │ └───────────────────────────────────┘
 *   │  Group: Moderation                     │ ┌─ Content (children) ──────┐
 *   │  Group: People                         │ │                          │
 *   │  Group: Content                        │ │                          │
 *   │  Group: Operations                     │ │                          │
 *   └─ Footer: env + theme + back to app ──┘ └───────────────────────────────────┘
 *
 * Sidebar collapse state is persisted in localStorage so a moderator who
 * prefers the compact icons-only mode keeps their choice across reloads.
 *
 * Section navigation is driven by `value` / `onChange` from the parent so
 * the existing AdminPage state machine keeps controlling content. The
 * shell intentionally does NOT own the data fetching — it is purely
 * structural chrome.
 */
export function AdminShell({
  value,
  onChange,
  isSuper,
  counts = {},
  user,
  topbarRight,
  children,
}) {
  const { theme, toggle: toggleTheme } = useTheme();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("admin-sidebar-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("admin-sidebar-collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const groups = buildGroups({ isSuper, counts });
  const active = findActive(groups, value);

  return (
    <div className="admin-root min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]" data-testid="admin-shell">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`${collapsed ? "w-[68px]" : "w-[260px]"} hidden md:flex shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-sm sticky top-0 self-start max-h-screen overflow-y-auto transition-[width] duration-200`}
          aria-label="Admin Navigation"
          data-testid="admin-sidebar"
        >
          {/* Brand */}
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-14 border-b border-[hsl(var(--border))]`}>
            {!collapsed && (
              <Link to="/admin" className="font-display text-[15px] tracking-tight">Eros Admin</Link>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="h-7 w-7 grid place-items-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40"
              aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
              data-testid="admin-sidebar-toggle"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          <nav className="flex-1 py-2">
            {groups.map((g) => (
              <div key={g.group} className="px-2 pb-2">
                {!collapsed && (
                  <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">{g.group}</div>
                )}
                <ul className="space-y-0.5">
                  {g.items.map((it) => {
                    const isActive = it.key === value;
                    const Icon = it.icon;
                    return (
                      <li key={it.key}>
                        <button
                          onClick={() => onChange(it.key)}
                          title={collapsed ? it.label : undefined}
                          aria-current={isActive ? "page" : undefined}
                          data-testid={`admin-nav-${it.key.replace(/\./g, "-")}`}
                          className={`group w-full flex items-center gap-2 rounded-md ${collapsed ? "justify-center px-0 py-2" : "px-2 py-1.5"} text-[13px] transition-colors relative
                            ${isActive
                              ? "bg-[hsl(var(--accent))]/14 text-[hsl(var(--foreground))] font-medium"
                              : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50 hover:text-[hsl(var(--foreground))]"}`}
                        >
                          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[hsl(var(--accent))]" />}
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="flex-1 text-left truncate">{it.label}</span>}
                          {!collapsed && it.badge != null && it.badge > 0 && (
                            <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] text-[10px] font-mono leading-none">
                              {it.badge > 99 ? "99+" : it.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className={`border-t border-[hsl(var(--border))] p-2 ${collapsed ? "flex flex-col items-center gap-2" : "space-y-1"}`}>
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center gap-2 rounded-md ${collapsed ? "justify-center py-1.5" : "px-2 py-1.5"} text-[12px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50 hover:text-[hsl(var(--foreground))]`}
              title="Theme wechseln"
              data-testid="admin-theme-toggle"
            >
              <ServerCog className="h-4 w-4" />
              {!collapsed && <span>Theme: {theme}</span>}
            </button>
            <Link
              to="/discover"
              className={`flex items-center gap-2 rounded-md ${collapsed ? "justify-center py-1.5" : "px-2 py-1.5"} text-[12px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50 hover:text-[hsl(var(--foreground))]`}
              data-testid="admin-back-to-app"
            >
              <PanelLeft className="h-4 w-4" />
              {!collapsed && <span>Zurück zur App</span>}
            </Link>
          </div>
        </aside>

        {/* Mobile-only tab bar (horizontal scroll) for sections */}
        <MobileSectionBar groups={groups} value={value} onChange={onChange} />

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Topbar */}
          <div className="sticky top-0 z-30 h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/85 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/65">
            <div className="h-full px-4 md:px-6 flex items-center gap-3">
              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))] min-w-0">
                <span>Admin</span>
                {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                {active && <span className="text-[hsl(var(--muted-foreground))]">{active.group}</span>}
                {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                {active && (
                  <span className="text-[hsl(var(--foreground))] font-medium truncate" data-testid="admin-breadcrumb-active">
                    {active.label}
                  </span>
                )}
              </nav>
              <div className="flex-1" />
              <div className="flex items-center gap-2 shrink-0">
                {topbarRight}
                <span
                  className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ring-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                  title="Umgebung"
                  data-testid="admin-env-pill"
                >
                  {process.env.NODE_ENV === "production" ? "PROD" : "DEV"}
                </span>
                {user && (
                  <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))] pl-2 border-l border-[hsl(var(--border))]">
                    <span className="font-medium text-[hsl(var(--foreground))]">{user.display_name || user.email}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--accent))]">{user.role}</span>
                    <button onClick={logout} title="Abmelden" className="ml-1 h-6 w-6 grid place-items-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40" data-testid="admin-logout"><LogOut className="h-3.5 w-3.5" /></button>
                  </span>
                )}
              </div>
            </div>
          </div>
          <main className="flex-1 px-4 md:px-6 py-4 md:py-5 max-w-[1600px] w-full">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function MobileSectionBar({ groups, value, onChange }) {
  // Compact dropdown row for mobile so users can switch sections without
  // swiping through all 14+ items.
  return (
    <div className="md:hidden sticky top-0 z-30 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 backdrop-blur">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent px-4 py-3 text-[13px] focus:outline-none"
        data-testid="admin-mobile-nav"
      >
        {groups.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((it) => (
              <option key={it.key} value={it.key}>{it.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function findActive(groups, value) {
  for (const g of groups) {
    for (const it of g.items) {
      if (it.key === value) return { ...it, group: g.group };
    }
  }
  return null;
}

// Keys map 1:1 to the existing AdminPage `activeTab` strings so we don't
// have to migrate state — only the navigation chrome changes.
function buildGroups({ isSuper, counts }) {
  const groups = [
    {
      group: "Übersicht",
      items: [
        { key: "overview", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      group: "Moderation",
      items: [
        { key: "reports",       label: "Reports",        icon: Flag,        badge: counts.reports },
        { key: "photos",        label: "Foto-Queue",      icon: ImageIcon,   badge: counts.photos },
        { key: "verifications", label: "ID-Verifizierung", icon: BadgeCheck,  badge: counts.verifications },
        { key: "honeypots",     label: "Honeypots",      icon: ShieldAlert, badge: counts.honeypots },
      ],
    },
    {
      group: "People",
      items: [
        { key: "users",  label: "Users",  icon: Users },
        { key: "sparks", label: "Sparks", icon: Sparkles },
      ],
    },
    {
      group: "Content",
      items: [
        { key: "blog",         label: "Blog",         icon: FileText },
        ...(isSuper ? [
          { key: "legal",        label: "Rechtliches",  icon: Scale },
        ] : []),
        { key: "broadcasts",   label: "Broadcasts",   icon: Megaphone },
        ...(isSuper ? [
          { key: "promos",       label: "Promos",       icon: Ticket },
        ] : []),
      ],
    },
    {
      group: "Operations",
      items: [
        ...(isSuper ? [
          { key: "payments",  label: "Payments",      icon: CreditCard, badge: counts.stalePayments },
          { key: "ai",        label: "KI-Konfig",     icon: SlidersHorizontal },
        ] : []),
        { key: "audit",       label: "Audit-Log",    icon: ScrollText },
        ...(isSuper ? [
          { key: "team-channels", label: "Team-Kanäle", icon: MessagesSquare },
          { key: "system",       label: "System",      icon: ServerCog },
        ] : []),
      ],
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}
