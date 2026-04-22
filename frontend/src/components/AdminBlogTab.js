import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";
import { RichTextEditor } from "./RichTextEditor";
import { FileText, Plus, Trash2, Eye, Save, X } from "lucide-react";

const EMPTY = {
  id: null, title: "", slug: "", excerpt: "", content_html: "",
  cover_image: "", tags: [], status: "draft",
};

export function AdminBlogTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // EMPTY shape
  const [busy, setBusy] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/blog/posts");
      setPosts(data.posts || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Blog laden fehlgeschlagen");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const startNew = () => setEditing({ ...EMPTY });
  const startEdit = async (p) => {
    // Fetch full post (list view strips content_html)
    try {
      const { data } = await api.get(`/blog/posts/${p.slug}`);
      setEditing({
        id: data.id,
        title: data.title || "",
        slug: data.slug || "",
        excerpt: data.excerpt || "",
        content_html: data.content_html || "",
        cover_image: data.cover_image || "",
        tags: data.tags || [],
        status: data.status || "draft",
      });
    } catch (e) {
      toast.error("Post konnte nicht geladen werden");
    }
  };

  const save = async (opts = {}) => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error("Titel ist Pflicht"); return; }
    setBusy(true);
    try {
      const payload = {
        title: editing.title.trim(),
        slug: editing.slug.trim() || undefined,
        excerpt: editing.excerpt.trim(),
        content_html: editing.content_html || "",
        cover_image: editing.cover_image.trim() || null,
        tags: editing.tags,
        status: opts.publish ? "published" : editing.status || "draft",
      };
      let res;
      if (editing.id) {
        const r = await api.patch(`/admin/blog/posts/${editing.id}`, payload);
        res = r.data;
      } else {
        const r = await api.post("/admin/blog/posts", payload);
        res = r.data;
      }
      toast.success(opts.publish ? "Veröffentlicht" : "Gespeichert");
      setEditing({
        id: res.id,
        title: res.title,
        slug: res.slug,
        excerpt: res.excerpt || "",
        content_html: res.content_html || editing.content_html,
        cover_image: res.cover_image || "",
        tags: res.tags || [],
        status: res.status,
      });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/admin/blog/posts/${confirmDelete.id}`);
      toast.success("Post gelöscht");
      setConfirmDelete(null);
      if (editing?.id === confirmDelete.id) setEditing(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Löschen fehlgeschlagen");
    }
  };

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v) return;
    if ((editing.tags || []).includes(v)) { setTagInput(""); return; }
    setEditing({ ...editing, tags: [...(editing.tags || []), v] });
    setTagInput("");
  };
  const removeTag = (t) => setEditing({ ...editing, tags: (editing.tags || []).filter((x) => x !== t) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[hsl(var(--accent))]" />
          <div className="font-display text-lg">Blog</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">· {posts.length}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm"><a href="/blog" target="_blank" rel="noreferrer" className="gap-1"><Eye className="h-4 w-4" /> Blog öffnen</a></Button>
          <Button onClick={startNew} data-testid="blog-new" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Neuer Beitrag</Button>
        </div>
      </div>

      {editing && (
        <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4" data-testid="blog-editor">
          <div className="flex items-start justify-between gap-2">
            <div className="font-display text-base">{editing.id ? "Beitrag bearbeiten" : "Neuer Beitrag"}</div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} title="Schließen"><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs">Titel</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Titel des Beitrags" data-testid="blog-title" />
            </div>
            <div>
              <Label className="text-xs">Slug (URL)</Label>
              <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="automatisch aus Titel" data-testid="blog-slug" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Excerpt (Kurztext)</Label>
              <Input value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} maxLength={500} placeholder="1-2 Sätze Zusammenfassung" data-testid="blog-excerpt" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger data-testid="blog-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Entwurf</SelectItem>
                  <SelectItem value="published">Veröffentlicht</SelectItem>
                  <SelectItem value="archived">Archiviert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Cover-Bild URL (optional)</Label>
              <Input value={editing.cover_image} onChange={(e) => setEditing({ ...editing, cover_image: e.target.value })} placeholder="https://…/cover.jpg" />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Tags</Label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Tag hinzufügen (Enter)" />
                <Button variant="outline" onClick={addTag} size="sm">Hinzufügen</Button>
              </div>
              {editing.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {editing.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(t)}>
                      {t} <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Inhalt</Label>
              <RichTextEditor
                value={editing.content_html}
                onChange={(html) => setEditing({ ...editing, content_html: html })}
                placeholder="Schreibe deinen Beitrag …"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            {editing.id && (
              <Button variant="destructive" onClick={() => setConfirmDelete({ id: editing.id, title: editing.title })} className="gap-1" data-testid="blog-delete">
                <Trash2 className="h-4 w-4" /> Löschen
              </Button>
            )}
            <Button variant="outline" onClick={() => save({ publish: false })} disabled={busy} data-testid="blog-save-draft" className="gap-1">
              <Save className="h-4 w-4" /> Entwurf speichern
            </Button>
            <Button onClick={() => save({ publish: true })} disabled={busy} data-testid="blog-publish" className="gap-1">
              Veröffentlichen
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Aktualisiert</TableHead>
              <TableHead>Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Lädt …</TableCell></TableRow>
            ) : posts.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Noch keine Beiträge. Starte oben mit „Neuer Beitrag".</TableCell></TableRow>
            ) : posts.map((p) => (
              <TableRow key={p.id} data-testid={`blog-row-${p.slug}`}>
                <TableCell>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono">/blog/{p.slug}</div>
                </TableCell>
                <TableCell>
                  {p.status === "published" ? <Badge>Veröffentlicht</Badge>
                    : p.status === "archived" ? <Badge variant="outline">Archiviert</Badge>
                    : <Badge variant="secondary">Entwurf</Badge>}
                </TableCell>
                <TableCell className="text-xs">{(p.tags || []).slice(0, 4).join(", ")}</TableCell>
                <TableCell className="text-xs font-mono">{p.updated_at?.slice(0, 16).replace("T", " ")}</TableCell>
                <TableCell className="space-x-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)} data-testid={`blog-edit-${p.slug}`}>Bearbeiten</Button>
                  {p.status === "published" && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">Ansehen</a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beitrag löschen</AlertDialogTitle>
            <AlertDialogDescription>
              „{confirmDelete?.title}" wird unwiderruflich gelöscht.
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

export default AdminBlogTab;
