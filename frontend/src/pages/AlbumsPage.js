import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { ProfilePhotosPanel } from "../components/ProfilePhotosPanel";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { Plus, Images, Lock, Share2, ImagePlus, KeyRound, User } from "lucide-react";

export default function AlbumsPage() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", is_nsfw: false });
  const [openAlbum, setOpenAlbum] = useState(null);
  const [matches, setMatches] = useState([]);
  const [shareUser, setShareUser] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/albums");
      setAlbums(data.albums);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { (async () => { const { data } = await api.get("/matches"); setMatches(data.matches); })(); }, []);

  const create = async () => {
    try {
      await api.post("/albums", form);
      toast.success("Album created");
      setForm({ title: "", description: "", is_nsfw: false });
      setNewOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Create failed");
    }
  };

  const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

  const addPhoto = async (albumId, file) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data } = await api.post(`/albums/${albumId}/photos`, { data_url: dataUrl });
      toast.success(`Added (NSFW ${(data.nsfw_score*100).toFixed(0)}%)`);
      await load();
      if (openAlbum) {
        const { data: fresh } = await api.get(`/albums/${openAlbum.id}`);
        setOpenAlbum(fresh);
      }
    } catch (e) {
      toast.error("Upload failed");
    }
  };

  const shareAlbum = async (albumId) => {
    if (!shareUser) { toast.error("Pick a match to share with"); return; }
    try {
      await api.post("/albums/share", { album_id: albumId, user_id: shareUser });
      toast.success("Album shared");
      setShareUser("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Share failed");
    }
  };

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Fotos & Galerien</div>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-none">Alben</h1>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] max-w-prose">Verwalte deine Profilfotos und erstelle private Sammlungen, die du gezielt mit Matches teilst.</p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full" data-testid="albums-tabs">
            <TabsList className="mb-6" data-testid="albums-tabs-list">
              <TabsTrigger value="profile" data-testid="tab-profile-photos" className="gap-1.5">
                <User className="h-4 w-4" /> Profilfotos
              </TabsTrigger>
              <TabsTrigger value="albums" data-testid="tab-albums" className="gap-1.5">
                <Images className="h-4 w-4" /> Private Alben
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-0">
              <ProfilePhotosPanel title="Deine Profilfotos" />
              <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                Bis zu 5 Fotos – das erste Foto ist dein Primärfoto und wird in Entdecken, Matches und Chats angezeigt.
              </p>
            </TabsContent>

            <TabsContent value="albums" className="mt-0">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                  Private Alben sind nur für dich sichtbar, bis du sie gezielt mit einem Match teilst.
                </div>
                <Dialog open={newOpen} onOpenChange={setNewOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="albums-create-button" className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Neues Album</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Album erstellen</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="album-title-input" /></div>
                      <div><Label>Beschreibung</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                      <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_nsfw} onCheckedChange={(v) => setForm({ ...form, is_nsfw: v })} /> Sensibler (18+) Inhalt</label>
                    </div>
                    <DialogFooter><Button onClick={create} data-testid="album-create-submit">Erstellen</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5" data-testid="albums-skeleton">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden shadow-[var(--shadow-sm)]">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : albums.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-12 text-center shadow-[var(--shadow-sm)]">
              <Images className="h-7 w-7 mx-auto text-[hsl(var(--muted-foreground))]" />
              <div className="font-display text-2xl tracking-tight mt-3">Noch keine Alben</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Erstelle ein privates Album, um es später gezielt zu teilen.</div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {albums.map((a) => (
                <button key={a.id} onClick={() => setOpenAlbum(a)}
                  className="text-left rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden card-hover shadow-[var(--shadow-sm)]"
                  data-testid={`album-${a.id}`}>
                  <div className="aspect-[4/3] grid grid-cols-3 gap-0.5 bg-[hsl(var(--muted))]">
                    {(a.photos || []).slice(0, 3).map((p) => (
                      <img key={p.id} src={p.data} alt="" className={`h-full w-full object-cover ${p.nsfw_score >= 0.75 ? "blur-md" : ""}`} />
                    ))}
                    {(a.photos || []).length === 0 && (
                      <div className="col-span-3 grid place-items-center text-sm text-[hsl(var(--muted-foreground))]">Leer</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="font-display text-lg tracking-tight flex items-center gap-1.5">{a.title} {a.is_nsfw && <Lock className="h-3 w-3 text-[hsl(var(--nsfw))]" />}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{(a.photos || []).length} Fotos · geteilt mit {(a.shared_with || []).length}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <Dialog open={!!openAlbum} onOpenChange={(v) => !v && setOpenAlbum(null)}>
            <DialogContent className="max-w-2xl">
              {openAlbum && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">{openAlbum.title}</DialogTitle>
                  </DialogHeader>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">{openAlbum.description}</div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(openAlbum.photos || []).map((p) => (
                      <div key={p.id} className="relative aspect-square rounded-md overflow-hidden border bg-[hsl(var(--muted))]">
                        <NsfwBlurOverlay active={p.nsfw_score>=0.75} revealed={true} onReveal={() => {}} className="h-full w-full">
                          <img src={p.data} alt="" className="h-full w-full object-cover" />
                        </NsfwBlurOverlay>
                      </div>
                    ))}
                    <label className="aspect-square grid place-items-center rounded-md border border-dashed hover:bg-[hsl(var(--secondary))] cursor-pointer text-sm" data-testid="album-photo-upload">
                      <div className="flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" /><span>Add</span></div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && addPhoto(openAlbum.id, e.target.files[0])} />
                    </label>
                  </div>
                  <div className="mt-4 border-t pt-3">
                    <div className="text-sm font-medium flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Mit einem Match teilen</div>
                    <div className="flex gap-2 mt-2">
                      <Select value={shareUser} onValueChange={setShareUser}>
                        <SelectTrigger className="flex-1" data-testid="album-share-select"><SelectValue placeholder="Match wählen" /></SelectTrigger>
                        <SelectContent>
                          {matches.map((m) => <SelectItem key={m.user.id} value={m.user.id}>{m.user.display_name}</SelectItem>)}
                          {matches.length === 0 && <div className="p-2 text-xs text-[hsl(var(--muted-foreground))]">Noch keine Matches</div>}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => shareAlbum(openAlbum.id)} data-testid="album-share-button">Teilen</Button>
                    </div>
                    {(openAlbum.unlock_requests || []).length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium flex items-center gap-1.5"><KeyRound className="h-4 w-4" /> Freischalt-Anfragen</div>
                        <div className="space-y-1 mt-1">
                          {openAlbum.unlock_requests.map((r) => (
                            <div key={r.id} className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{r.from_user} · {r.message || "(keine Notiz)"}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
            </TabsContent>
          </Tabs>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
