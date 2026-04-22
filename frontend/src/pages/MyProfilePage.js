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
import {
  GENDERS, ORIENTATIONS, RELATIONSHIP_TYPES, SEEKING_ROLES,
  BODY_TYPES, SMOKING_VALUES, DRINKING_VALUES, DIET_VALUES, STI_VALUES,
  CUP_SIZES, PENIS_CATEGORIES, PENIS_RANGES, COMMON_LANGUAGES, COMMON_ETHNICITIES,
  COMMON_KINKS, penisCategoryFor, showsCupSize, showsPenisSize,
} from "../lib/constants";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { ImagePlus, Star, Trash2, Video, Play, GripVertical, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>
      {children}
    </button>
  );
}

export default function MyProfilePage() {
  const { t } = useTranslation();
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
      kinks: user.kinks || [],
      preferences: user.preferences || {},
      height_cm: user.height_cm || "",
      body_type: user.body_type || "",
      ethnicity: user.ethnicity || "",
      languages: user.languages || [],
      interests: user.interests || [],
      smoking: user.smoking || "",
      drinking: user.drinking || "",
      diet: user.diet || "",
      sti_status: user.sti_status || "",
      sti_tested_on: user.sti_tested_on || "",
      cup_size: user.cup_size || "",
      penis_length_cm: user.penis_length_cm || "",
      penis_girth_cm: user.penis_girth_cm || "",
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
      const payload = {
        display_name: form.display_name,
        // age is immutable - do not send
        gender_identity: form.gender_identity || undefined,
        pronouns: form.pronouns || undefined,
        orientation: form.orientation || undefined,
        bio: form.bio || undefined,
        relationship_types: form.relationship_types,
        seeking_roles: form.seeking_roles,
        kinks: form.kinks,
        preferences: form.preferences,
        height_cm: form.height_cm ? Number(form.height_cm) : undefined,
        body_type: form.body_type || undefined,
        ethnicity: form.ethnicity || undefined,
        languages: form.languages,
        interests: form.interests,
        smoking: form.smoking || undefined,
        drinking: form.drinking || undefined,
        diet: form.diet || undefined,
        sti_status: form.sti_status || undefined,
        sti_tested_on: form.sti_tested_on || undefined,
        cup_size: form.cup_size || undefined,
        penis_length_cm: form.penis_length_cm ? Number(form.penis_length_cm) : undefined,
        penis_girth_cm: form.penis_girth_cm ? Number(form.penis_girth_cm) : undefined,
      };
      await api.patch("/me", payload);
      await refresh();
      toast.success(t("profile.saved"));
    } catch (e) {
      toast.error(e.response?.data?.detail || t("profile.save_failed"));
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
      toast.success(t("profile.photo_analyzed", { nsfw: (data.nsfw_score * 100).toFixed(0), face: data.has_face ? "✓" : "✗" }));
      await refresh();
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (pid) => { await api.delete(`/me/photos/${pid}`); await refresh(); };
  const makePrimary = async (pid) => { await api.post(`/me/photos/${pid}/primary`); await refresh(); };
  const reorderPhotos = async (order) => {
    try {
      await api.post("/me/photos/reorder", { order });
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Reorder failed");
    }
  };

  const uploadVideo = async (file) => {
    if (file.size > 30 * 1024 * 1024) { toast.error("Max 30MB"); return; }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await api.post("/me/videos", { data_url: dataUrl });
      toast.success(t("profile.video_pending"));
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  };
  const deleteVideo = async (vid) => { await api.delete(`/me/videos/${vid}`); await refresh(); };

  const derivedCategory = penisCategoryFor(form.penis_length_cm);

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
          <header className="pb-2">
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Profil bearbeiten</div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-none">{t("profile.edit")}</h1>
          </header>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)] no-capture">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg">{t("profile.photos")}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]" data-testid="photo-counter">
                {(user.photos || []).length} / 5
              </div>
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:block">
              {t("profile.photo_reorder_hint")}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {(user.photos || []).map((p, idx) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/photo-id", p.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const srcId = e.dataTransfer.getData("text/photo-id");
                    if (!srcId || srcId === p.id) return;
                    const ids = (user.photos || []).map(x => x.id);
                    const without = ids.filter(x => x !== srcId);
                    const targetIdx = without.indexOf(p.id);
                    const newOrder = [...without.slice(0, targetIdx), srcId, ...without.slice(targetIdx)];
                    reorderPhotos(newOrder);
                  }}
                  className="relative aspect-[3/4] overflow-hidden rounded-md border bg-[hsl(var(--muted))] group"
                  data-testid={`photo-tile-${idx}`}
                >
                  <NsfwBlurOverlay active={p.nsfw_score >= 0.75} revealed={true} onReveal={() => {}} className="h-full w-full">
                    <img src={p.data} alt="" className="h-full w-full object-cover" />
                  </NsfwBlurOverlay>
                  {p.is_primary && <div className="absolute left-1 top-1 rounded-full bg-black/55 text-white text-[10px] px-2 py-0.5 inline-flex items-center gap-1"><Star className="h-3 w-3" /> {t("profile.primary")}</div>}
                  {/* desktop drag handle hint */}
                  <div className="pointer-events-none absolute right-1 top-1 hidden sm:inline-grid place-items-center h-6 w-6 rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 text-white text-[11px] px-2 py-1">
                    <span>{p.has_face ? "face" : "no face"} · NSFW {(p.nsfw_score*100).toFixed(0)}%</span>
                    <div className="flex items-center gap-2">
                      {!p.is_primary && (
                        <>
                          {/* mobile-only button */}
                          <button
                            onClick={() => makePrimary(p.id)}
                            className="sm:hidden inline-flex items-center gap-1 underline"
                            data-testid={`photo-set-primary-${idx}`}
                            title={t("profile.set_primary")}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          {/* desktop underline */}
                          <button onClick={() => makePrimary(p.id)} className="hidden sm:inline underline">{t("profile.set_primary")}</button>
                        </>
                      )}
                      <button onClick={() => deletePhoto(p.id)} className="underline" data-testid={`photo-delete-${idx}`}><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {(user.photos || []).length < 5 && (
                <label className="aspect-[3/4] grid place-items-center rounded-md border border-dashed hover:bg-[hsl(var(--secondary))] cursor-pointer text-sm text-[hsl(var(--muted-foreground))]">
                  <div className="flex flex-col items-center gap-1">
                    <ImagePlus className="h-5 w-5" />
                    <span>{uploading ? t("profile.analyzing") : t("profile.add_photo")}</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} data-testid="me-photo-input" />
                </label>
              )}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)] no-capture">
            <div className="font-display text-lg flex items-center gap-2"><Video className="h-4 w-4" /> {t("profile.videos")}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t("profile.videos_hint")}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(user.videos || []).map((v) => (
                <div key={v.id} className="relative aspect-video rounded-md overflow-hidden border bg-black">
                  <video src={v.data} controls className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[11px] px-2 py-1 flex items-center justify-between">
                    <span>{v.moderation_status}</span>
                    <button onClick={() => deleteVideo(v.id)} className="underline"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
              <label className="aspect-video grid place-items-center rounded-md border border-dashed hover:bg-[hsl(var(--secondary))] cursor-pointer text-sm text-[hsl(var(--muted-foreground))]">
                <div className="flex flex-col items-center gap-1">
                  <Play className="h-5 w-5" />
                  <span>{uploading ? t("profile.uploading") : t("profile.add_video")}</span>
                </div>
                <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} data-testid="me-video-input" />
              </label>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">{t("profile.basics")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("profile.display_name")}</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
              <div>
                <Label>{t("profile.age")}</Label>
                <Input type="number" min={18} max={120} value={form.age} disabled readOnly data-testid="age-input-readonly" />
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{t("profile.age_immutable")}</div>
              </div>
              <div>
                <Label>{t("profile.gender_identity")}</Label>
                <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{t(`genders.${g}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("profile.pronouns")}</Label><Input value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} placeholder="sie/ihr / he/him / they/them" /></div>
              <div className="col-span-2">
                <Label>{t("profile.orientation")}</Label>
                <Select value={form.orientation} onValueChange={(v) => setForm({ ...form, orientation: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{ORIENTATIONS.map((o) => <SelectItem key={o} value={o}>{t(`orientations.${o}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>{t("profile.bio")}</Label><Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">{t("profile.body")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("profile.height")}</Label>
                <Input type="number" min="100" max="250" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
              </div>
              <div>
                <Label>{t("profile.body_type")}</Label>
                <Select value={form.body_type} onValueChange={(v) => setForm({ ...form, body_type: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{BODY_TYPES.map((b) => <SelectItem key={b} value={b}>{t(`body_types.${b}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className={showsCupSize(form.gender_identity) ? "" : "hidden"}>
                <Label>{t("profile.cup_size")}</Label>
                <Select value={form.cup_size} onValueChange={(v) => setForm({ ...form, cup_size: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{CUP_SIZES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("profile.ethnicity")}</Label>
                <Select value={form.ethnicity} onValueChange={(v) => setForm({ ...form, ethnicity: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{COMMON_ETHNICITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className={showsPenisSize(form.gender_identity) ? "" : "hidden"}>
                <Label>{t("profile.penis_length")}</Label>
                <Input type="number" min="1" max="40" step="0.1" value={form.penis_length_cm} onChange={(e) => setForm({ ...form, penis_length_cm: e.target.value })} data-testid="penis-length-input" />
                {derivedCategory && <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{t("profile.penis_category")}: <span className="font-medium">{derivedCategory}</span> ({PENIS_RANGES[derivedCategory]})</div>}
              </div>
              <div className={showsPenisSize(form.gender_identity) ? "" : "hidden"}>
                <Label>{t("profile.penis_girth")}</Label>
                <Input type="number" min="1" max="40" step="0.1" value={form.penis_girth_cm} onChange={(e) => setForm({ ...form, penis_girth_cm: e.target.value })} />
              </div>
              <div>
                <Label>{t("profile.smoking")}</Label>
                <Select value={form.smoking} onValueChange={(v) => setForm({ ...form, smoking: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{SMOKING_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`lifestyle.smoking.${v}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("profile.drinking")}</Label>
                <Select value={form.drinking} onValueChange={(v) => setForm({ ...form, drinking: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{DRINKING_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`lifestyle.drinking.${v}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("profile.diet")}</Label>
                <Select value={form.diet} onValueChange={(v) => setForm({ ...form, diet: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{DIET_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`lifestyle.diet.${v}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("profile.sti_status")}</Label>
                <Select value={form.sti_status} onValueChange={(v) => setForm({ ...form, sti_status: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>{STI_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`lifestyle.sti.${v}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("profile.sti_tested_on")}</Label>
                <Input type="date" value={form.sti_tested_on} onChange={(e) => setForm({ ...form, sti_tested_on: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("profile.languages")}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {COMMON_LANGUAGES.map((l) => (
                  <Chip key={l} on={form.languages.includes(l)} onClick={() => toggleArr("languages", l)}>{l}</Chip>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">{t("profile.looking_for")}</div>
            <div>
              <Label className="text-sm">{t("filters.relationship_types")}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {RELATIONSHIP_TYPES.map((r) => (
                  <Chip key={r} on={form.relationship_types.includes(r)} onClick={() => toggleArr("relationship_types", r)}>{t(`relationships.${r}`)}</Chip>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">{t("filters.seeking_roles")}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {SEEKING_ROLES.map((r) => (
                  <Chip key={r} on={form.seeking_roles.includes(r)} onClick={() => toggleArr("seeking_roles", r)}>{t(`roles.${r}`)}</Chip>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">{t("profile.kinks")}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {COMMON_KINKS.map((k) => (
                  <Chip key={k} on={form.kinks.includes(k)} onClick={() => toggleArr("kinks", k)}>{k}</Chip>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)]">
            <div className="font-display text-lg">{t("profile.preferences")}</div>
            <div>
              <Label className="text-sm">{t("filters.seeking_genders")}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {GENDERS.map((g) => (
                  <Chip key={g} on={(form.preferences.seeking_genders || []).includes(g)}
                    onClick={() => toggleArr("seeking_genders", g, "preferences")}>{t(`genders.${g}`)}</Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("onboarding.age_range_label", { min: form.preferences.age_min, max: form.preferences.age_max })}</Label>
              <Slider min={18} max={99} value={[form.preferences.age_min, form.preferences.age_max]}
                onValueChange={([a,b]) => setForm({ ...form, preferences: { ...form.preferences, age_min: a, age_max: b } })}/>
            </div>
            <div>
              <Label>{t("onboarding.distance_radius", { km: form.preferences.radius_km || 50 })}</Label>
              <Slider min={1} max={500} value={[form.preferences.radius_km || 50]}
                onValueChange={([v]) => setForm({ ...form, preferences: { ...form.preferences, radius_km: v } })}/>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} data-testid="save-profile-button">{saving ? t("profile.saving") : t("profile.save")}</Button>
          </div>
        </main>
      </div>
    </div>
  );
}
