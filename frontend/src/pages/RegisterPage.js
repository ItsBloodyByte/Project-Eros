import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAuth } from "../lib/AuthContext";
import { ConsentCheckboxGroup } from "../components/ConsentCheckboxGroup";
import { GENDERS } from "../lib/constants";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AppFooter } from "../components/AppFooter";

export default function RegisterPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { register } = useAuth();
  // Default birth_date = 18 years ago (max selectable)
  const today = new Date();
  const maxDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", birth_date: "", gender_identity: "" });
  const [consents, setConsents] = useState({ terms: false, privacy: false, sensitive_data: false, nsfw_view: false });
  const [busy, setBusy] = useState(false);

  const computedAge = (() => {
    if (!form.birth_date) return null;
    try {
      const bd = new Date(form.birth_date);
      const t2 = new Date();
      let years = t2.getFullYear() - bd.getFullYear();
      const m = t2.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && t2.getDate() < bd.getDate())) years--;
      return years;
    } catch { return null; }
  })();
  const ageOk = computedAge !== null && computedAge >= 18;

  const canContinue =
    !!form.display_name?.trim() &&
    !!form.email?.trim() &&
    !!form.password &&
    !!form.gender_identity &&
    ageOk &&
    consents.terms &&
    consents.privacy &&
    consents.sensitive_data;

  const submit = async (e) => {
    e.preventDefault();
    if (!canContinue) { toast.error(t("register.please_complete")); return; }
    setBusy(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        display_name: form.display_name,
        birth_date: form.birth_date,
        gender_identity: form.gender_identity,
        consents,
      });
      nav("/onboarding");
    } catch (e) {
      toast.error(e.response?.data?.detail || t("register.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col app-shell-bg-light dark:app-shell-bg">
      <div className="flex-1 grid place-items-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block font-display text-5xl tracking-tight">Eros</Link>
            <div className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{t("register.subtitle")}</div>
          </div>

          <form onSubmit={submit} className="space-y-5 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6 sm:p-8 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
            <h1 className="font-display text-2xl tracking-tight">{t("register.title")}</h1>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("register.display_name")} <span className="text-[hsl(var(--accent))]">*</span></Label>
                <Input data-testid="register-name-input" className="h-11 rounded-[var(--radius-sm)]" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Geburtsdatum <span className="text-[hsl(var(--accent))]">*</span></Label>
                <Input
                  data-testid="register-birthdate-input"
                  type="date"
                  max={maxDob}
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  required
                  className="h-11 rounded-[var(--radius-sm)]"
                />
                <div className={`text-[11px] ${computedAge !== null && !ageOk ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                  {computedAge === null
                    ? "Du musst mindestens 18 Jahre alt sein."
                    : ageOk
                      ? `Alter: ${computedAge} Jahre`
                      : "Mindestalter: 18 Jahre — bitte ein gültiges Geburtsdatum angeben."}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("register.gender")} <span className="text-[hsl(var(--accent))]">*</span></Label>
              <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
                <SelectTrigger data-testid="register-gender-select" className="h-11 rounded-[var(--radius-sm)]"><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{t(`genders.${g}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("register.email")} <span className="text-[hsl(var(--accent))]">*</span></Label>
              <Input data-testid="register-email-input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="h-11 rounded-[var(--radius-sm)]" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("register.password")} <span className="text-[hsl(var(--accent))]">*</span></Label>
              <Input data-testid="register-password-input" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="h-11 rounded-[var(--radius-sm)]" />
            </div>

            <div className="pt-1">
              <Label className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t("register.consents")}</Label>
              <div className="mt-2">
                <ConsentCheckboxGroup value={consents} onChange={setConsents} />
              </div>
            </div>

            <Button disabled={busy || !canContinue} data-testid="register-submit-button" className="w-full h-11 rounded-full text-sm font-semibold active:scale-[0.98] transition-transform duration-[var(--dur-1)]">
              {busy ? t("register.creating") : t("register.create")}
            </Button>

            <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t("register.have_account")} <Link className="underline decoration-[hsl(var(--accent))]/60 underline-offset-4 hover:decoration-[hsl(var(--accent))] text-[hsl(var(--foreground))] font-medium" to="/login" data-testid="link-login">{t("register.sign_in")}</Link>
            </div>
          </form>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
