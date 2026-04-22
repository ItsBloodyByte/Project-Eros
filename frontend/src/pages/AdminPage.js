import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { toast } from "sonner";

export default function AdminPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [search, setSearch] = useState("");

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
      toast.error("Admin access denied or failed to load");
    }
  };

  useEffect(() => { loadAll(); }, []);

  const updateStatus = async (id, status) => {
    await api.post(`/admin/reports/${id}/status`, { status });
    await loadAll();
  };

  const ban = async (uid, reason = "Policy violation") => {
    await api.post("/admin/ban", { user_id: uid, reason });
    await loadAll();
  };

  const unban = async (uid) => {
    await api.post(`/admin/unban/${uid}`);
    await loadAll();
  };

  if (!user || (user.role === "user")) {
    return (
      <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
        <div className="app-content"><AppHeader />
          <div className="max-w-xl mx-auto p-8 text-center">
            <div className="font-display text-2xl">Admins only</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Your account does not have a moderation role.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="font-display text-3xl mb-4">Admin · Moderation</h1>
          <Tabs defaultValue="reports">
            <TabsList>
              <TabsTrigger value="reports" data-testid="admin-tab-reports">Reports</TabsTrigger>
              <TabsTrigger value="users" data-testid="admin-tab-users">Users</TabsTrigger>
              <TabsTrigger value="photos" data-testid="admin-tab-photos">Photo queue</TabsTrigger>
              <TabsTrigger value="audit" data-testid="admin-tab-audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="mt-4">
              <div className="rounded-md border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.id.slice(0,8)}</TableCell>
                        <TableCell>{r.target_type} · <span className="font-mono text-xs">{r.target_id.slice(0,8)}</span></TableCell>
                        <TableCell>{r.reason}</TableCell>
                        <TableCell><Badge variant={r.status==="resolved"?"secondary":"outline"}>{r.status}</Badge></TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "reviewing")}>Review</Button>
                          <Button size="sm" onClick={() => updateStatus(r.id, "resolved")} data-testid={`admin-resolve-${r.id}`}>Resolve</Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "rejected")}>Reject</Button>
                          {r.target_type === "user" && <Button size="sm" variant="destructive" onClick={() => ban(r.target_id, r.reason)}>Ban user</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {reports.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">No reports.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-4 space-y-3">
              <Input placeholder="Search email / name" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={async (e) => { if (e.key === "Enter") { const { data } = await api.get("/admin/users", { params: { q: search } }); setUsers(data.users); } }} />
              <div className="rounded-md border bg-card overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Age</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.display_name}</TableCell>
                        <TableCell className="font-mono text-xs">{u.email}</TableCell>
                        <TableCell>{u.age}</TableCell>
                        <TableCell><Badge variant="outline">{u.role || "user"}</Badge></TableCell>
                        <TableCell>{u.banned ? <Badge variant="destructive">banned</Badge> : <Badge variant="secondary">active</Badge>}</TableCell>
                        <TableCell>
                          {u.banned
                            ? <Button size="sm" onClick={() => unban(u.id)}>Unban</Button>
                            : <Button size="sm" variant="destructive" onClick={() => ban(u.id)}>Ban</Button>}
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
                        <button className="underline" onClick={() => ban(p.user_id, "NSFW violation")}>Ban owner</button>
                      </div>
                    </div>
                  </div>
                ))}
                {photos.length === 0 && <div className="col-span-full text-center text-sm text-[hsl(var(--muted-foreground))] py-6">No flagged photos.</div>}
              </div>
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <div className="rounded-md border bg-card overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead>
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
