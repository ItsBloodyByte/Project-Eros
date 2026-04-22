import { Link, NavLink as RRNavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Button } from "./ui/button";
import { Compass, MessagesSquare, Images, Settings, Moon, Sun, ShieldCheck, LogOut, CalendarClock, UserCog, Crown, Languages, FileText } from "lucide-react";
import { useTheme } from "../lib/theme";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, , toggleTheme] = useTheme();
  const { t, i18n } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const setLang = (lng) => {
    i18n.changeLanguage(lng);
    try { localStorage.setItem("eros_lang", lng); } catch {}
  };

  return (
    <header className="sticky top-0 z-40 glass-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="font-display text-2xl sm:text-[26px] tracking-tight leading-none" data-testid="brand-home-link">
          Eros
        </Link>

        <nav className="hidden md:flex items-center gap-0.5">
          <NavItem to="/"        label={t("nav.discover")} icon={<Compass className="h-4 w-4" />} testid="nav-discover" />
          <NavItem to="/matches" label={t("nav.matches")}  icon={<MessagesSquare className="h-4 w-4" />} testid="nav-matches" />
          <NavItem to="/albums"  label={t("nav.albums")}   icon={<Images className="h-4 w-4" />} testid="nav-albums" />
          <NavItem to="/events"  label={t("nav.events")}   icon={<CalendarClock className="h-4 w-4" />} testid="nav-events" />
          <NavItem to="/blog"    label="Blog"              icon={<FileText className="h-4 w-4" />} testid="nav-blog" />
          <NavItem to="/account" label={t("nav.account")}  icon={<UserCog className="h-4 w-4" />} testid="nav-account" />
          <NavItem to="/settings" label={t("nav.settings")} icon={<Settings className="h-4 w-4" />} testid="nav-settings" />
          {user?.role && user.role !== "user" && (
            <NavItem to="/admin" label={t("nav.admin")} icon={<ShieldCheck className="h-4 w-4" />} testid="nav-admin" />
          )}
        </nav>

        <div className="flex items-center gap-1">
          {user?.is_premium && (
            <span
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--accent))]"
              data-testid="header-premium-badge"
            >
              <Crown className="h-3 w-3" /> Premium
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("nav.language")} data-testid="language-switcher">
                <Languages className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("nav.language")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLang("de")} data-testid="lang-de">
                Deutsch {i18n.resolvedLanguage === "de" ? "  ✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("en")} data-testid="lang-en">
                English {i18n.resolvedLanguage === "en" ? "  ✓" : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost" size="icon"
            onClick={toggleTheme}
            data-testid="theme-toggle"
            aria-label={t("nav.theme_toggle")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-button" className="gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">{t("nav.logout")}</span>
          </Button>
        </div>
      </div>

      {/* Mobile nav bottom-row */}
      <nav className="md:hidden flex items-center gap-0.5 overflow-x-auto no-scrollbar px-3 pb-2 -mt-1">
        <NavItem to="/"        label={t("nav.discover")} icon={<Compass className="h-4 w-4" />} testid="nav-discover-m" compact />
        <NavItem to="/matches" label={t("nav.matches")}  icon={<MessagesSquare className="h-4 w-4" />} testid="nav-matches-m" compact />
        <NavItem to="/albums"  label={t("nav.albums")}   icon={<Images className="h-4 w-4" />} testid="nav-albums-m" compact />
        <NavItem to="/events"  label={t("nav.events")}   icon={<CalendarClock className="h-4 w-4" />} testid="nav-events-m" compact />
        <NavItem to="/account" label={t("nav.account")}  icon={<UserCog className="h-4 w-4" />} testid="nav-account-m" compact />
        <NavItem to="/settings" label={t("nav.settings")} icon={<Settings className="h-4 w-4" />} testid="nav-settings-m" compact />
        {user?.role && user.role !== "user" && (
          <NavItem to="/admin" label={t("nav.admin")} icon={<ShieldCheck className="h-4 w-4" />} testid="nav-admin-m" compact />
        )}
      </nav>
    </header>
  );
}

function NavItem({ to, label, icon, testid, compact = false }) {
  return (
    <RRNavLink
      to={to}
      end={to === "/"}
      data-testid={testid}
      className={({ isActive }) =>
        [
          "inline-flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors",
          compact ? "px-3 py-1.5" : "px-3.5 py-1.5",
          isActive
            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-sm)]"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]",
        ].join(" ")
      }
    >
      {icon} <span className={compact ? "hidden sm:inline" : ""}>{label}</span>
    </RRNavLink>
  );
}
