import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      nav("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center app-shell-bg">
      <div className="w-full max-w-sm p-6 rounded-[var(--radius-lg)] border bg-card shadow-[var(--shadow-md)]">
        <div className="text-center mb-5">
          <div className="font-display text-4xl">Eros</div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Inclusive, modern dating.</div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" data-testid="login-email-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" data-testid="login-password-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button disabled={busy} className="w-full" data-testid="login-submit-button">
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 text-sm text-[hsl(var(--muted-foreground))] text-center">
          New here? <Link className="underline" to="/register" data-testid="link-register">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
