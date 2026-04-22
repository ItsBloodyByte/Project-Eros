import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";

export default function AdminPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [verifs, setVerifs] = useState([]);
  const [search, setSearch] = useState("");
  const [aiCfg, setAiCfg] = useState({ provider: "gemini", model: "gemini-2.5-flash", base_url: "", enabled: true, api_key: "", api_key_masked: "" });
  const [legalKey, setLegalKey] = useState("terms");
  const [legal, setLegal] = useState({ title: "", content_markdown: "", updated_at: "" });
  const [payCfg, setPayCfg] = useState({
    provider: "disabled",
    enabled: false,
    stripe_api_key: "",
    stripe_api_key_masked: "",
    packages: [],
    provider_keys: {},          // editable values (empty = keep stored)
    provider_keys_masked: {},   // shown next to each field
    supported_providers: ["stripe"],
    known_providers: ["stripe","paypal","mollie","klarna","paddle","custom"],
  });

  const loadAll = async () => {
    try {
      const [r, u, a, p] = await Promise.all([
        api.get("/admin/reports"),
        api.get("/admin/users"),
        api.get("/admin/audit"),
        api.get("/admin/moderation/photos", { params: { threshold: 0.5 } }),
      ]);
      setReports(r.data.reports); setUsers(u.data.users); setAudit(a.data.events); setPhotos(p.data.photos);
    } catch (e) {
      toast.error("Admin-Zugriff verweigert oder Ladefehler");
    }
    if (user?.role === "admin" || user?.role === "superadmin") {
      try { const v = await api.get("/admin/verifications", { params: { status: "pending" } }); setVerifs(v.data.verifications || []); } catch {}
      try {
        const ai = await api.get("/admin/ai-config");
        setAiCfg({ provider: ai.data.provider || "gemini", model: ai.data.model || "gemini-2.5-flash",
          base_url: ai.data.base_url || "", enabled: ai.data.enabled !== false,
          api_key: "", api_key_masked: ai.data.api_key_masked || "" });
      } catch {}
      try {
        const pc = await api.get("/admin/payment-config");
        setPayCfg({
          provider: pc.data.provider || "disabled",
          enabled: !!pc.data.enabled,
          stripe_api_key: "",
          stripe_api_key_masked: pc.data.stripe_api_key_masked || "",
          packages: pc.data.packages || [],
          provider_keys: {},
          provider_keys_masked: pc.data.provider_keys_masked || {},
          supported_providers: pc.data.supported_providers || ["stripe"],
          known_providers: pc.data.known_providers || ["stripe","paypal","mollie","klarna","paddle","custom"],
        });
      } catch {}
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [user?.role]);

  const updateStatus = async (id, status) => {
    await api.post(`/admin/reports/${id}/status`, { status });
    await loadAll();
  };
  const ban = async (uid, reason = "Policy violation") => { await api.post("/admin/ban", { user_id: uid, reason }); await loadAll(); };
  const unban = async (uid) => { await api.post(`/admin/unban/${uid}`); await loadAll(); };
  const reviewVerif = async (user_id, decision) => {
    try { await api.post("/admin/verifications/review", { user_id, decision }); toast.success("Entscheidung gespeichert"); await loadAll(); }
    catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };
  const loadLegal = async (key) => {
    try {
      const { data } = await api.get(`/legal/${key}`);
      setLegalKey(key);
      setLegal({ title: data.title || "", content_markdown: data.content_markdown || "", updated_at: data.updated_at || "" });
    } catch (e) { toast.error("Konnte Seite nicht laden"); }
  };
  const saveLegal = async () => {
    try {
      await api.put(`/admin/legal/${legalKey}`, { title: legal.title, content_markdown: legal.content_markdown });
      toast.success("Rechtliche Seite gespeichert");
      await loadLegal(legalKey);
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
  };
  const saveAi = async () => {
    try {
      const payload = { provider: aiCfg.provider, model: aiCfg.model, base_url: aiCfg.base_url || null, enabled: aiCfg.enabled };
      if (aiCfg.api_key?.trim()) payload.api_key = aiCfg.api_key.trim();
      await api.post("/admin/ai-config", payload);
      toast.success("KI-Konfiguration gespeichert");
      setAiCfg((c) => ({ ...c, api_key: "" }));
      loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
  };
  const savePay = async () => {
    try {
      const payload = {
        provider: payCfg.provider,
        enabled: payCfg.enabled,
        packages: payCfg.packages,
        provider_keys: payCfg.provider_keys, // only non-empty values overwrite
      };
      if (payCfg.stripe_api_key?.trim()) payload.stripe_api_key = payCfg.stripe_api_key.trim();
      await api.post("/admin/payment-config", payload);
      toast.success("Zahlungs-Konfiguration gespeichert");
      setPayCfg((c) => ({ ...c, stripe_api_key: "", provider_keys: {} }));
      loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
  };
  const setProviderKey = (pid, field, value) => {
    setPayCfg((c) => ({
      ...c,
      provider_keys: {
        ...(c.provider_keys || {}),
        [pid]: { ...((c.provider_keys || {})[pid] || {}), [field]: value },
      },
    }));
  };
  const updatePkg = (idx, patch) => {
    setPayCfg((c) => ({ ...c, packages: c.packages.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  };
  const addPkg = () => {
    setPayCfg((c) => ({
      ...c,
      packages: [...c.packages, { id: `pkg_${Date.now()}`, amount: 4.99, currency: "eur", desc: "Neues Paket", enabled: true, kind: "premium", days: 30 }],
    }));
  };
  const removePkg = (idx) => setPayCfg((c) => ({ ...c, packages: c.packages.filter((_, i) => i !== idx) }));

  if (!user || user.role === "user") {
    return (
      <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
        <div className="app-content flex flex-col min-h-screen"><AppHeader />
          <div className="flex-1 grid place-items-center px-4">
            <div className="max-w-md text-center rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-8 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
              <div className="font-display text-3xl tracking-tight mb-1">Nur für Admins</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">Dein Konto hat keine Moderations-Rolle.</div>
            </div>
          </div>
          <AppFooter />
        </div>
      </div>
    );
  }

  const isSuper = user.role === "admin" || user.role === "superadmin";

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Admin</div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-none">Moderation</h1>
          </div>
          <Tabs defaultValue="reports">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="reports" data-testid="admin-tab-reports">Reports</TabsTrigger>
              <TabsTrigger value="users" data-testid="admin-tab-users">Users</TabsTrigger>
              <TabsTrigger value="photos" data-testid="admin-tab-photos">Foto-Queue</TabsTrigger>
              <TabsTrigger value="verifications" data-testid="admin-tab-verifications">Verifizierungen</TabsTrigger>
              {isSuper && <TabsTrigger value="ai" data-testid="admin-tab-ai">KI-Konfig</TabsTrigger>}
              {isSuper && <TabsTrigger value="payments" data-testid="admin-tab-payments">Zahlungen</TabsTrigger>}
              {isSuper && <TabsTrigger value="legal" data-testid="admin-tab-legal" onClick={() => loadLegal(legalKey)}>Rechtliches</TabsTrigger>}
              <TabsTrigger value="audit" data-testid="admin-tab-audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="mt-4">
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ID</TableHead><TableHead>Ziel</TableHead><TableHead>Grund</TableHead><TableHead>Status</TableHead><TableHead>Aktionen</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.id.slice(0,8)}</TableCell>
                        <TableCell>{r.target_type} · <span className="font-mono text-xs">{r.target_id.slice(0,8)}</span></TableCell>
                        <TableCell>{r.reason}</TableCell>
                        <TableCell><Badge variant={r.status==="resolved"?"secondary":"outline"}>{r.status}</Badge></TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "reviewing")}>Prüfen</Button>
                          <Button size="sm" onClick={() => updateStatus(r.id, "resolved")} data-testid={`admin-resolve-${r.id}`}>Erledigt</Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "rejected")}>Verwerfen</Button>
                          {r.target_type === "user" && <Button size="sm" variant="destructive" onClick={() => ban(r.target_id, r.reason)}>Bannen</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {reports.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Keine Meldungen.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-4 space-y-3">
              <Input placeholder="Suche E-Mail / Name" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={async (e) => { if (e.key === "Enter") { const { data } = await api.get("/admin/users", { params: { q: search } }); setUsers(data.users); } }} />
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Alter</TableHead><TableHead>Rolle</TableHead><TableHead>Status</TableHead><TableHead>Aktionen</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.display_name}</TableCell>
                        <TableCell className="font-mono text-xs">{u.email}</TableCell>
                        <TableCell>{u.age}</TableCell>
                        <TableCell><Badge variant="outline">{u.role || "user"}</Badge></TableCell>
                        <TableCell className="space-x-1">
                          {u.banned && <Badge variant="destructive">banned</Badge>}
                          {u.shadow_restricted && <Badge variant="secondary">shadow</Badge>}
                          {u.id_verified && <Badge>ID</Badge>}
                          {!u.banned && !u.shadow_restricted && <Badge variant="secondary">aktiv</Badge>}
                        </TableCell>
                        <TableCell>
                          {u.banned
                            ? <Button size="sm" onClick={() => unban(u.id)}>Entbannen</Button>
                            : <Button size="sm" variant="destructive" onClick={() => ban(u.id)}>Bannen</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {photos.map((p) => (
                  <div key={p.photo.id} className="relative aspect-square rounded-md overflow-hidden border bg-[hsl(var(--muted))]">
                    <img src={p.photo.data} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[11px] px-2 py-1">
                      <div>{p.display_name} · NSFW {(p.photo.nsfw_score*100).toFixed(0)}%</div>
                      <div className="flex gap-2 mt-1">
                        <button className="underline" onClick={() => ban(p.user_id, "NSFW violation")}>Owner bannen</button>
                      </div>
                    </div>
                  </div>
                ))}
                {photos.length === 0 && <div className="col-span-full text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Keine markierten Fotos.</div>}
              </div>
            </TabsContent>

            <TabsContent value="verifications" className="mt-4">
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>User</TableHead><TableHead>Dokument-Typ</TableHead><TableHead>Selfie</TableHead><TableHead>Dokument</TableHead><TableHead>Eingereicht</TableHead><TableHead>Aktionen</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {verifs.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.user_id?.slice(0,8)}</TableCell>
                        <TableCell>{v.document_type}</TableCell>
                        <TableCell>{v.selfie_data_url ? <img src={v.selfie_data_url} alt="selfie" className="h-16 w-16 object-cover rounded" /> : "-"}</TableCell>
                        <TableCell>{v.document_data_url ? <img src={v.document_data_url} alt="doc" className="h-16 w-24 object-cover rounded" /> : "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{v.submitted_at}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" onClick={() => reviewVerif(v.user_id, "approved")} data-testid={`verif-approve-${v.user_id}`}>Genehmigen</Button>
                          <Button size="sm" variant="destructive" onClick={() => reviewVerif(v.user_id, "rejected")}>Ablehnen</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {verifs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Keine offenen Verifizierungen.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {isSuper && (
              <TabsContent value="ai" className="mt-4">
                <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4 max-w-2xl">
                  <div className="font-display text-lg">KI-Moderationsanbieter</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Provider</Label>
                      <Select value={aiCfg.provider} onValueChange={(v) => setAiCfg({ ...aiCfg, provider: v })}>
                        <SelectTrigger data-testid="ai-provider-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="ollama">Ollama (self-hosted)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Modell</Label>
                      <Input value={aiCfg.model} onChange={(e) => setAiCfg({ ...aiCfg, model: e.target.value })} data-testid="ai-model-input" />
                    </div>
                    <div className="col-span-2">
                      <Label>Base URL (optional, Ollama etc.)</Label>
                      <Input value={aiCfg.base_url} onChange={(e) => setAiCfg({ ...aiCfg, base_url: e.target.value })} placeholder="http://localhost:11434" />
                    </div>
                    <div className="col-span-2">
                      <Label>API-Key {aiCfg.api_key_masked && <span className="text-xs text-[hsl(var(--muted-foreground))]">({aiCfg.api_key_masked} gespeichert)</span>}</Label>
                      <Input type="password" value={aiCfg.api_key} onChange={(e) => setAiCfg({ ...aiCfg, api_key: e.target.value })} placeholder="Leer lassen um gespeicherten Key zu behalten" data-testid="ai-apikey-input" />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <div>
                        <Label>KI-Moderation aktiv</Label>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">Fotos werden beim Upload automatisch geprüft.</div>
                      </div>
                      <Switch checked={aiCfg.enabled} onCheckedChange={(v) => setAiCfg({ ...aiCfg, enabled: v })} data-testid="ai-enabled-switch" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveAi} data-testid="ai-save-button">Speichern</Button>
                  </div>
                </div>
              </TabsContent>
            )}

            {isSuper && (
              <TabsContent value="payments" className="mt-4">
                <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="font-display text-lg">Zahlungsanbieter & Preise</div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Aktiv</Label>
                      <Switch checked={payCfg.enabled} onCheckedChange={(v) => setPayCfg({ ...payCfg, enabled: v })} data-testid="pay-enabled-switch" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Aktiver Anbieter</Label>
                      <Select value={payCfg.provider} onValueChange={(v) => setPayCfg({ ...payCfg, provider: v })}>
                        <SelectTrigger data-testid="pay-provider-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">Deaktiviert</SelectItem>
                          {(payCfg.known_providers || []).map((p) => (
                            <SelectItem key={p} value={p}>
                              {p === "stripe" ? "Stripe" : p === "paypal" ? "PayPal" : p === "mollie" ? "Mollie" : p === "klarna" ? "Klarna" : p === "paddle" ? "Paddle" : "Benutzerdefiniert"}
                              {(payCfg.supported_providers || []).includes(p) ? " ✓" : " (Platzhalter)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                        ✓ = live integriert. Andere Anbieter können Keys speichern, benötigen aber noch eine Integration.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-display text-base">Anbieter-Schlüssel</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Stripe */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-stripe">
                        <div className="font-medium flex items-center justify-between">
                          <span>Stripe <span className="text-xs text-[hsl(var(--accent))]">live</span></span>
                        </div>
                        <Label className="text-xs">Secret Key {payCfg.provider_keys_masked?.stripe?.secret_key && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.stripe.secret_key} gespeichert)</span>}</Label>
                        <Input type="password" placeholder="sk_live_..." onChange={(e) => setProviderKey("stripe", "secret_key", e.target.value)} data-testid="pay-stripe-secret-input" />
                      </div>
                      {/* PayPal */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-paypal">
                        <div className="font-medium">PayPal <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Client ID {payCfg.provider_keys_masked?.paypal?.client_id && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.paypal.client_id} gespeichert)</span>}</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paypal", "client_id", e.target.value)} data-testid="pay-paypal-client-input" />
                        <Label className="text-xs">Secret {payCfg.provider_keys_masked?.paypal?.secret && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.paypal.secret} gespeichert)</span>}</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paypal", "secret", e.target.value)} data-testid="pay-paypal-secret-input" />
                      </div>
                      {/* Mollie */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-mollie">
                        <div className="font-medium">Mollie <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">API Key {payCfg.provider_keys_masked?.mollie?.api_key && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.mollie.api_key} gespeichert)</span>}</Label>
                        <Input type="password" onChange={(e) => setProviderKey("mollie", "api_key", e.target.value)} data-testid="pay-mollie-key-input" />
                      </div>
                      {/* Klarna */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-klarna">
                        <div className="font-medium">Klarna <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Username</Label>
                        <Input type="password" onChange={(e) => setProviderKey("klarna", "username", e.target.value)} data-testid="pay-klarna-user-input" />
                        <Label className="text-xs">Password</Label>
                        <Input type="password" onChange={(e) => setProviderKey("klarna", "password", e.target.value)} data-testid="pay-klarna-pass-input" />
                      </div>
                      {/* Paddle */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-paddle">
                        <div className="font-medium">Paddle <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Vendor ID</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paddle", "vendor_id", e.target.value)} />
                        <Label className="text-xs">API Key</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paddle", "api_key", e.target.value)} />
                      </div>
                      {/* Custom */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-custom">
                        <div className="font-medium">Benutzerdefiniert <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Endpoint</Label>
                        <Input onChange={(e) => setProviderKey("custom", "endpoint", e.target.value)} placeholder="https://..." />
                        <Label className="text-xs">Token</Label>
                        <Input type="password" onChange={(e) => setProviderKey("custom", "token", e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-display text-base">Pakete</Label>
                      <Button size="sm" variant="outline" onClick={addPkg} data-testid="pay-add-package">+ Paket</Button>
                    </div>
                    <div className="space-y-3">
                      {payCfg.packages.map((p, idx) => (
                        <div key={p.id} className="rounded-md border p-3 grid grid-cols-2 md:grid-cols-6 gap-2" data-testid={`pay-package-${idx}`}>
                          <div className="col-span-2"><Label className="text-xs">ID</Label><Input value={p.id} onChange={(e) => updatePkg(idx, { id: e.target.value })} /></div>
                          <div><Label className="text-xs">Betrag</Label><Input type="number" step="0.01" value={p.amount} onChange={(e) => updatePkg(idx, { amount: Number(e.target.value) })} /></div>
                          <div><Label className="text-xs">Währung</Label><Input value={p.currency} onChange={(e) => updatePkg(idx, { currency: e.target.value })} /></div>
                          <div>
                            <Label className="text-xs">Art</Label>
                            <Select value={p.kind} onValueChange={(v) => updatePkg(idx, { kind: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="premium">Premium</SelectItem>
                                <SelectItem value="boost">Boost</SelectItem>
                                <SelectItem value="other">Sonstiges</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            {p.kind === "premium" ? (
                              <><Label className="text-xs">Tage</Label><Input type="number" value={p.days || ""} onChange={(e) => updatePkg(idx, { days: Number(e.target.value) || null })} /></>
                            ) : p.kind === "boost" ? (
                              <><Label className="text-xs">Minuten</Label><Input type="number" value={p.minutes || ""} onChange={(e) => updatePkg(idx, { minutes: Number(e.target.value) || null })} /></>
                            ) : null}
                          </div>
                          <div className="col-span-2 md:col-span-4"><Label className="text-xs">Beschreibung</Label><Input value={p.desc} onChange={(e) => updatePkg(idx, { desc: e.target.value })} /></div>
                          <div className="flex items-end gap-2 col-span-2">
                            <label className="inline-flex items-center gap-2 text-sm"><Switch checked={p.enabled !== false} onCheckedChange={(v) => updatePkg(idx, { enabled: v })} /> aktiv</label>
                            <Button size="sm" variant="destructive" onClick={() => removePkg(idx)}>Entfernen</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={savePay} data-testid="pay-save-button">Speichern</Button>
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Hinweis: ID-Verifizierung ist generell kostenlos und wird hier nicht als Paket verwaltet. Nur „Stripe" führt aktuell einen echten Checkout durch.</div>
                </div>
              </TabsContent>
            )}

            {isSuper && (
              <TabsContent value="legal" className="mt-4">
                <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="font-display text-lg">Rechtliche Seiten</div>
                    <Select value={legalKey} onValueChange={(v) => loadLegal(v)}>
                      <SelectTrigger className="w-[260px]" data-testid="legal-page-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="terms">Nutzungsbedingungen</SelectItem>
                        <SelectItem value="privacy">Datenschutzerklärung</SelectItem>
                        <SelectItem value="imprint">Impressum</SelectItem>
                        <SelectItem value="community">Community-Richtlinien</SelectItem>
                        <SelectItem value="cookies">Cookie-Hinweis</SelectItem>
                        <SelectItem value="cancellation">Widerrufsbelehrung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Titel</Label>
                    <Input value={legal.title} onChange={(e) => setLegal({ ...legal, title: e.target.value })} data-testid="legal-title-input" />
                  </div>
                  <div>
                    <Label>Inhalt (Markdown)</Label>
                    <textarea
                      value={legal.content_markdown}
                      onChange={(e) => setLegal({ ...legal, content_markdown: e.target.value })}
                      className="w-full min-h-[320px] rounded-md border bg-background p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                      data-testid="legal-content-textarea"
                    />
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      Markdown unterstützt: # Überschriften, **fett**, _kursiv_, Listen, Links.
                      Zuletzt geändert: {(legal.updated_at || "").slice(0,10) || "—"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a href={`/legal/${legalKey}`} target="_blank" rel="noreferrer" className="text-sm underline text-[hsl(var(--muted-foreground))]" data-testid="legal-preview-link">Vorschau öffnen ↗</a>
                    <Button onClick={saveLegal} data-testid="legal-save-button">Speichern</Button>
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="audit" className="mt-4">
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[hsl(var(--border))]/60">
                  <div className="font-display text-lg tracking-tight">Audit-Log</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{audit.length} Ereignisse</div>
                </div>
                {audit.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Noch keine Ereignisse protokolliert.</div>
                ) : (
                  <ul className="divide-y divide-[hsl(var(--border))]/60">
                    {audit.map((ev) => (
                      <li key={ev.id} className="px-5 py-3 flex items-start gap-4 hover:bg-[hsl(var(--secondary))]/50 transition-colors">
                        <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] w-40 shrink-0">
                          {(ev.created_at || "").replace("T"," ").slice(0,19)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="rounded-full font-mono text-[10.5px]">{(ev.actor_id || "system").slice(0,8)}</Badge>
                            <span className="font-medium text-sm">{ev.action}</span>
                            {ev.target && <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">→ {ev.target.slice(0,8)}</span>}
                          </div>
                          {ev.meta && Object.keys(ev.meta || {}).length > 0 && (
                            <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-1 font-mono truncate">
                              {Object.entries(ev.meta).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" · ")}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
