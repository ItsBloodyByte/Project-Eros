import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, Trash, Shield, Moon, Sun, Monitor, BadgeCheck, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../lib/theme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { RELATIONSHIP_STATUSES } from "../components/RelationshipStatusBadge";

const STAFF_ROLES = new Set(["admin", "superadmin", "moderator", "content_reviewer", "support"]);

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const nav = useNavigate();
  const [theme, setTheme] = useTheme();
  const [privacy, setPrivacy] = useState(user?.privacy || {});
  useEffect(() => { if (user) setPrivacy(user.privacy || {}); }, [user]);

  if (!user) {
    return (
      <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
        <div className="app-content flex flex-col min-h-screen">
          <AppHeader />
          <div className="flex-1 grid place-items-center text-sm text-[hsl(var(--muted-foreground))]">Lädt …</div>
          <AppFooter />
        </div>
      </div>
    );
  }

  const save = async (patch) => {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    try {
      await api.patch("/me", { privacy: next });
      await refresh();
    } catch { toast.error("Speichern fehlgeschlagen"); }
  };

  const exportData = async () => {
    try {
      const { data } = await api.get("/gdpr/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "eros_export.json"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Daten exportiert");
    } catch { toast.error("Export fehlgeschlagen"); }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/gdpr/account");
      toast.success("Konto gelöscht.");
      logout(); nav("/login");
    } catch { toast.error("Löschen fehlgeschlagen"); }
  };

  const clearThemeOverride = () => {
    try { localStorage.removeItem("eros_theme"); } catch {}
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
    toast.success("Systempräferenz übernommen");
  };

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
          <header className="pb-2">
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Einstellungen</div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-none">Deine Präferenzen</h1>
          </header>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6 space-y-4 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[hsl(var(--accent))]" />
              <div className="font-display text-lg tracking-tight">Privatsphäre</div>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]/60">
              <Row label="Lesebestätigungen" hint="Andere sehen, wenn du Nachrichten gelesen hast">
                <Switch checked={!!privacy.read_receipts} onCheckedChange={(v) => save({ read_receipts: v })} data-testid="privacy-read-receipts" />
              </Row>
              <Row label="Online-Status" hint="Zeige anderen, wenn du online bist">
                <Switch checked={!!privacy.show_online_status} onCheckedChange={(v) => save({ show_online_status: v })} data-testid="privacy-online-status" />
              </Row>
              <Row label="Tipp-Indikator" hint="Zeigen, wenn du gerade tippst">
                <Switch checked={!!privacy.show_typing} onCheckedChange={(v) => save({ show_typing: v })} data-testid="privacy-typing" />
              </Row>
              <Row label="Versteckter Modus" hint="Verbirgt dein Profil vorübergehend">
                <Switch checked={!!privacy.hidden_mode} onCheckedChange={(v) => save({ hidden_mode: v })} data-testid="privacy-hidden-mode" />
              </Row>
              <Row label="Screenshot-Hinweise" hint="Benachrichtige andere bei erkanntem Screenshot">
                <Switch checked={!!privacy.screenshot_notifications} onCheckedChange={(v) => save({ screenshot_notifications: v })} data-testid="privacy-screenshot" />
              </Row>
              {STAFF_ROLES.has(user.role) && (
                <Row
                  label="Rollen-Badge anzeigen"
                  hint="Wenn aktiv: Dein Team-Status (z.B. Moderator:in, Admin) ist für andere auf deinem Profil sichtbar."
                >
                  <Switch
                    checked={privacy.role_badge_visible !== false}
                    onCheckedChange={(v) => save({ role_badge_visible: v })}
                    data-testid="privacy-role-badge"
                  />
                </Row>
              )}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6 space-y-4 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60" data-testid="relationship-status-section">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-[hsl(var(--accent))]" />
              <div className="font-display text-lg tracking-tight">Beziehungsstatus</div>
            </div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              Dein aktueller Status wird auf deinem Profil als Badge angezeigt. „Keine Angabe" blendet den Badge aus.
            </div>
            <Select
              value={user.relationship_status || "not_specified"}
              onValueChange={async (v) => {
                try {
                  await api.patch("/me", { relationship_status: v === "not_specified" ? null : v });
                  await refresh();
                  toast.success("Beziehungsstatus aktualisiert");
                } catch {
                  toast.error("Speichern fehlgeschlagen");
                }
              }}
            >
              <SelectTrigger data-testid="relationship-status-select" className="max-w-sm">
                <SelectValue placeholder="Beziehungsstatus wählen" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_STATUSES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6 space-y-4 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
            <div className="font-display text-lg tracking-tight">Darstellung</div>
            <div className="grid grid-cols-3 gap-2">
              <ThemeButton label="Hell"   icon={<Sun className="h-4 w-4" />}   active={theme === "light"} onClick={() => setTheme("light")} testid="theme-light" />
              <ThemeButton label="Dunkel" icon={<Moon className="h-4 w-4" />}  active={theme === "dark"}  onClick={() => setTheme("dark")}  testid="theme-dark" />
              <ThemeButton label="System" icon={<Monitor className="h-4 w-4" />} active={false}           onClick={clearThemeOverride}       testid="theme-system" />
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Bei „System" folgt Eros automatisch deiner Betriebssystem-Einstellung.</div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6 space-y-4 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
            <div className="font-display text-lg tracking-tight">Deine Daten (DSGVO)</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Lade alle deine Daten herunter oder lösche dein Konto dauerhaft.</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportData} variant="outline" className="gap-1.5 rounded-full" data-testid="gdpr-export-button"><Download className="h-4 w-4" /> Daten exportieren</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-1.5 rounded-full" data-testid="gdpr-delete-button"><Trash className="h-4 w-4" /> Konto löschen</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Konto dauerhaft löschen?</AlertDialogTitle>
                    <AlertDialogDescription>Dein Profil, Fotos, Likes, Matches, Nachrichten und Alben werden entfernt. Das lässt sich nicht rückgängig machen.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAccount} data-testid="gdpr-delete-confirm">Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{hint}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ThemeButton({ label, icon, active, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={[
        "inline-flex flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border px-3 py-3 text-xs font-medium",
        "transition-colors duration-[var(--dur-2)] ease-[var(--ease-out)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
        "active:scale-[0.98]",
        active
          ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent shadow-[var(--shadow-sm)]"
          : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
