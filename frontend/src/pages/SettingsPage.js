import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const nav = useNavigate();
  const [privacy, setPrivacy] = useState(user?.privacy || {});
  useEffect(() => { if (user) setPrivacy(user.privacy || {}); }, [user]);

  if (!user) return <div className="app-wrap dark:app-shell-bg app-shell-bg-light"><div className="app-content"><AppHeader /><div className="p-8">Loading...</div></div></div>;

  const save = async (patch) => {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    try {
      await api.patch("/me", { privacy: next });
      await refresh();
    } catch {
      toast.error("Failed to save");
    }
  };

  const exportData = async () => {
    try {
      const { data } = await api.get("/gdpr/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "eros_export.json"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/gdpr/account");
      toast.success("Account deleted.");
      logout(); nav("/login");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <h1 className="font-display text-3xl">Settings</h1>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">Privacy</div>
            <Row label="Read receipts" hint="Show when you’ve read their messages">
              <Switch checked={!!privacy.read_receipts} onCheckedChange={(v) => save({ read_receipts: v })} data-testid="privacy-read-receipts" />
            </Row>
            <Row label="Online status" hint="Let others see when you’re online">
              <Switch checked={!!privacy.show_online_status} onCheckedChange={(v) => save({ show_online_status: v })} data-testid="privacy-online-status" />
            </Row>
            <Row label="Typing indicator" hint="Show when you’re typing">
              <Switch checked={!!privacy.show_typing} onCheckedChange={(v) => save({ show_typing: v })} data-testid="privacy-typing" />
            </Row>
            <Row label="Hidden mode" hint="Temporarily hide your profile from discovery">
              <Switch checked={!!privacy.hidden_mode} onCheckedChange={(v) => save({ hidden_mode: v })} data-testid="privacy-hidden-mode" />
            </Row>
            <Row label="Screenshot notifications" hint="Notify others if a screenshot is detected">
              <Switch checked={!!privacy.screenshot_notifications} onCheckedChange={(v) => save({ screenshot_notifications: v })} data-testid="privacy-screenshot" />
            </Row>
          </section>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">Your data (GDPR)</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Download all your data, or permanently delete your account.</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportData} variant="outline" className="gap-1" data-testid="gdpr-export-button"><Download className="h-4 w-4" /> Export my data</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-1" data-testid="gdpr-delete-button"><Trash className="h-4 w-4" /> Delete account</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
                    <AlertDialogDescription>This removes your profile, photos, likes, matches, messages and albums. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAccount} data-testid="gdpr-delete-confirm">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <Label className="text-sm">{label}</Label>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}
