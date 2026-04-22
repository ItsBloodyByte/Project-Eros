import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Button } from "./ui/button";
import { Heart, MessagesSquare, Images, Settings, Moon, Sun, ShieldCheck, LogOut, CalendarClock, UserCog, Crown, Languages } from "lucide-react";
import { useTheme } from "../lib/theme";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
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
    <header className="sticky top-0 z-40 border-b bg-[hsl(var(--background))]/70 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-tight">Eros</Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" label={t("nav.discover")} icon={<Heart className="h-4 w-4" />} testid="nav-discover" />
          <NavLink to="/matches" label={t("nav.matches")} icon={<MessagesSquare className="h-4 w-4" />} testid="nav-matches" />
          <NavLink to="/albums" label={t("nav.albums")} icon={<Images className="h-4 w-4" />} testid="nav-albums" />
          <NavLink to="/events" label={t("nav.events")} icon={<CalendarClock className="h-4 w-4" />} testid="nav-events" />
          <NavLink to="/account" label={t("nav.account")} icon={<UserCog className="h-4 w-4" />} testid="nav-account" />
          <NavLink to="/settings" label={t("nav.settings")} icon={<Settings className="h-4 w-4" />} testid="nav-settings" />
          {user?.role && user.role !== "user" && (
            <NavLink to="/admin" label={t("nav.admin")} icon={<ShieldCheck className="h-4 w-4" />} testid="nav-admin" />
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user?.is_premium && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 px-2 py-0.5 text-[11px] text-[hsl(var(--accent))]" data-testid="header-premium-badge">
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
                Deutsch {i18n.resolvedLanguage === "de" ? " · ✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("en")} data-testid="lang-en">
                English {i18n.resolvedLanguage === "en" ? " · ✓" : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost" size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="theme-toggle"
            aria-label={t("nav.theme_toggle")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-button" className="gap-1">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">{t("nav.logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, label, icon, testid }) {
  return (
    <Link
      to={to}
      data-testid={testid}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
    >
      {icon} {label}
    </Link>
  );
}
