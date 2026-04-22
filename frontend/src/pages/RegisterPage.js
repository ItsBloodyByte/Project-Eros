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

export default function RegisterPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", display_name: "", age: 25, gender_identity: "" });
  const [consents, setConsents] = useState({ terms: false, privacy: false, sensitive_data: false, nsfw_view: false });
  const [busy, setBusy] = useState(false);

  const canContinue =
    !!form.display_name?.trim() &&
    !!form.email?.trim() &&
    !!form.password &&
    !!form.gender_identity &&
    Number(form.age) >= 18 &&
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
        age: Number(form.age),
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
    <div className="min-h-screen grid place-items-center app-shell-bg py-10">
      <div className="w-full max-w-lg p-6 rounded-[var(--radius-lg)] border bg-card shadow-[var(--shadow-md)]">
        <div className="text-center mb-5">
          <div className="font-display text-3xl">{t("register.title")}</div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{t("register.subtitle")}</div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("register.display_name")} <span className="text-[hsl(var(--accent))]">*</span></Label>
              <Input data-testid="register-name-input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required />
            </div>
            <div>
              <Label>{t("register.age")} <span className="text-[hsl(var(--accent))]">*</span></Label>
              <Input data-testid="register-age-input" type="number" min={18} max={120} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required />
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{t("register.age_hint")}</div>
            </div>
          </div>
          <div>
            <Label>{t("register.gender")} <span className="text-[hsl(var(--accent))]">*</span></Label>
            <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
              <SelectTrigger data-testid="register-gender-select"><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => <SelectItem key={g} value={g}>{t(`genders.${g}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("register.email")} <span className="text-[hsl(var(--accent))]">*</span></Label>
            <Input data-testid="register-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label>{t("register.password")} <span className="text-[hsl(var(--accent))]">*</span></Label>
            <Input data-testid="register-password-input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="pt-2">
            <Label className="font-display text-base">{t("register.consents")}</Label>
            <div className="mt-2">
              <ConsentCheckboxGroup value={consents} onChange={setConsents} />
            </div>
          </div>
          <Button disabled={busy || !canContinue} data-testid="register-submit-button" className="w-full">
            {busy ? t("register.creating") : t("register.create")}
          </Button>
        </form>
        <div className="mt-4 text-sm text-[hsl(var(--muted-foreground))] text-center">
          {t("register.have_account")} <Link className="underline" to="/login" data-testid="link-login">{t("register.sign_in")}</Link>
        </div>
      </div>
    </div>
  );
}
