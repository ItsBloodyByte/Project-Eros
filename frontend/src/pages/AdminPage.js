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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
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
  const [reportDetail, setReportDetail] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [editUser, setEditUser] = useState(null); // full user doc
  const [editForm, setEditForm] = useState(null); // edited fields
  const [editSaving, setEditSaving] = useState(false);

  const openEditUser = async (uid) => {
    try {
      const { data } = await api.get(`/admin/users/${uid}`);
      setEditUser(data.user);
      setEditForm({
        display_name: data.user.display_name || "",
        email: data.user.email || "",
        age: data.user.age || 18,
        gender_identity: data.user.gender_identity || "",
        pronouns: data.user.pronouns || "",
        orientation: data.user.orientation || "",
        bio: data.user.bio || "",
        height_cm: data.user.height_cm || "",
        body_type: data.user.body_type || "",
        ethnicity: data.user.ethnicity || "",
        smoking: data.user.smoking || "",
        drinking: data.user.drinking || "",
        diet: data.user.diet || "",
        sti_status: data.user.sti_status || "",
        cup_size: data.user.cup_size || "",
        penis_length_cm: data.user.penis_length_cm || "",
        penis_girth_cm: data.user.penis_girth_cm || "",
        id_verified: !!data.user.id_verified,
        id_verification_status: data.user.id_verification_status || "",
        email_verified: !!data.user.email_verified,
        shadow_restricted: !!data.user.shadow_restricted,
        banned: !!data.user.banned,
        ban_reason: data.user.ban_reason || "",
        role: data.user.role || "user",
        premium_days: 0,
        boost_minutes: 0,
      });
    } catch (e) { toast.error(e.response?.data?.detail || "Konnte Nutzer nicht laden"); }
  };

  const saveEditUser = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const payload = { ...editForm };
      delete payload.premium_days; delete payload.boost_minutes;
      // Numeric conversions
      if (payload.age !== "" && payload.age !== null) payload.age = Number(payload.age);
      if (payload.height_cm !== "" && payload.height_cm !== null) payload.height_cm = Number(payload.height_cm) || null;
      if (payload.penis_length_cm !== "") payload.penis_length_cm = Number(payload.penis_length_cm) || null;
      if (payload.penis_girth_cm !== "") payload.penis_girth_cm = Number(payload.penis_girth_cm) || null;
      // Remove empty-string fields that should remain untouched (would set to empty)
      const clean = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v === "" && typeof editUser[k] !== "string") continue;
        clean[k] = v;
      }
      await api.patch(`/admin/users/${editUser.id}`, clean);
      // Role change via dedicated endpoint to allow superadmin check
      if (editForm.role && editForm.role !== editUser.role) {
        await api.post(`/admin/users/${editUser.id}/role`, { role: editForm.role });
      }
      toast.success("Profil gespeichert");
      await loadAll();
      setEditUser(null); setEditForm(null);
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
    finally { setEditSaving(false); }
  };

  const grantPremium = async (action) => {
    if (!editUser) return;
    try {
      const body = { action };
      if (action !== "revoke") {
        body.days = Number(editForm.premium_days || 0);
        body.boost_minutes = Number(editForm.boost_minutes || 0);
      }
      const { data } = await api.post(`/admin/users/${editUser.id}/premium`, body);
      setEditUser((u) => ({ ...u, premium_expires_at: data.premium_expires_at, boost_expires_at: data.boost_expires_at }));
      toast.success(action === "revoke" ? "Premium entzogen" : "Premium aktualisiert");
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };

  const deleteUserPhoto = async (pid) => {
    if (!editUser) return;
    try {
      await api.delete(`/admin/users/${editUser.id}/photos/${pid}`);
      setEditUser((u) => ({ ...u, photos: (u.photos || []).filter((p) => p.id !== pid) }));
      toast.success("Foto entfernt");
    } catch (e) { toast.error("Fehlgeschlagen"); }
  };

  const openReport = async (id) => {
    setReportLoading(true);
    setReportDetail({ loading: true, report: { id } });
    try {
      const { data } = await api.get(`/admin/reports/${id}`);
      setReportDetail(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Konnte Report nicht laden");
      setReportDetail(null);
    } finally {
      setReportLoading(false);
    }
  };

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
                      <TableRow key={r.id} className="cursor-pointer hover:bg-[hsl(var(--secondary))]/50" data-testid={`admin-report-row-${r.id}`}>
                        <TableCell className="font-mono text-xs" onClick={() => openReport(r.id)}>{r.id.slice(0,8)}</TableCell>
                        <TableCell onClick={() => openReport(r.id)}>{r.target_type} · <span className="font-mono text-xs">{r.target_id.slice(0,8)}</span></TableCell>
                        <TableCell className="max-w-[320px] truncate" onClick={() => openReport(r.id)}>{r.reason}</TableCell>
                        <TableCell><Badge variant={r.status==="resolved"?"secondary":"outline"}>{r.status}</Badge></TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openReport(r.id)} data-testid={`admin-report-open-${r.id}`}>Details</Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "reviewing")}>Prüfen</Button>
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
                        <TableCell className="space-x-1">
                          <Button size="sm" variant="outline" onClick={() => openEditUser(u.id)} data-testid={`admin-edit-user-${u.id}`}>Bearbeiten</Button>
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

          {/* Admin Edit User Dialog */}
          <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) { setEditUser(null); setEditForm(null); } }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Nutzer bearbeiten {editUser && <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">· {editUser.display_name}</span>}</DialogTitle>
              </DialogHeader>
              {editForm && editUser && (
                <div className="space-y-5 text-sm">
                  {/* Premium & Boost */}
                  <div className="rounded-md border p-4 space-y-3 bg-[hsl(var(--secondary))]/30">
                    <div className="font-display text-base flex items-center justify-between">
                      <span>Premium & Boost</span>
                      <div className="flex items-center gap-1.5 text-xs">
                        {editUser.premium_expires_at && new Date(editUser.premium_expires_at) > new Date()
                          ? <Badge className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">Premium aktiv bis {editUser.premium_expires_at.slice(0,10)}</Badge>
                          : <Badge variant="outline">Kein Premium</Badge>}
                        {editUser.boost_expires_at && new Date(editUser.boost_expires_at) > new Date()
                          && <Badge className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">Boost bis {editUser.boost_expires_at.slice(11,16)} UTC</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Premium Tage</Label>
                        <Input type="number" min="0" max="3650" value={editForm.premium_days}
                               onChange={(e) => setEditForm({ ...editForm, premium_days: e.target.value })}
                               data-testid="admin-edit-premium-days" />
                      </div>
                      <div>
                        <Label className="text-xs">Boost Minuten</Label>
                        <Input type="number" min="0" max="10080" value={editForm.boost_minutes}
                               onChange={(e) => setEditForm({ ...editForm, boost_minutes: e.target.value })}
                               data-testid="admin-edit-boost-minutes" />
                      </div>
                      <div className="flex gap-2 md:col-span-2">
                        <Button size="sm" onClick={() => grantPremium("grant")} data-testid="admin-premium-grant">Neu setzen</Button>
                        <Button size="sm" variant="secondary" onClick={() => grantPremium("extend")} data-testid="admin-premium-extend">Verlängern</Button>
                        <Button size="sm" variant="destructive" onClick={() => grantPremium("revoke")} data-testid="admin-premium-revoke">Entziehen</Button>
                      </div>
                    </div>
                  </div>

                  {/* Account & Role */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Anzeigename</Label>
                      <Input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} data-testid="admin-edit-name" />
                    </div>
                    <div>
                      <Label>E-Mail</Label>
                      <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} data-testid="admin-edit-email" />
                    </div>
                    <div>
                      <Label>Alter</Label>
                      <Input type="number" min="18" max="120" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} data-testid="admin-edit-age" />
                    </div>
                    <div>
                      <Label>Rolle</Label>
                      <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                        <SelectTrigger data-testid="admin-edit-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="content_reviewer">Content Reviewer</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {user?.role === "superadmin" && <SelectItem value="superadmin">Superadmin</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Geschlechtsidentität</Label>
                      <Input value={editForm.gender_identity} onChange={(e) => setEditForm({ ...editForm, gender_identity: e.target.value })} placeholder="woman / man / non_binary / …" />
                    </div>
                    <div>
                      <Label>Pronomen</Label>
                      <Input value={editForm.pronouns} onChange={(e) => setEditForm({ ...editForm, pronouns: e.target.value })} />
                    </div>
                    <div>
                      <Label>Orientierung</Label>
                      <Input value={editForm.orientation} onChange={(e) => setEditForm({ ...editForm, orientation: e.target.value })} placeholder="straight / gay / bi / …" />
                    </div>
                  </div>

                  <div>
                    <Label>Bio</Label>
                    <textarea className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} data-testid="admin-edit-bio" />
                  </div>

                  {/* Body & Lifestyle */}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="font-display text-base">Körper & Lifestyle</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div><Label className="text-xs">Größe (cm)</Label><Input type="number" value={editForm.height_cm} onChange={(e) => setEditForm({ ...editForm, height_cm: e.target.value })} /></div>
                      <div><Label className="text-xs">Körpertyp</Label><Input value={editForm.body_type} onChange={(e) => setEditForm({ ...editForm, body_type: e.target.value })} /></div>
                      <div><Label className="text-xs">Ethnizität</Label><Input value={editForm.ethnicity} onChange={(e) => setEditForm({ ...editForm, ethnicity: e.target.value })} /></div>
                      <div><Label className="text-xs">Rauchen</Label><Input value={editForm.smoking} onChange={(e) => setEditForm({ ...editForm, smoking: e.target.value })} /></div>
                      <div><Label className="text-xs">Alkohol</Label><Input value={editForm.drinking} onChange={(e) => setEditForm({ ...editForm, drinking: e.target.value })} /></div>
                      <div><Label className="text-xs">Ernährung</Label><Input value={editForm.diet} onChange={(e) => setEditForm({ ...editForm, diet: e.target.value })} /></div>
                      <div><Label className="text-xs">STI-Status</Label><Input value={editForm.sti_status} onChange={(e) => setEditForm({ ...editForm, sti_status: e.target.value })} /></div>
                      <div><Label className="text-xs">Cup Size</Label><Input value={editForm.cup_size} onChange={(e) => setEditForm({ ...editForm, cup_size: e.target.value })} /></div>
                      <div><Label className="text-xs">Penis Länge (cm)</Label><Input type="number" step="0.1" value={editForm.penis_length_cm} onChange={(e) => setEditForm({ ...editForm, penis_length_cm: e.target.value })} /></div>
                      <div><Label className="text-xs">Penis Umfang (cm)</Label><Input type="number" step="0.1" value={editForm.penis_girth_cm} onChange={(e) => setEditForm({ ...editForm, penis_girth_cm: e.target.value })} /></div>
                    </div>
                  </div>

                  {/* Status toggles */}
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="font-display text-base">Status & Flags</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.id_verified} onCheckedChange={(v) => setEditForm({ ...editForm, id_verified: v, id_verification_status: v ? "approved" : editForm.id_verification_status })} data-testid="admin-toggle-idverified" /> ID verifiziert</label>
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.email_verified} onCheckedChange={(v) => setEditForm({ ...editForm, email_verified: v })} /> E-Mail verifiziert</label>
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.shadow_restricted} onCheckedChange={(v) => setEditForm({ ...editForm, shadow_restricted: v })} /> Shadow restricted</label>
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.banned} onCheckedChange={(v) => setEditForm({ ...editForm, banned: v })} /> Gebannt</label>
                    </div>
                    {editForm.banned && (
                      <div>
                        <Label className="text-xs">Bann-Grund</Label>
                        <Input value={editForm.ban_reason} onChange={(e) => setEditForm({ ...editForm, ban_reason: e.target.value })} />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">ID Verifizierungs-Status</Label>
                      <Select value={editForm.id_verification_status || "none"} onValueChange={(v) => setEditForm({ ...editForm, id_verification_status: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— nicht gesetzt —</SelectItem>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="approved">approved</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Photos management */}
                  {(editUser.photos || []).length > 0 && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="font-display text-base">Fotos ({(editUser.photos || []).length})</div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {(editUser.photos || []).map((p) => (
                          <div key={p.id} className="relative aspect-[3/4] rounded-md overflow-hidden border bg-[hsl(var(--muted))]">
                            <img src={p.data} alt="" className={`h-full w-full object-cover ${p.nsfw_score >= 0.75 ? "blur-md" : ""}`} />
                            <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] px-1.5 py-0.5 flex items-center justify-between">
                              <span>NSFW {((p.nsfw_score || 0) * 100).toFixed(0)}%</span>
                              <button onClick={() => deleteUserPhoto(p.id)} className="underline" data-testid={`admin-delete-photo-${p.id}`}>löschen</button>
                            </div>
                            {p.is_primary && <div className="absolute left-1 top-1 rounded-full bg-black/55 text-white text-[9px] px-1.5 py-0.5">Haupt</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="ghost" onClick={() => { setEditUser(null); setEditForm(null); }}>Abbrechen</Button>
                <Button onClick={saveEditUser} disabled={editSaving} data-testid="admin-edit-save">{editSaving ? "Speichern…" : "Speichern"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Report Detail Dialog */}
          <Dialog open={!!reportDetail} onOpenChange={(v) => { if (!v) setReportDetail(null); }}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Report-Details</DialogTitle>
              </DialogHeader>
              {reportLoading || reportDetail?.loading ? (
                <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Lädt…</div>
              ) : reportDetail?.report ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoCell label="Report-ID" value={<span className="font-mono text-xs">{reportDetail.report.id}</span>} />
                    <InfoCell label="Status" value={<Badge variant={reportDetail.report.status==="resolved"?"secondary":"outline"}>{reportDetail.report.status}</Badge>} />
                    <InfoCell label="Ziel-Typ" value={reportDetail.report.target_type} />
                    <InfoCell label="Ziel-ID" value={<span className="font-mono text-xs">{reportDetail.report.target_id}</span>} />
                    <InfoCell label="Erstellt" value={<span className="font-mono text-xs">{(reportDetail.report.created_at || "").replace("T"," ").slice(0,19)}</span>} />
                    <InfoCell label="Reporter-Historie" value={`${reportDetail.reporter_history_count ?? 0} Reports`} />
                    <InfoCell label="Meldungen gegen Ziel" value={`${reportDetail.target_report_count ?? 0}`} />
                  </div>
                  <div className="rounded-md border p-3 bg-[hsl(var(--secondary))]/40">
                    <div className="text-xs uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">Grund</div>
                    <div className="whitespace-pre-wrap break-words">{reportDetail.report.reason || "—"}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <UserMiniCard title="Reporter" u={reportDetail.reporter} />
                    <UserMiniCard title="Gemeldet" u={reportDetail.reported} />
                  </div>

                  {reportDetail.target_context?.photo && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="text-xs uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Gemeldetes Foto</div>
                      <img src={reportDetail.target_context.photo.data} alt="gemeldet" className="max-h-64 object-contain rounded" />
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        NSFW: {((reportDetail.target_context.photo.nsfw_score || 0) * 100).toFixed(0)}% · Gesicht: {reportDetail.target_context.photo.has_face ? "ja" : "nein"}
                      </div>
                    </div>
                  )}
                  {reportDetail.target_context?.message && (
                    <div className="rounded-md border p-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">Gemeldete Nachricht</div>
                      <div className="whitespace-pre-wrap">{reportDetail.target_context.message.text}</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1 font-mono">
                        {reportDetail.target_context.message.created_at}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              <DialogFooter className="flex-wrap gap-2">
                {reportDetail?.report && (
                  <>
                    <Button variant="outline" onClick={() => updateStatus(reportDetail.report.id, "reviewing")} data-testid="report-detail-reviewing">Prüfen</Button>
                    <Button onClick={async () => { await updateStatus(reportDetail.report.id, "resolved"); setReportDetail(null); }} data-testid="report-detail-resolve">Erledigt</Button>
                    <Button variant="ghost" onClick={async () => { await updateStatus(reportDetail.report.id, "rejected"); setReportDetail(null); }}>Verwerfen</Button>
                    {reportDetail.report.target_type === "user" && reportDetail.reported?.id && (
                      <Button variant="destructive" onClick={async () => { await ban(reportDetail.reported.id, reportDetail.report.reason || "Policy violation"); setReportDetail(null); }} data-testid="report-detail-ban">
                        User bannen
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

function UserMiniCard({ title, u }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">{title}</div>
      {u ? (
        <div className="space-y-1">
          <div className="font-medium">{u.display_name || "—"} <span className="text-xs text-[hsl(var(--muted-foreground))]">({u.age || "?"})</span></div>
          <div className="text-xs font-mono break-all">{u.email}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline">{u.role || "user"}</Badge>
            {u.banned && <Badge variant="destructive">banned</Badge>}
            {u.shadow_restricted && <Badge variant="secondary">shadow</Badge>}
            {u.id_verified && <Badge>ID verifiziert</Badge>}
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            <a href={`/profile/${u.id}`} target="_blank" rel="noreferrer" className="underline">Profil öffnen ↗</a>
          </div>
        </div>
      ) : <div className="text-sm text-[hsl(var(--muted-foreground))]">Nicht verfügbar</div>}
    </div>
  );
}
