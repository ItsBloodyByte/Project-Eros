import { useState } from "react";
import { Link, NavLink as RRNavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useUnreadCounts } from "../lib/useUnreadCounts";
import { Button } from "./ui/button";
import {
  Compass, MessagesSquare, Images, Settings, Moon, Sun, ShieldCheck,
  LogOut, CalendarClock, UserCog, Crown, Languages, FileText, Menu, ChevronDown,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuPortal,
} from "./ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle,
} from "./ui/sheet";

function CounterBadge({ count, testid }) {
  if (!count || count <= 0) return null;
  return (
    <span
      data-testid={testid}
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold leading-none bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-sm)]"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, , toggleTheme] = useTheme();
  const { t, i18n } = useTranslation();
  const { unread_messages, new_matches } = useUnreadCounts();
  const matchesBadge = (unread_messages || 0) + (new_matches || 0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const setLang = (lng) => {
    i18n.changeLanguage(lng);
    try { localStorage.setItem("eros_lang", lng); } catch {}
  };

  const isStaff = user?.role && user.role !== "user";

  return (
    <header className="sticky top-0 z-40 glass-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left: Brand + mobile hamburger */}
        <div className="flex items-center gap-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("nav.menu", "Menü")}
                data-testid="mobile-menu-trigger"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[84vw] max-w-[340px] p-0 flex flex-col">
              <SheetHeader className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
                <SheetTitle className="font-display text-2xl text-left">Eros</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-2">
                <MobileNavGroup label={t("nav.navigate", "Navigation")}>
                  <MobileSheetItem to="/" icon={<Compass className="h-4 w-4" />} label={t("nav.discover")} testid="sheet-nav-discover" onClose={() => setSheetOpen(false)} />
                  <MobileSheetItem
                    to="/matches"
                    icon={<MessagesSquare className="h-4 w-4" />}
                    label={t("nav.matches")}
                    testid="sheet-nav-matches"
                    badge={matchesBadge}
                    onClose={() => setSheetOpen(false)}
                  />
                  <MobileSheetItem to="/albums" icon={<Images className="h-4 w-4" />} label={t("nav.albums")} testid="sheet-nav-albums" onClose={() => setSheetOpen(false)} />
                  <MobileSheetItem to="/events" icon={<CalendarClock className="h-4 w-4" />} label={t("nav.events")} testid="sheet-nav-events" onClose={() => setSheetOpen(false)} />
                  <MobileSheetItem to="/blog" icon={<FileText className="h-4 w-4" />} label="Blog" testid="sheet-nav-blog" onClose={() => setSheetOpen(false)} />
                </MobileNavGroup>
                <MobileNavGroup label={t("nav.account_group", "Konto")}>
                  <MobileSheetItem to="/account" icon={<UserCog className="h-4 w-4" />} label={t("nav.account")} testid="sheet-nav-account" onClose={() => setSheetOpen(false)} />
                  <MobileSheetItem to="/settings" icon={<Settings className="h-4 w-4" />} label={t("nav.settings")} testid="sheet-nav-settings" onClose={() => setSheetOpen(false)} />
                  {isStaff && (
                    <MobileSheetItem to="/admin" icon={<ShieldCheck className="h-4 w-4" />} label={t("nav.admin")} testid="sheet-nav-admin" onClose={() => setSheetOpen(false)} />
                  )}
                </MobileNavGroup>
                <MobileNavGroup label={t("nav.preferences", "Einstellungen")}>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
                    data-testid="sheet-theme-toggle"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    <span>{t("nav.theme_toggle")}</span>
                  </button>
                  <div className="px-5 py-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {t("nav.language")}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLang("de")}
                    className={`w-full flex items-center justify-between px-5 py-2 text-sm hover:bg-[hsl(var(--secondary))] transition-colors ${i18n.resolvedLanguage === "de" ? "text-[hsl(var(--accent))] font-medium" : "text-[hsl(var(--foreground))]"}`}
                    data-testid="sheet-lang-de"
                  >
                    <span>Deutsch</span>
                    {i18n.resolvedLanguage === "de" && <span aria-hidden>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("en")}
                    className={`w-full flex items-center justify-between px-5 py-2 text-sm hover:bg-[hsl(var(--secondary))] transition-colors ${i18n.resolvedLanguage === "en" ? "text-[hsl(var(--accent))] font-medium" : "text-[hsl(var(--foreground))]"}`}
                    data-testid="sheet-lang-en"
                  >
                    <span>English</span>
                    {i18n.resolvedLanguage === "en" && <span aria-hidden>✓</span>}
                  </button>
                </MobileNavGroup>
              </div>
              <div className="border-t border-[hsl(var(--border))] p-4">
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleLogout}
                    data-testid="sheet-logout-button"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("nav.logout")}
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="font-display text-2xl sm:text-[26px] tracking-tight leading-none" data-testid="brand-home-link">
            Eros
          </Link>
        </div>

        {/* Center (desktop): primary nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          <NavItem to="/"        label={t("nav.discover")} icon={<Compass className="h-4 w-4" />} testid="nav-discover" />
          <NavItem
            to="/matches"
            label={t("nav.matches")}
            icon={<MessagesSquare className="h-4 w-4" />}
            testid="nav-matches"
            badge={matchesBadge}
          />
          <NavItem to="/albums"  label={t("nav.albums")}  icon={<Images className="h-4 w-4" />} testid="nav-albums" />
          <NavItem to="/events"  label={t("nav.events")}  icon={<CalendarClock className="h-4 w-4" />} testid="nav-events" />
          <NavItem to="/blog"    label="Blog"             icon={<FileText className="h-4 w-4" />} testid="nav-blog" />
        </nav>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {user?.is_premium && (
            <span
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--accent))]"
              data-testid="header-premium-badge"
            >
              <Crown className="h-3 w-3" /> Premium
            </span>
          )}

          {/* Desktop theme toggle kept at top level for quick access */}
          <Button
            variant="ghost" size="icon"
            onClick={toggleTheme}
            data-testid="theme-toggle"
            aria-label={t("nav.theme_toggle")}
            className="hidden md:inline-flex"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Desktop: unified account / settings / admin / language / logout dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex gap-1.5"
                data-testid="account-menu-trigger"
                aria-label={t("nav.menu", "Menü")}
              >
                <UserCog className="h-4 w-4" />
                <span className="hidden lg:inline">{t("nav.menu", "Menü")}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {user?.display_name || user?.email || t("nav.menu", "Menü")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/account")} data-testid="menu-account">
                <UserCog className="h-4 w-4 mr-2" />{t("nav.account")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="menu-settings">
                <Settings className="h-4 w-4 mr-2" />{t("nav.settings")}
              </DropdownMenuItem>
              {isStaff && (
                <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="menu-admin">
                  <ShieldCheck className="h-4 w-4 mr-2" />{t("nav.admin")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid="menu-language-trigger">
                  <Languages className="h-4 w-4 mr-2" />{t("nav.language")}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setLang("de")} data-testid="menu-lang-de">
                      Deutsch {i18n.resolvedLanguage === "de" ? "  ✓" : ""}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLang("en")} data-testid="menu-lang-en">
                      English {i18n.resolvedLanguage === "en" ? "  ✓" : ""}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                data-testid="menu-logout"
                className="text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))]"
              >
                <LogOut className="h-4 w-4 mr-2" />{t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, label, icon, testid, badge = 0 }) {
  return (
    <RRNavLink
      to={to}
      end={to === "/"}
      data-testid={testid}
      className={({ isActive }) =>
        [
          "relative inline-flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors px-3.5 py-1.5",
          isActive
            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-sm)]"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]",
        ].join(" ")
      }
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && <CounterBadge count={badge} testid={`${testid}-badge`} />}
    </RRNavLink>
  );
}

function MobileNavGroup({ label, children }) {
  return (
    <div className="py-1">
      <div className="px-5 py-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function MobileSheetItem({ to, icon, label, testid, badge = 0, onClose }) {
  return (
    <RRNavLink
      to={to}
      end={to === "/"}
      onClick={onClose}
      data-testid={testid}
      className={({ isActive }) =>
        [
          "flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition-colors",
          isActive
            ? "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] font-medium"
            : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]",
        ].join(" ")
      }
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </span>
      {badge > 0 && <CounterBadge count={badge} testid={`${testid}-badge`} />}
    </RRNavLink>
  );
}
