import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Slider } from "../components/ui/slider";
import { toast } from "sonner";
import { GENDERS, ORIENTATIONS, RELATIONSHIP_TYPES, SEEKING_ROLES } from "../lib/constants";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { ImagePlus, Star, Trash2 } from "lucide-react";

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) setForm({
      display_name: user.display_name,
      age: user.age,
      gender_identity: user.gender_identity || "",
      pronouns: user.pronouns || "",
      orientation: user.orientation || "",
      bio: user.bio || "",
      relationship_types: user.relationship_types || [],
      seeking_roles: user.seeking_roles || [],
      preferences: user.preferences || {},
    });
  }, [user]);

  if (!form || !user) return <div className="app-wrap dark:app-shell-bg app-shell-bg-light"><div className="app-content"><AppHeader /><div className="p-8">Loading...</div></div></div>;

  const toggleArr = (key, val, bucket = null) => {
    if (bucket) {
      const curr = form[bucket][key] || [];
      setForm({ ...form, [bucket]: { ...form[bucket], [key]: curr.includes(val) ? curr.filter((x) => x !== val) : [...curr, val] } });
    } else {
      const curr = form[key] || [];
      setForm({ ...form, [key]: curr.includes(val) ? curr.filter((x) => x !== val) : [...curr, val] });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/me", {
        display_name: form.display_name,
        age: Number(form.age),
        gender_identity: form.gender_identity || undefined,
        pronouns: form.pronouns || undefined,
        orientation: form.orientation || undefined,
        bio: form.bio || undefined,
        relationship_types: form.relationship_types,
        seeking_roles: form.seeking_roles,
        preferences: form.preferences,
      });
      await refresh();
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data } = await api.post("/me/photos", { data_url: dataUrl, is_primary: (user.photos || []).length === 0 });
      toast.success(`Analyzed. NSFW ${(data.nsfw_score*100).toFixed(0)}%, face: ${data.has_face}`);
      await refresh();
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (pid) => {
    await api.delete(`/me/photos/${pid}`);
    await refresh();
  };

  const makePrimary = async (pid) => {
    await api.post(`/me/photos/${pid}/primary`);
    await refresh();
  };

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <h1 className="font-display text-3xl">My profile</h1>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">Photos</div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {(user.photos || []).map((p) => (
                <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-md border bg-[hsl(var(--muted))]">
                  <NsfwBlurOverlay active={p.nsfw_score >= 0.75} revealed={true} onReveal={() => {}} className="h-full w-full">
                    <img src={p.data} alt="" className="h-full w-full object-cover" />
                  </NsfwBlurOverlay>
                  {p.is_primary && <div className="absolute left-1 top-1 rounded-full bg-black/55 text-white text-[10px] px-2 py-0.5 inline-flex items-center gap-1"><Star className="h-3 w-3" /> primary</div>}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/45 text-white text-[11px] px-2 py-1">
                    <span>{p.has_face ? "face" : "no face"} · NSFW {(p.nsfw_score*100).toFixed(0)}%</span>
                    <div className="flex gap-2">
                      {!p.is_primary && <button onClick={() => makePrimary(p.id)} className="underline">set primary</button>}
                      <button onClick={() => deletePhoto(p.id)} className="underline"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
              <label className="aspect-[3/4] grid place-items-center rounded-md border border-dashed hover:bg-[hsl(var(--secondary))] cursor-pointer text-sm text-[hsl(var(--muted-foreground))]">
                <div className="flex flex-col items-center gap-1">
                  <ImagePlus className="h-5 w-5" />
                  <span>{uploading ? "Analyzing..." : "Add photo"}</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} data-testid="me-photo-input" />
              </label>
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">Basics</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Display name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
              <div><Label>Age</Label><Input type="number" min={18} max={120} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              <div>
                <Label>Gender identity</Label>
                <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Pronouns</Label><Input value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} placeholder="they/them" /></div>
              <div className="col-span-2">
                <Label>Orientation</Label>
                <Select value={form.orientation} onValueChange={(v) => setForm({ ...form, orientation: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{ORIENTATIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Bio</Label>
                <Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">Looking for</div>
            <div>
              <Label className="text-sm">Relationship types</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {RELATIONSHIP_TYPES.map((r) => {
                  const on = form.relationship_types.includes(r.value);
                  return <button type="button" key={r.value} onClick={() => toggleArr("relationship_types", r.value)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>{r.label}</button>;
                })}
              </div>
            </div>
            <div>
              <Label className="text-sm">Seeking roles</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {SEEKING_ROLES.map((r) => {
                  const on = form.seeking_roles.includes(r.value);
                  return <button type="button" key={r.value} onClick={() => toggleArr("seeking_roles", r.value)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>{r.label}</button>;
                })}
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border bg-card p-5 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">Preferences</div>
            <div>
              <Label className="text-sm">Seeking genders</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {GENDERS.map((g) => {
                  const on = (form.preferences.seeking_genders || []).includes(g.value);
                  return <button type="button" key={g.value}
                    onClick={() => toggleArr("seeking_genders", g.value, "preferences")}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>{g.label}</button>;
                })}
              </div>
            </div>
            <div>
              <Label>Age range {form.preferences.age_min} – {form.preferences.age_max}</Label>
              <Slider min={18} max={99} value={[form.preferences.age_min, form.preferences.age_max]}
                onValueChange={([a,b]) => setForm({ ...form, preferences: { ...form.preferences, age_min: a, age_max: b } })}/>
            </div>
            <div>
              <Label>Distance radius {form.preferences.radius_km} km</Label>
              <Slider min={1} max={500} value={[form.preferences.radius_km || 50]}
                onValueChange={([v]) => setForm({ ...form, preferences: { ...form.preferences, radius_km: v } })}/>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} data-testid="save-profile-button">{saving ? "Saving..." : "Save profile"}</Button>
          </div>
        </main>
      </div>
    </div>
  );
}
