import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { toast } from "sonner";
import { Plus, Images, Lock, Share2, ImagePlus, KeyRound } from "lucide-react";

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
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-3xl">Albums</h1>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button data-testid="albums-create-button" className="gap-1"><Plus className="h-4 w-4" /> New album</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create album</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="album-title-input" /></div>
                  <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_nsfw} onCheckedChange={(v) => setForm({ ...form, is_nsfw: v })} /> Contains sensitive (18+) content</label>
                </div>
                <DialogFooter><Button onClick={create} data-testid="album-create-submit">Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? <div className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</div> :
            albums.length === 0 ? (
              <div className="rounded-md border bg-card p-8 text-center">
                <Images className="h-6 w-6 mx-auto text-[hsl(var(--muted-foreground))]" />
                <div className="font-display text-xl mt-2">No albums yet</div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">Create a private album to share selectively with matches.</div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {albums.map((a) => (
                  <button key={a.id} onClick={() => setOpenAlbum(a)}
                    className="text-left rounded-[var(--radius-md)] border bg-card overflow-hidden hover:border-[hsl(var(--accent))]/40 transition-colors"
                    data-testid={`album-${a.id}`}>
                    <div className="aspect-[4/3] grid grid-cols-3 gap-0.5 bg-[hsl(var(--muted))]">
                      {(a.photos || []).slice(0,3).map((p) => (
                        <img key={p.id} src={p.data} alt="" className={`h-full w-full object-cover ${p.nsfw_score>=0.75?"blur-md":""}`} />
                      ))}
                      {(a.photos || []).length === 0 && (
                        <div className="col-span-3 grid place-items-center text-sm text-[hsl(var(--muted-foreground))]">Empty</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="font-display text-lg">{a.title} {a.is_nsfw && <Lock className="inline h-3 w-3 text-[hsl(var(--nsfw))]" />}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{(a.photos || []).length} photos · shared with {(a.shared_with || []).length}</div>
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
                    <div className="text-sm font-medium flex items-center gap-1"><Share2 className="h-4 w-4" /> Share with a match</div>
                    <div className="flex gap-2 mt-2">
                      <Select value={shareUser} onValueChange={setShareUser}>
                        <SelectTrigger className="flex-1" data-testid="album-share-select"><SelectValue placeholder="Pick a match" /></SelectTrigger>
                        <SelectContent>
                          {matches.map((m) => <SelectItem key={m.user.id} value={m.user.id}>{m.user.display_name}</SelectItem>)}
                          {matches.length === 0 && <div className="p-2 text-xs text-[hsl(var(--muted-foreground))]">No matches yet</div>}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => shareAlbum(openAlbum.id)} data-testid="album-share-button">Share</Button>
                    </div>
                    {(openAlbum.unlock_requests || []).length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium flex items-center gap-1"><KeyRound className="h-4 w-4" /> Unlock requests</div>
                        <div className="space-y-1 mt-1">
                          {openAlbum.unlock_requests.map((r) => (
                            <div key={r.id} className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{r.from_user} · {r.message || "(no note)"}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
