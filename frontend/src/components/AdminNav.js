import {
  Flag, Users, ImageIcon, BadgeCheck, Brain, CreditCard, Scale,
  Megaphone, Gift, Newspaper, MessageSquare, History, ServerCog,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";

/**
 * AdminNav — left sidebar (desktop) / top select (mobile) for the Admin/Moderation
 * dashboard. Keeps the visual language of the rest of Eros (Card + accent color
 * highlight, uppercase section headers, lucide icons).
 *
 * Props:
 *  - value: currently active tab id
 *  - onChange: (tabId) => void
 *  - isSuper: bool — show super-admin-only entries
 *  - counts: optional {reports, photos, verifications, ...} badge counters
 *  - unreadBell: number — shown on top as "Benachrichtigungen"
 */
export function AdminNav({ value, onChange, isSuper, counts = {} }) {
  const groups = [
    {
      title: "Moderation",
      items: [
        { id: "reports", label: "Reports", icon: Flag, badge: counts.reports, always: true },
        { id: "users", label: "User:innen", icon: Users, always: true },
        { id: "photos", label: "Foto-Queue", icon: ImageIcon, badge: counts.photos, always: true },
        { id: "verifications", label: "Verifizierungen", icon: BadgeCheck, badge: counts.verifications, always: true },
      ],
    },
    {
      title: "Inhalt",
      items: [
        { id: "broadcasts", label: "Broadcasts", icon: Megaphone, always: true },
        { id: "blog", label: "Blog", icon: Newspaper, always: true },
        { id: "promos", label: "Promos & Konfig", icon: Gift, superOnly: true },
        { id: "team-channels", label: "Team-Kanäle", icon: MessageSquare, superOnly: true },
      ],
    },
    {
      title: "Konfiguration",
      items: [
        { id: "ai", label: "KI-Konfig", icon: Brain, superOnly: true },
        { id: "payments", label: "Zahlungen", icon: CreditCard, superOnly: true },
        { id: "legal", label: "Rechtliches", icon: Scale, superOnly: true },
      ],
    },
    {
      title: "System",
      items: [
        { id: "audit", label: "Audit-Log", icon: History, always: true },
        { id: "system", label: "System-Status", icon: ServerCog, superOnly: true },
      ],
    },
  ];

  const allItems = groups.flatMap((g) =>
    g.items.filter((it) => it.always || (isSuper && it.superOnly)).map((it) => ({ ...it, group: g.title }))
  );
  const activeItem = allItems.find((it) => it.id === value) || allItems[0];

  return (
    <>
      {/* Mobile navigation: compact select */}
      <div className="md:hidden mb-4" data-testid="admin-nav-mobile">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full" data-testid="admin-nav-mobile-select">
            <SelectValue>
              <span className="inline-flex items-center gap-2">
                {activeItem?.icon ? <activeItem.icon className="h-4 w-4" /> : null}
                <span className="font-medium">{activeItem?.label}</span>
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">· {activeItem?.group}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => {
              const items = g.items.filter((it) => it.always || (isSuper && it.superOnly));
              if (items.length === 0) return null;
              return (
                <div key={g.title}>
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">{g.title}</div>
                  {items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <SelectItem key={it.id} value={it.id} data-testid={`admin-nav-mobile-${it.id}`}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{it.label}</span>
                          {it.badge > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{it.badge}</Badge>}
                        </span>
                      </SelectItem>
                    );
                  })}
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop navigation: sticky left sidebar */}
      <aside
        className="hidden md:block shrink-0 w-[220px] sticky top-6 self-start"
        data-testid="admin-nav-sidebar"
      >
        <nav className="space-y-5">
          {groups.map((g) => {
            const items = g.items.filter((it) => it.always || (isSuper && it.superOnly));
            if (items.length === 0) return null;
            return (
              <div key={g.title}>
                <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">{g.title}</div>
                <ul className="space-y-0.5">
                  {items.map((it) => {
                    const Icon = it.icon;
                    const active = value === it.id;
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => onChange(it.id)}
                          data-testid={`admin-nav-${it.id}`}
                          className={[
                            "w-full flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/40",
                            active
                              ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--accent))]/30"
                              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/60",
                          ].join(" ")}
                        >
                          <Icon className={active ? "h-4 w-4 text-[hsl(var(--accent))]" : "h-4 w-4"} />
                          <span className="flex-1 text-left truncate">{it.label}</span>
                          {it.badge > 0 && (
                            <span className="inline-grid h-5 min-w-[20px] place-items-center rounded-full bg-[hsl(var(--accent))] px-1 text-[10px] font-semibold text-[hsl(var(--accent-foreground))]">
                              {it.badge > 99 ? "99+" : it.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export default AdminNav;
