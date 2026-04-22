import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Mail, ShieldCheck, Zap, Crown, Heart, KeyRound, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const [devCode, setDevCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [mfa, setMfa] = useState({ secret: "", otpauth_url: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [likedMe, setLikedMe] = useState(null);
  const [premium, setPremium] = useState(null);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/premium/status"); setPremium(data); } catch {}
    })();
  }, [user]);

  if (!user) return null;

  const sendCode = async () => {
    const { data } = await api.post("/auth/email/send-code");
    setDevCode(data.dev_code || "");
    toast.success("Code generated. In dev mode it’s visible below.");
  };

  const verifyCode = async () => {
    try {
      await api.post("/auth/email/verify", { code: enteredCode });
      await refresh();
      toast.success("Email verified.");
      setEnteredCode(""); setDevCode("");
    } catch (e) { toast.error(e.response?.data?.detail || "Verification failed"); }
  };

  const setupMfa = async () => {
    const { data } = await api.post("/auth/mfa/setup");
    setMfa(data);
    toast.success("MFA secret generated. Enter a 6-digit TOTP code to enable.");
  };

  const enableMfa = async () => {
    try {
      await api.post("/auth/mfa/enable", { code: mfaCode });
      await refresh();
      toast.success("MFA enabled");
      setMfa({ secret: "", otpauth_url: "" }); setMfaCode("");
    } catch (e) { toast.error(e.response?.data?.detail || "MFA failed"); }
  };

  const disableMfa = async () => {
    try {
      await api.post("/auth/mfa/disable", { code: mfaCode });
      await refresh();
      toast.success("MFA disabled");
    } catch (e) { toast.error(e.response?.data?.detail || "MFA failed"); }
  };

  const upgrade = async () => {
    await api.post("/premium/upgrade", { duration_days: 30 });
    const { data } = await api.get("/premium/status");
    setPremium(data); await refresh();
    toast.success("Premium active for 30 days.");
  };

  const cancel = async () => {
    await api.post("/premium/cancel");
    const { data } = await api.get("/premium/status");
    setPremium(data); await refresh();
    toast.success("Premium canceled.");
  };

  const boost = async () => {
    try {
      await api.post("/me/boost", { duration_minutes: 30 });
      const { data } = await api.get("/premium/status");
      setPremium(data);
      toast.success("Boosted for 30 minutes.");
    } catch (e) { toast.error(e.response?.data?.detail || "Boost failed"); }
  };

  const loadLikedMe = async () => {
    try {
      const { data } = await api.get("/likes/received");
      setLikedMe(data.received);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Requires premium");
    }
  };

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <h1 className="font-display text-3xl">Account</h1>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-lg flex items-center gap-2"><Mail className="h-4 w-4" /> Email verification</div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">{user.email} {user.email_verified ? <Badge variant="secondary" className="ml-1">verified</Badge> : <Badge variant="outline" className="ml-1">unverified</Badge>}</div>
              </div>
              {!user.email_verified && <Button onClick={sendCode} data-testid="send-email-code">Send code</Button>}
            </div>
            {devCode && (
              <div className="rounded-md border p-3 bg-[hsl(var(--secondary))]">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Dev mode code:</div>
                <div className="font-mono text-lg">{devCode}</div>
                <div className="flex gap-2 mt-2">
                  <Input value={enteredCode} onChange={(e) => setEnteredCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} data-testid="email-code-input" />
                  <Button onClick={verifyCode} data-testid="verify-email-code">Verify</Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Two-factor authentication (TOTP)</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Status: {user.mfa_enabled ? <Badge variant="secondary">enabled</Badge> : <Badge variant="outline">disabled</Badge>}</div>
            {!user.mfa_enabled && !mfa.secret && (
              <Button variant="outline" onClick={setupMfa} data-testid="mfa-setup">Set up MFA</Button>
            )}
            {mfa.secret && (
              <div className="space-y-2">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Add to your authenticator using this secret (TOTP):</div>
                <div className="font-mono text-sm break-all rounded-md bg-[hsl(var(--secondary))] p-2" data-testid="mfa-secret">{mfa.secret}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Or scan URI: <span className="font-mono break-all">{mfa.otpauth_url}</span></div>
                <div className="flex gap-2">
                  <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="6-digit code" maxLength={6} data-testid="mfa-code-input" />
                  <Button onClick={enableMfa} data-testid="mfa-enable">Enable</Button>
                </div>
              </div>
            )}
            {user.mfa_enabled && (
              <div className="flex gap-2">
                <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="6-digit code to disable" maxLength={6} />
                <Button variant="destructive" onClick={disableMfa} data-testid="mfa-disable">Disable MFA</Button>
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg flex items-center gap-2"><Crown className="h-4 w-4" /> Premium</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              {premium?.premium ? <>Active until <span className="font-mono text-xs">{premium.premium_until?.slice(0,10)}</span></> : "Free plan"}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Premium unlocks: see who liked you, message-first (without requiring a match), and Boost.</div>
            <div className="flex flex-wrap gap-2">
              {!premium?.premium && <Button onClick={upgrade} data-testid="premium-upgrade">Upgrade – 30 days</Button>}
              {premium?.premium && <Button variant="outline" onClick={cancel} data-testid="premium-cancel">Cancel</Button>}
              <Button variant="secondary" onClick={boost} disabled={!premium?.premium} data-testid="activate-boost" className="gap-1"><Zap className="h-4 w-4" /> Boost 30 min</Button>
              <Button variant="outline" onClick={loadLikedMe} disabled={!premium?.premium} data-testid="view-liked-me" className="gap-1"><Heart className="h-4 w-4" /> Who liked me</Button>
            </div>
            {premium?.boost_active && (
              <div className="text-xs text-[hsl(var(--accent))]">Boost active until {premium.boost_until?.slice(11,16)} UTC.</div>
            )}
            {likedMe && likedMe.length === 0 && <div className="text-sm text-[hsl(var(--muted-foreground))]">No likes received yet.</div>}
            {likedMe && likedMe.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {likedMe.map((ln) => {
                  const primary = (ln.user.photos || []).find((p) => p.is_primary) || (ln.user.photos || [])[0];
                  return (
                    <Link to={`/profile/${ln.user.id}`} key={ln.user.id} className="rounded-md border bg-card overflow-hidden hover:border-[hsl(var(--accent))]/40 transition-colors">
                      <div className="aspect-[3/4] bg-[hsl(var(--muted))]">{primary && <img src={primary.data} alt="" className={`h-full w-full object-cover ${primary.nsfw_score>=0.75?"blur-md":""}`} />}</div>
                      <div className="p-2 text-sm"><div className="font-display">{ln.user.display_name}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{ln.user.age} · {ln.user.pronouns}</div></div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg flex items-center gap-2"><Lock className="h-4 w-4" /> Native mobile</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">The web app is mobile-first responsive. A dedicated React Native build per the concept roadmap is on the roadmap and not shipped in this environment.</div>
          </section>
        </main>
      </div>
    </div>
  );
}
