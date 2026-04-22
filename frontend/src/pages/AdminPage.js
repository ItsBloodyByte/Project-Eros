import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
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
  const [payCfg, setPayCfg] = useState({ provider: "disabled", enabled: false, stripe_api_key: "", stripe_api_key_masked: "", packages: [] });

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
        provider: payCfg.provider, enabled: payCfg.enabled,
        packages: payCfg.packages,
      };
      if (payCfg.stripe_api_key?.trim()) payload.stripe_api_key = payCfg.stripe_api_key.trim();
      await api.post("/admin/payment-config", payload);
      toast.success("Zahlungs-Konfiguration gespeichert");
      setPayCfg((c) => ({ ...c, stripe_api_key: "" }));
      loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
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
      <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
        <div className="app-content"><AppHeader />
          <div className="max-w-xl mx-auto p-8 text-center">
            <div className="font-display text-2xl">Nur für Admins</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Dein Konto hat keine Moderations-Rolle.</div>
          </div>
        </div>
      </div>
    );
  }

  const isSuper = user.role === "admin" || user.role === "superadmin";

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="font-display text-3xl mb-4">Admin · Moderation</h1>
          <Tabs defaultValue="reports">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="reports" data-testid="admin-tab-reports">Reports</TabsTrigger>
              <TabsTrigger value="users" data-testid="admin-tab-users">Users</TabsTrigger>
              <TabsTrigger value="photos" data-testid="admin-tab-photos">Foto-Queue</TabsTrigger>
              <TabsTrigger value="verifications" data-testid="admin-tab-verifications">Verifizierungen</TabsTrigger>
              {isSuper && <TabsTrigger value="ai" data-testid="admin-tab-ai">KI-Konfig</TabsTrigger>}
              {isSuper && <TabsTrigger value="payments" data-testid="admin-tab-payments">Zahlungen</TabsTrigger>}
              <TabsTrigger value="audit" data-testid="admin-tab-audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="mt-4">
              <div className="rounded-md border bg-card overflow-hidden">
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
              <div className="rounded-md border bg-card overflow-hidden">
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
              <div className="rounded-md border bg-card overflow-hidden">
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
                <div className="rounded-md border bg-card p-5 space-y-4 max-w-2xl">
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
                <div className="rounded-md border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="font-display text-lg">Zahlungsanbieter & Preise</div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Aktiv</Label>
                      <Switch checked={payCfg.enabled} onCheckedChange={(v) => setPayCfg({ ...payCfg, enabled: v })} data-testid="pay-enabled-switch" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Provider</Label>
                      <Select value={payCfg.provider} onValueChange={(v) => setPayCfg({ ...payCfg, provider: v })}>
                        <SelectTrigger data-testid="pay-provider-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">Deaktiviert</SelectItem>
                          <SelectItem value="stripe">Stripe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Stripe API-Key {payCfg.stripe_api_key_masked && <span className="text-xs text-[hsl(var(--muted-foreground))]">({payCfg.stripe_api_key_masked} gespeichert)</span>}</Label>
                      <Input type="password" value={payCfg.stripe_api_key} onChange={(e) => setPayCfg({ ...payCfg, stripe_api_key: e.target.value })} placeholder="sk_test_..." data-testid="pay-apikey-input" />
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
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Hinweis: ID-Verifizierung ist generell kostenlos und wird hier nicht als Paket verwaltet.</div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="audit" className="mt-4">
              <div className="rounded-md border bg-card overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Zeit</TableHead><TableHead>Akteur</TableHead><TableHead>Aktion</TableHead><TableHead>Ziel</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {audit.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-mono text-xs">{ev.created_at}</TableCell>
                        <TableCell className="font-mono text-xs">{ev.actor_id?.slice(0,8)}</TableCell>
                        <TableCell>{ev.action}</TableCell>
                        <TableCell className="font-mono text-xs">{ev.target || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
