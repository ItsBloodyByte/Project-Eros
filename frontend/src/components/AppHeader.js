import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Button } from "./ui/button";
import { Heart, MessagesSquare, Images, Settings, Moon, Sun, ShieldCheck, LogOut, CalendarClock, UserCog, Crown } from "lucide-react";
import { useTheme } from "../lib/theme";

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-[hsl(var(--background))]/70 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-tight">Eros</Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" label="Discover" icon={<Heart className="h-4 w-4" />} testid="nav-discover" />
          <NavLink to="/matches" label="Matches" icon={<MessagesSquare className="h-4 w-4" />} testid="nav-matches" />
          <NavLink to="/albums" label="Albums" icon={<Images className="h-4 w-4" />} testid="nav-albums" />
          <NavLink to="/events" label="Events" icon={<CalendarClock className="h-4 w-4" />} testid="nav-events" />
          <NavLink to="/account" label="Account" icon={<UserCog className="h-4 w-4" />} testid="nav-account" />
          <NavLink to="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} testid="nav-settings" />
          {user?.role && user.role !== "user" && (
            <NavLink to="/admin" label="Admin" icon={<ShieldCheck className="h-4 w-4" />} testid="nav-admin" />
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user?.is_premium && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 px-2 py-0.5 text-[11px] text-[hsl(var(--accent))]" data-testid="header-premium-badge">
              <Crown className="h-3 w-3" /> Premium
            </span>
          )}
          <Button
            variant="ghost" size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-button" className="gap-1">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
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
