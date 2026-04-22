import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/AuthContext";
import { ConsentCheckboxGroup } from "../components/ConsentCheckboxGroup";
import { toast } from "sonner";

export default function RegisterPage() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", display_name: "", age: 25 });
  const [consents, setConsents] = useState({ terms: false, privacy: false, sensitive_data: false, nsfw_view: false });
  const [busy, setBusy] = useState(false);

  const canContinue = consents.terms && consents.privacy && consents.sensitive_data;

  const submit = async (e) => {
    e.preventDefault();
    if (!canContinue) { toast.error("Please accept required consents"); return; }
    setBusy(true);
    try {
      await register({ ...form, age: Number(form.age), consents });
      nav("/onboarding");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center app-shell-bg py-10">
      <div className="w-full max-w-lg p-6 rounded-[var(--radius-lg)] border bg-card shadow-[var(--shadow-md)]">
        <div className="text-center mb-5">
          <div className="font-display text-3xl">Create your account</div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Inclusive for every identity.</div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Display name</Label>
              <Input data-testid="register-name-input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required />
            </div>
            <div>
              <Label>Age</Label>
              <Input data-testid="register-age-input" type="number" min={18} max={120} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input data-testid="register-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label>Password (min 8 chars)</Label>
            <Input data-testid="register-password-input" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="pt-2">
            <Label className="font-display text-base">Consents</Label>
            <div className="mt-2">
              <ConsentCheckboxGroup value={consents} onChange={setConsents} />
            </div>
          </div>
          <Button disabled={busy || !canContinue} data-testid="register-submit-button" className="w-full">
            {busy ? "Creating..." : "Create account"}
          </Button>
        </form>
        <div className="mt-4 text-sm text-[hsl(var(--muted-foreground))] text-center">
          Already have an account? <Link className="underline" to="/login" data-testid="link-login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
