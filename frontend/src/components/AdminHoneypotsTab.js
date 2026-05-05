import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Trash2, Plus, RefreshCcw } from "lucide-react";

/**
 * AdminHoneypotsTab — manage honey-pot trap profiles + the shadow-banned
 * users they've caught.
 *
 * Honeypots are profiles only bots/scrapers ever reach (filtered out of
 * /discover for normal users). Any non-staff interaction with one triggers a
 * shadow-ban that the actor never feels — their UI keeps "succeeding" but
 * actions are dropped. This tab gives moderators full visibility + control.
 */
export function AdminHoneypotsTab({ isSuper }) {
  const [tab, setTab] = useState("traps");
  const [traps, setTraps] = useState([]);
  const [shadowed, setShadowed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    display_name: "", age: 28, gender_identity: "woman", orientation: "straight",
    bio: "", honeypot_note: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        api.get("/admin/honeypots"),
        api.get("/admin/shadow-banned?reason=honeypot_trigger"),
      ]);
      setTraps(t.data?.honeypots || []);
      setShadowed(s.data?.users || []);
    } catch (e) {
      toast.error("Honey-Pots konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const createTrap = async () => {
    if (!form.display_name || !form.age) {
      toast.error("Anzeigename + Alter sind Pflicht.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/honeypots", form);
      toast.success("Honey-Pot angelegt");
      setCreateOpen(false);
      setForm({ display_name: "", age: 28, gender_identity: "woman", orientation: "straight", bio: "", honeypot_note: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Anlegen fehlgeschlagen");
    } finally { setSaving(false); }
  };

  const deleteTrap = async (id) => {
    if (!window.confirm("Honey-Pot wirklich löschen? Bestehende Shadow-Bans bleiben erhalten.")) return;
    try {
      await api.delete(`/admin/honeypots/${id}`);
      toast.success("Honey-Pot entfernt");
      load();
    } catch { toast.error("Löschen fehlgeschlagen"); }
  };

  const unban = async (uid) => {
    if (!window.confirm("Shadow-Ban aufheben? Der User sieht seine Aktionen wieder normal wirken.")) return;
    try {
      await api.post(`/admin/shadow-unban/${uid}`);
      toast.success("Shadow-Ban aufgehoben");
      load();
    } catch { toast.error("Unban fehlgeschlagen"); }
  };

  const hardBan = async (uid) => {
    const reason = window.prompt("Grund für den harten Bann (für die Audit-Logs):", "Honey-Pot Trigger bestätigt");
    if (!reason) return;
    try {
      await api.post("/admin/ban", { user_id: uid, reason });
      toast.success("User dauerhaft gebannt");
      load();
    } catch { toast.error("Ban fehlgeschlagen"); }
  };

  return (
    <Card data-testid="admin-honeypots-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[hsl(var(--accent))]" />
          Honey-Pots & Shadow-Bans
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} data-testid="admin-honeypots-refresh">
            <RefreshCcw className="h-4 w-4 mr-1" /> Aktualisieren
          </Button>
          {isSuper && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="admin-honeypots-create-btn">
                  <Plus className="h-4 w-4 mr-1" /> Neue Falle
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" data-testid="admin-honeypots-create-dialog">
                <DialogHeader>
                  <DialogTitle>Honey-Pot anlegen</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>Anzeigename</Label>
                    <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} data-testid="hp-name" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Alter</Label>
                      <Input type="number" min={18} max={99} value={form.age} onChange={(e) => setForm({ ...form, age: parseInt(e.target.value || "0", 10) })} data-testid="hp-age" />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <div>
                        <Label>Geschlecht</Label>
                        <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
                          <SelectTrigger data-testid="hp-gender"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["woman","man","nonbinary","trans_woman","trans_man","other"].map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Orientierung</Label>
                        <Select value={form.orientation} onValueChange={(v) => setForm({ ...form, orientation: v })}>
                          <SelectTrigger data-testid="hp-orient"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["straight","gay","bisexual","pansexual","queer","asexual","questioning"].map((o) => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Bio (optional)</Label>
                    <Textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="hp-bio" />
                  </div>
                  <div>
                    <Label>Notiz für Moderator:innen (optional)</Label>
                    <Textarea rows={2} value={form.honeypot_note} onChange={(e) => setForm({ ...form, honeypot_note: e.target.value })} data-testid="hp-note" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
                  <Button onClick={createTrap} disabled={saving} data-testid="hp-save">{saving ? "Speichert…" : "Anlegen"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="traps" data-testid="hp-tab-traps">Fallen ({traps.length})</TabsTrigger>
            <TabsTrigger value="caught" data-testid="hp-tab-caught">
              Geblockte Bots
              {shadowed.length > 0 && <Badge variant="destructive" className="ml-1.5">{shadowed.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="traps" className="space-y-2">
            {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Wird geladen…</p>
              : traps.length === 0 ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Noch keine Fallen angelegt. Eine Falle bleibt für reguläre User unsichtbar; jede Bot-Interaktion löst einen Shadow-Ban aus.</p>
              : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Demografie</TableHead>
                        <TableHead className="text-right">Treffer</TableHead>
                        <TableHead className="hidden md:table-cell">Notiz</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {traps.map((hp) => (
                        <TableRow key={hp.id} data-testid={`hp-row-${hp.id}`}>
                          <TableCell className="font-medium">{hp.display_name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs">
                            {hp.age} · {hp.gender_identity}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={hp.trigger_count > 0 ? "destructive" : "secondary"}>{hp.trigger_count || 0}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-[hsl(var(--muted-foreground))] max-w-[200px] truncate">
                            {hp.honeypot_note || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isSuper && (
                              <Button size="sm" variant="ghost" onClick={() => deleteTrap(hp.id)} data-testid={`hp-delete-${hp.id}`}>
                                <Trash2 className="h-4 w-4 text-[hsl(var(--destructive))]" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </TabsContent>

          <TabsContent value="caught" className="space-y-2">
            {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Wird geladen…</p>
              : shadowed.length === 0 ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Keine Honey-Pot Treffer bisher.</p>
              : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="hidden sm:table-cell">Banned-Datum</TableHead>
                        <TableHead className="text-right">Aktionen-Trail</TableHead>
                        <TableHead className="text-right">Maßnahmen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shadowed.map((u) => (
                        <TableRow key={u.id} data-testid={`hp-caught-${u.id}`}>
                          <TableCell>
                            <div className="font-medium">{u.display_name}</div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">{u.email}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs">
                            {u.shadow_banned_at ? new Date(u.shadow_banned_at).toLocaleString("de-DE") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <Badge variant="outline">{(u.shadow_ban_triggers || []).length} Trigger</Badge>
                            <div className="mt-1 max-w-[180px] ml-auto truncate text-[hsl(var(--muted-foreground))]">
                              {(u.shadow_ban_triggers || []).slice(-3).map((t) => t.action).join(" · ")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => unban(u.id)} data-testid={`hp-unban-${u.id}`}>
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                              {isSuper && (
                                <Button size="sm" variant="destructive" onClick={() => hardBan(u.id)} data-testid={`hp-hardban-${u.id}`}>
                                  Hart-Bann
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default AdminHoneypotsTab;
