import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";
import { Gift, Settings2, Trash2, Copy, Calendar, Users, Sparkles, PowerOff } from "lucide-react";

const EMPTY_FORM = {
  code: "",
  kind: "premium_days",
  value: 30,
  max_uses: "",
  starts_at: "",
  expires_at: "",
  one_per_user: true,
  new_users_only: false,
  auto_on_register: false,
  active: true,
  description: "",
};

function toDatetimeLocal(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}
function fromDatetimeLocal(v) {
  if (!v) return null;
  try {
    return new Date(v).toISOString();
  } catch {
    return null;
  }
}

export function AdminPromosTab() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [config, setConfig] = useState(null);
  const [configBusy, setConfigBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        api.get("/admin/promo-codes"),
        api.get("/admin/platform-config"),
      ]);
      setCodes(d1.codes || []);
      setConfig(d2 || {});
    } catch (e) {
      toast.error(e.response?.data?.detail || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveConfig = async () => {
    if (!config) return;
    setConfigBusy(true);
    try {
      const { data } = await api.put("/admin/platform-config", {
        free_daily_like_limit: Number(config.free_daily_like_limit) || 0,
        super_like_daily_limit: Number(config.super_like_daily_limit) || 0,
        visitors_window_days: Number(config.visitors_window_days) || 30,
      });
      setConfig(data);
      toast.success("Plattform-Konfig gespeichert");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setConfigBusy(false);
    }
  };

  const createCode = async () => {
    if (!form.code.trim()) { toast.error("Code ist Pflicht"); return; }
    if (Number(form.value) <= 0) { toast.error("Wert muss > 0 sein"); return; }
    setBusy(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        kind: form.kind,
        value: Number(form.value),
        max_uses: form.max_uses === "" ? null : Number(form.max_uses),
        starts_at: fromDatetimeLocal(form.starts_at),
        expires_at: fromDatetimeLocal(form.expires_at),
        one_per_user: !!form.one_per_user,
        new_users_only: !!form.new_users_only,
        auto_on_register: !!form.auto_on_register,
        active: !!form.active,
        description: form.description.trim() || null,
      };
      await api.post("/admin/promo-codes", payload);
      toast.success(`Promo-Code ${payload.code} erstellt`);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Anlegen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.patch(`/admin/promo-codes/${c.id}`, { active: !c.active });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Aktualisieren fehlgeschlagen");
    }
  };
  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/admin/promo-codes/${confirmDelete.id}`);
      toast.success(`Promo ${confirmDelete.code} gelöscht`);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };
  const copyCode = (c) => {
    try { navigator.clipboard.writeText(c.code); toast.success(`${c.code} kopiert`); } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Plattform-Konfig */}
      <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <div className="font-display text-lg">Plattform-Konfiguration</div>
        </div>
        {!config ? (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Lädt …</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Free-Like-Limit / Tag</Label>
              <Input
                type="number" min="0" max="1000"
                value={config.free_daily_like_limit ?? 5}
                onChange={(e) => setConfig({ ...config, free_daily_like_limit: e.target.value })}
                data-testid="cfg-free-like-limit"
              />
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">0 = Keine Limitierung für Free-Nutzer</div>
            </div>
            <div>
              <Label className="text-xs">Super-Like-Limit / Tag (Premium)</Label>
              <Input
                type="number" min="0" max="100"
                value={config.super_like_daily_limit ?? 1}
                onChange={(e) => setConfig({ ...config, super_like_daily_limit: e.target.value })}
                data-testid="cfg-super-like-limit"
              />
            </div>
            <div>
              <Label className="text-xs">Visitors-Zeitfenster (Tage)</Label>
              <Input
                type="number" min="1" max="365"
                value={config.visitors_window_days ?? 30}
                onChange={(e) => setConfig({ ...config, visitors_window_days: e.target.value })}
                data-testid="cfg-visitors-days"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={saveConfig} disabled={configBusy || !config} data-testid="cfg-save">
            {configBusy ? "Speichere…" : "Konfig speichern"}
          </Button>
        </div>
      </div>

      {/* Neuer Promo-Code */}
      <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[hsl(var(--accent))]" />
          <div className="font-display text-lg">Neuer Promo-Code</div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Code</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="z. B. WELCOME30"
              data-testid="promo-code-input"
              maxLength={40}
            />
          </div>
          <div>
            <Label className="text-xs">Typ</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger data-testid="promo-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="premium_days">Premium-Tage</SelectItem>
                <SelectItem value="boost_minutes">Boost-Minuten</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Wert ({form.kind === "premium_days" ? "Tage" : "Minuten"})</Label>
            <Input
              type="number" min="1"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              data-testid="promo-value"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Max. Einlösungen (leer = unbegrenzt)</Label>
            <Input
              type="number" min="1"
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              placeholder="z. B. 100"
              data-testid="promo-max-uses"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Startzeitpunkt</Label>
            <Input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              data-testid="promo-starts-at"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Ablauf</Label>
            <Input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              data-testid="promo-expires-at"
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Beschreibung (intern)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Interne Notiz, z. B. Kampagne Valentinstag"
            />
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.one_per_user} onCheckedChange={(v) => setForm({ ...form, one_per_user: v })} data-testid="promo-one-per-user" />
              Nur 1× pro Nutzer:in
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.new_users_only} onCheckedChange={(v) => setForm({ ...form, new_users_only: v })} data-testid="promo-new-users-only" />
              Nur für neue Registrierungen (24h)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.auto_on_register} onCheckedChange={(v) => setForm({ ...form, auto_on_register: v })} data-testid="promo-auto-on-register" />
              Automatisch bei Registrierung gewähren
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="promo-active" />
              Aktiv
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={createCode} disabled={busy} data-testid="promo-create">
            {busy ? "Erstelle…" : "Promo-Code anlegen"}
          </Button>
        </div>
      </div>

      {/* Liste */}
      <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[hsl(var(--border))]">
          <Sparkles className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <div className="font-display">Aktive Promos & Kampagnen</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">· {codes.length}</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Typ / Wert</TableHead>
              <TableHead>Nutzung</TableHead>
              <TableHead>Regeln</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Lädt …</TableCell></TableRow>
            ) : codes.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Noch keine Promo-Codes.</TableCell></TableRow>
            ) : codes.map((c) => {
              const usagePct = c.max_uses ? Math.min(100, Math.round((c.used_count / c.max_uses) * 100)) : null;
              return (
                <TableRow key={c.id} data-testid={`promo-row-${c.code}`}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-sm font-semibold">{c.code}</code>
                      <button onClick={() => copyCode(c)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Code kopieren">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    {c.description && <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{c.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.kind === "premium_days" ? `${c.value} Tage Premium` : `${c.value} Min Boost`}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}</div>
                    {usagePct !== null && (
                      <div className="mt-1 h-1 w-24 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div className="h-full bg-[hsl(var(--accent))]" style={{ width: `${usagePct}%` }} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] space-y-0.5">
                    {c.one_per_user && <div>· 1× pro Nutzer:in</div>}
                    {c.new_users_only && <div>· Nur Neu-Registrierungen</div>}
                    {c.auto_on_register && <div>· Auto bei Registrierung</div>}
                    {c.starts_at && <div>· Ab {new Date(c.starts_at).toLocaleString()}</div>}
                    {c.expires_at && <div>· Bis {new Date(c.expires_at).toLocaleString()}</div>}
                  </TableCell>
                  <TableCell>
                    {c.active ? (
                      <Badge variant="secondary" className="text-[10px]">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] opacity-60">Inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-7 text-xs"
                      onClick={() => toggleActive(c)}
                      data-testid={`promo-toggle-${c.code}`}
                    >
                      <PowerOff className="h-3 w-3" />
                      {c.active ? "Deaktiv." : "Aktivieren"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1 h-7 text-xs"
                      onClick={() => setConfirmDelete(c)}
                      data-testid={`promo-delete-${c.code}`}
                    >
                      <Trash2 className="h-3 w-3" /> Löschen
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promo-Code löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Der Code <code className="font-mono">{confirmDelete?.code}</code> wird gelöscht. Bereits eingelöste Belohnungen
              bleiben bei den Nutzer:innen bestehen. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Endgültig löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminPromosTab;
