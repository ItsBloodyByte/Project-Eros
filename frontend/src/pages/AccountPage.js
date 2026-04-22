import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Mail, ShieldCheck, Zap, Crown, Heart, Lock, Plane, Trash2, IdCard } from "lucide-react";
import { Link } from "react-router-dom";
import { AppFooter } from "../components/AppFooter";
import { PremiumExtrasSection } from "../components/PremiumExtrasSection";
import { CoupleSection } from "../components/CoupleSection";

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const [devCode, setDevCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [mfa, setMfa] = useState({ secret: "", otpauth_url: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [likedMe, setLikedMe] = useState(null);
  const [premium, setPremium] = useState(null);
  const [packages, setPackages] = useState({ enabled: false, packages: [] });
  const [travel, setTravel] = useState([]);
  const [newTrip, setNewTrip] = useState({ destination: "", starts_at: "", ends_at: "", lng: "", lat: "" });
  const [verif, setVerif] = useState({ document_type: "passport", selfie: "", document: "" });

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/premium/status"); setPremium(data); } catch {}
      try { const { data } = await api.get("/payments/packages"); setPackages(data); } catch {}
      try { const { data } = await api.get("/travel/mine"); setTravel(data.plans || []); } catch {}
    })();
  }, [user]);

  if (!user) return null;

  const sendCode = async () => {
    const { data } = await api.post("/auth/email/send-code");
    setDevCode(data.dev_code || "");
    toast.success("Code wurde generiert. Im Dev-Modus unten sichtbar.");
  };
  const verifyCode = async () => {
    try {
      await api.post("/auth/email/verify", { code: enteredCode });
      await refresh();
      toast.success("E-Mail verifiziert.");
      setEnteredCode(""); setDevCode("");
    } catch (e) { toast.error(e.response?.data?.detail || "Verifizierung fehlgeschlagen"); }
  };
  const setupMfa = async () => {
    const { data } = await api.post("/auth/mfa/setup");
    setMfa(data);
    toast.success("MFA-Secret erzeugt. Gib einen 6-stelligen TOTP-Code zum Aktivieren ein.");
  };
  const enableMfa = async () => {
    try { await api.post("/auth/mfa/enable", { code: mfaCode }); await refresh(); toast.success("MFA aktiviert"); setMfa({ secret: "", otpauth_url: "" }); setMfaCode(""); }
    catch (e) { toast.error(e.response?.data?.detail || "MFA fehlgeschlagen"); }
  };
  const disableMfa = async () => {
    try { await api.post("/auth/mfa/disable", { code: mfaCode }); await refresh(); toast.success("MFA deaktiviert"); }
    catch (e) { toast.error(e.response?.data?.detail || "MFA fehlgeschlagen"); }
  };
  const cancel = async () => {
    await api.post("/premium/cancel");
    const { data } = await api.get("/premium/status"); setPremium(data); await refresh();
    toast.success("Premium gekündigt.");
  };
  const loadLikedMe = async () => {
    try { const { data } = await api.get("/likes/received"); setLikedMe(data.received); }
    catch (e) { toast.error(e.response?.data?.detail || "Premium erforderlich"); }
  };

  const checkout = async (pkg_id) => {
    try {
      const origin = window.location.origin;
      const { data } = await api.post("/payments/checkout", { package_id: pkg_id, origin_url: origin });
      if (data.url) window.location.href = data.url;
    } catch (e) { toast.error(e.response?.data?.detail || "Checkout fehlgeschlagen"); }
  };

  const addTrip = async () => {
    if (!newTrip.destination || !newTrip.starts_at || !newTrip.ends_at) { toast.error("Bitte Ziel und Datum ausfüllen"); return; }
    try {
      const payload = {
        city: newTrip.destination,
        starts_at: new Date(newTrip.starts_at).toISOString(),
        ends_at: new Date(newTrip.ends_at).toISOString(),
      };
      if (newTrip.lng && newTrip.lat) payload.location = { type: "Point", coordinates: [Number(newTrip.lng), Number(newTrip.lat)] };
      await api.post("/travel", payload);
      const { data } = await api.get("/travel/mine"); setTravel(data.plans || []);
      setNewTrip({ destination: "", starts_at: "", ends_at: "", lng: "", lat: "" });
      toast.success("Reise gespeichert");
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
  };
  const removeTrip = async (id) => {
    await api.delete(`/travel/${id}`);
    const { data } = await api.get("/travel/mine"); setTravel(data.plans || []);
  };

  const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const submitVerif = async () => {
    if (!verif.selfie || !verif.document) { toast.error("Selfie und Dokument erforderlich"); return; }
    try {
      await api.post("/verification/id", {
        document_type: verif.document_type,
        selfie_data_url: verif.selfie,
        document_data_url: verif.document,
      });
      toast.success("Zur Prüfung eingereicht");
      setVerif({ document_type: "passport", selfie: "", document: "" });
      await refresh();
    } catch (e) { toast.error(e.response?.data?.detail || "Einreichen fehlgeschlagen"); }
  };

  const premiumPkgs = (packages.packages || []).filter((p) => p.kind === "premium");
  const boostPkgs = (packages.packages || []).filter((p) => p.kind === "boost");
  const idStatus = user.id_verification_status || (user.id_verified ? "approved" : null);

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
          <header className="pb-2">
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Konto</div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-none">Sicherheit &amp; Services</h1>
          </header>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-lg flex items-center gap-2"><Mail className="h-4 w-4" /> E-Mail-Verifizierung</div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">{user.email} {user.email_verified ? <Badge variant="secondary" className="ml-1">verifiziert</Badge> : <Badge variant="outline" className="ml-1">unverifiziert</Badge>}</div>
              </div>
              {!user.email_verified && <Button onClick={sendCode} data-testid="send-email-code">Code senden</Button>}
            </div>
            {devCode && (
              <div className="rounded-md border p-3 bg-[hsl(var(--secondary))]">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Dev-Modus Code:</div>
                <div className="font-mono text-lg">{devCode}</div>
                <div className="flex gap-2 mt-2">
                  <Input value={enteredCode} onChange={(e) => setEnteredCode(e.target.value)} placeholder="6-stelliger Code" maxLength={6} data-testid="email-code-input" />
                  <Button onClick={verifyCode} data-testid="verify-email-code">Bestätigen</Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Zwei-Faktor-Authentifizierung</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Status: {user.mfa_enabled ? <Badge variant="secondary">aktiv</Badge> : <Badge variant="outline">deaktiviert</Badge>}</div>
            {!user.mfa_enabled && !mfa.secret && (
              <Button variant="outline" onClick={setupMfa} data-testid="mfa-setup">MFA einrichten</Button>
            )}
            {mfa.secret && (
              <div className="space-y-2">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">TOTP-Secret in deiner Authenticator-App hinzufügen:</div>
                <div className="font-mono text-sm break-all rounded-md bg-[hsl(var(--secondary))] p-2" data-testid="mfa-secret">{mfa.secret}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Oder URI scannen: <span className="font-mono break-all">{mfa.otpauth_url}</span></div>
                <div className="flex gap-2">
                  <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="6-stelliger Code" maxLength={6} data-testid="mfa-code-input" />
                  <Button onClick={enableMfa} data-testid="mfa-enable">Aktivieren</Button>
                </div>
              </div>
            )}
            {user.mfa_enabled && (
              <div className="flex gap-2">
                <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="Code zum Deaktivieren" maxLength={6} />
                <Button variant="destructive" onClick={disableMfa} data-testid="mfa-disable">Deaktivieren</Button>
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3 shadow-[var(--shadow-sm)]" data-testid="id-verification-section">
            <div className="font-display text-lg flex items-center gap-2"><IdCard className="h-4 w-4" /> ID-Verifizierung <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">(kostenlos)</span></div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              Status:&nbsp;
              {idStatus === "approved" && <Badge className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">verifiziert</Badge>}
              {idStatus === "pending" && <Badge variant="outline">in Prüfung</Badge>}
              {idStatus === "rejected" && <Badge variant="destructive">abgelehnt</Badge>}
              {!idStatus && <Badge variant="outline">nicht verifiziert</Badge>}
            </div>
            {idStatus !== "approved" && idStatus !== "pending" && (
              <div className="space-y-2">
                <Label>Dokument-Typ</Label>
                <Select value={verif.document_type} onValueChange={(v) => setVerif({ ...verif, document_type: v })}>
                  <SelectTrigger data-testid="verif-doctype-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Reisepass</SelectItem>
                    <SelectItem value="id_card">Personalausweis</SelectItem>
                    <SelectItem value="drivers_license">Führerschein</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Selfie</Label>
                    <input type="file" accept="image/*" data-testid="verif-selfie-input"
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) setVerif({ ...verif, selfie: await fileToDataUrl(f) }); }} />
                    {verif.selfie && <img src={verif.selfie} alt="selfie" className="mt-1 h-20 w-20 object-cover rounded" />}
                  </div>
                  <div>
                    <Label>Dokument</Label>
                    <input type="file" accept="image/*" data-testid="verif-doc-input"
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) setVerif({ ...verif, document: await fileToDataUrl(f) }); }} />
                    {verif.document && <img src={verif.document} alt="doc" className="mt-1 h-20 w-28 object-cover rounded" />}
                  </div>
                </div>
                <Button onClick={submitVerif} data-testid="verif-submit">Zur Prüfung einreichen</Button>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Deine Dokumente werden nur intern von Moderator:innen geprüft.</div>
              </div>
            )}
          </section>

          <CoupleSection />

          <PremiumExtrasSection />

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3 shadow-[var(--shadow-sm)]" data-testid="premium-section">
            <div className="font-display text-lg flex items-center gap-2"><Crown className="h-4 w-4" /> Premium</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              {premium?.premium ? <>Aktiv bis <span className="font-mono text-xs">{premium.premium_until?.slice(0,10)}</span></> : "Gratis-Tarif"}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Premium-Funktionen: sehen, wer dich geliked hat; Erst-Nachricht ohne Match; Boost für mehr Sichtbarkeit.</div>
            {!packages.enabled && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Zahlungen sind derzeit deaktiviert. Bitte Admin kontaktieren.</div>
            )}
            {packages.enabled && premiumPkgs.length > 0 && !premium?.premium && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {premiumPkgs.map((p) => (
                  <div key={p.id} className="rounded-md border p-3 flex items-center justify-between">
                    <div>
                      <div className="font-display">{p.desc}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{p.days ? `${p.days} Tage` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{p.amount.toFixed(2)} {(p.currency || "eur").toUpperCase()}</div>
                      <Button size="sm" className="mt-1" onClick={() => checkout(p.id)} data-testid={`checkout-${p.id}`}>Kaufen</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {premium?.premium && <Button variant="outline" onClick={cancel} data-testid="premium-cancel">Kündigen</Button>}
              {packages.enabled && boostPkgs.length > 0 && (
                boostPkgs.map((p) => (
                  <Button key={p.id} variant="secondary" onClick={() => checkout(p.id)} className="gap-1" data-testid={`checkout-${p.id}`}>
                    <Zap className="h-4 w-4" /> {p.desc} – {p.amount.toFixed(2)} {(p.currency || "eur").toUpperCase()}
                  </Button>
                ))
              )}
              <Button variant="outline" onClick={loadLikedMe} disabled={!premium?.premium} data-testid="view-liked-me" className="gap-1"><Heart className="h-4 w-4" /> Wer mich geliked hat</Button>
            </div>
            {premium?.boost_active && (
              <div className="text-xs text-[hsl(var(--accent))]">Boost aktiv bis {premium.boost_until?.slice(11,16)} UTC.</div>
            )}
            {likedMe && likedMe.length === 0 && <div className="text-sm text-[hsl(var(--muted-foreground))]">Noch keine Likes erhalten.</div>}
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

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3 shadow-[var(--shadow-sm)]" data-testid="travel-section">
            <div className="font-display text-lg flex items-center gap-2"><Plane className="h-4 w-4" /> Reisepläne</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Teile, wohin du reist – so kannst du Leute am Zielort treffen.</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Label>Ziel</Label><Input value={newTrip.destination} onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })} placeholder="Berlin, DE" data-testid="travel-dest-input" /></div>
              <div><Label>Von</Label><Input type="date" value={newTrip.starts_at} onChange={(e) => setNewTrip({ ...newTrip, starts_at: e.target.value })} data-testid="travel-start-input" /></div>
              <div><Label>Bis</Label><Input type="date" value={newTrip.ends_at} onChange={(e) => setNewTrip({ ...newTrip, ends_at: e.target.value })} data-testid="travel-end-input" /></div>
              <div><Label className="text-xs">Länge (optional)</Label><Input type="number" step="0.0001" value={newTrip.lng} onChange={(e) => setNewTrip({ ...newTrip, lng: e.target.value })} placeholder="13.405" /></div>
              <div><Label className="text-xs">Breite (optional)</Label><Input type="number" step="0.0001" value={newTrip.lat} onChange={(e) => setNewTrip({ ...newTrip, lat: e.target.value })} placeholder="52.52" /></div>
            </div>
            <Button onClick={addTrip} data-testid="travel-add-button">Reise hinzufügen</Button>
            {travel.length === 0 ? (
              <div className="text-sm text-[hsl(var(--muted-foreground))]">Noch keine geplanten Reisen.</div>
            ) : (
              <ul className="divide-y">
                {travel.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2" data-testid={`travel-item-${p.id}`}>
                    <div>
                      <div className="font-medium">{p.city}{p.country ? `, ${p.country}` : ""}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{(p.starts_at || "").slice(0,10)} — {(p.ends_at || "").slice(0,10)}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeTrip(p.id)} data-testid={`travel-remove-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg flex items-center gap-2"><Lock className="h-4 w-4" /> Native Mobile App</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Die Web-App ist mobile-first responsiv. Ein eigenständiger React-Native-Build ist im Roadmap vorgesehen.</div>
          </section>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
