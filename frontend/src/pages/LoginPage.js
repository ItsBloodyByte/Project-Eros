import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AppFooter } from "../components/AppFooter";

export default function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login({ email, password });
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("auth.login_failed") || "Anmeldung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col app-shell-bg-light dark:app-shell-bg">
      <div className="flex-1 grid place-items-center px-4">
        <div className="w-full max-w-sm py-14">
          <div className="text-center mb-10">
            <Link to="/" className="inline-block font-display text-5xl tracking-tight" data-testid="brand-home-link">Eros</Link>
            <div className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{t("auth.login_tagline")}</div>
          </div>

          <form onSubmit={submit} className="space-y-5 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6 sm:p-7 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
            <h1 className="font-display text-2xl tracking-tight">{t("auth.login_title")}</h1>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("auth.email")}</Label>
              <Input id="email" type="email" autoComplete="email" data-testid="login-email-input"
                value={email} onChange={(e) => setEmail(e.target.value)} required
                className="h-11 rounded-[var(--radius-sm)]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("auth.password")}</Label>
              <Input id="pw" type="password" autoComplete="current-password" data-testid="login-password-input"
                value={password} onChange={(e) => setPassword(e.target.value)} required
                className="h-11 rounded-[var(--radius-sm)]" />
            </div>
            <Button disabled={busy} className="w-full h-11 rounded-full text-sm font-semibold active:scale-[0.98] transition-transform duration-[var(--dur-1)]" data-testid="login-submit-button">
              {busy ? t("auth.signing_in") : t("auth.sign_in")}
            </Button>
            <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t("auth.new_here")} <Link className="underline decoration-[hsl(var(--accent))]/60 underline-offset-4 hover:decoration-[hsl(var(--accent))] text-[hsl(var(--foreground))] font-medium" to="/register" data-testid="link-register">{t("auth.create_account")}</Link>
            </div>
          </form>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
