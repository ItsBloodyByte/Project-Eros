import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Slider } from "../components/ui/slider";
import { GENDERS, ORIENTATIONS, RELATIONSHIP_TYPES, SEEKING_ROLES } from "../lib/constants";
import { toast } from "sonner";
import { ImagePlus, CheckCircle2 } from "lucide-react";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { useTranslation } from "react-i18next";

export default function OnboardingPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    gender_identity: "",
    pronouns: "",
    orientation: "",
    bio: "",
    location: null,
    relationship_types: [],
    seeking_roles: [],
    preferences: {
      age_min: 21, age_max: 40, seeking_genders: [], radius_km: 50,
      only_with_photos: true, only_face_photo: false, only_verified: false,
      hide_seen: false, online_only: false,
      relationship_types: [], seeking_roles: [], kinks: [],
    },
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        gender_identity: user.gender_identity || "",
        pronouns: user.pronouns || "",
        orientation: user.orientation || "",
        bio: user.bio || "",
        relationship_types: user.relationship_types || [],
        seeking_roles: user.seeking_roles || [],
        preferences: { ...(f.preferences), ...(user.preferences || {}) },
      }));
      setPhotos(user.photos || []);
    }
  }, [user]);

  const total = 4;
  const pct = (step / total) * 100;

  const toggleArr = (key, value, bucket = null) => {
    setForm((f) => {
      const target = bucket ? f[bucket] : f;
      const curr = target[key] || [];
      const next = curr.includes(value) ? curr.filter((x) => x !== value) : [...curr, value];
      if (bucket) return { ...f, [bucket]: { ...f[bucket], [key]: next } };
      return { ...f, [key]: next };
    });
  };

  const detectLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => resolve(null),
        { timeout: 7000 }
      );
    });

  const saveBasics = async () => {
    const loc = form.location || (await detectLocation()) || [13.405, 52.52];
    const patch = {
      gender_identity: form.gender_identity || undefined,
      pronouns: form.pronouns || undefined,
      orientation: form.orientation || undefined,
      bio: form.bio || undefined,
      relationship_types: form.relationship_types,
      seeking_roles: form.seeking_roles,
      location: { type: "Point", coordinates: loc },
    };
    await api.patch("/me", patch);
    setStep(2);
  };

  const savePreferences = async () => {
    await api.patch("/me", {
      preferences: {
        ...form.preferences,
        relationship_types: form.relationship_types,
        seeking_roles: form.seeking_roles,
      },
    });
    setStep(3);
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data } = await api.post("/me/photos", { data_url: dataUrl, is_primary: photos.length === 0 });
      setPhotos((p) => [...p, data]);
      toast.success(t("profile.photo_analyzed", { nsfw: (data.nsfw_score * 100).toFixed(0), face: data.has_face ? "ja" : "nein" }));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    await refresh();
    nav("/");
  };

  const Chip = ({ on, onClick, children, testid }) => (
    <button type="button" onClick={onClick} data-testid={testid}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>
      {children}
    </button>
  );

  return (
    <div className="min-h-screen app-shell-bg-light dark:app-shell-bg py-10 px-4">
      <div className="mx-auto max-w-xl">
        <div className="text-center mb-6">
          <div className="font-display text-4xl tracking-tight">Eros</div>
          <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mt-2">Einrichtung</div>
        </div>
        <div className="mb-4">
          <Progress value={pct} />
          <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{t("onboarding.step", { current: step, total })}</div>
        </div>
        <div className="p-6 sm:p-8 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 shadow-[var(--shadow-md)]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="font-display text-2xl tracking-tight">{t("onboarding.identity")}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("profile.gender_identity")}</Label>
                  <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
                    <SelectTrigger data-testid="onboarding-gender-select"><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => <SelectItem key={g} value={g}>{t(`genders.${g}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("profile.pronouns")}</Label>
                  <Input data-testid="onboarding-pronouns-input" value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} placeholder="they/them" />
                </div>
              </div>
              <div>
                <Label>{t("profile.orientation")}</Label>
                <Select value={form.orientation} onValueChange={(v) => setForm({ ...form, orientation: v })}>
                  <SelectTrigger data-testid="onboarding-orientation-select"><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                  <SelectContent>
                    {ORIENTATIONS.map((o) => <SelectItem key={o} value={o}>{t(`orientations.${o}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("profile.bio")}</Label>
                <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="onboarding-bio-textarea" />
              </div>
              <div>
                <Label>{t("filters.relationship_types")}</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {RELATIONSHIP_TYPES.map((r) => (
                    <Chip key={r} on={form.relationship_types.includes(r)} onClick={() => toggleArr("relationship_types", r)}>
                      {t(`relationships.${r}`)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("filters.seeking_roles")}</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SEEKING_ROLES.map((r) => (
                    <Chip key={r} on={form.seeking_roles.includes(r)} onClick={() => toggleArr("seeking_roles", r)}>
                      {t(`roles.${r}`)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveBasics} data-testid="onboarding-step1-next">{t("onboarding.continue")}</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="font-display text-2xl tracking-tight">{t("onboarding.preferences")}</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">{t("onboarding.mutual_intro")}</div>
              <div>
                <Label>{t("filters.seeking_genders")}</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {GENDERS.map((g) => (
                    <Chip key={g} on={form.preferences.seeking_genders.includes(g)}
                      onClick={() => toggleArr("seeking_genders", g, "preferences")} testid={`onboarding-seek-${g}`}>
                      {t(`genders.${g}`)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("onboarding.age_range_label", { min: form.preferences.age_min, max: form.preferences.age_max })}</Label>
                <Slider min={18} max={99} step={1}
                  value={[form.preferences.age_min, form.preferences.age_max]}
                  onValueChange={([a, b]) => setForm({ ...form, preferences: { ...form.preferences, age_min: a, age_max: b } })}
                  data-testid="onboarding-age-range" />
              </div>
              <div>
                <Label>{t("onboarding.distance_radius", { km: form.preferences.radius_km })}</Label>
                <Slider min={1} max={500} step={1}
                  value={[form.preferences.radius_km]}
                  onValueChange={([v]) => setForm({ ...form, preferences: { ...form.preferences, radius_km: v } })} />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>{t("onboarding.back")}</Button>
                <Button onClick={savePreferences} data-testid="onboarding-step2-next">{t("onboarding.continue")}</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="font-display text-2xl tracking-tight">{t("onboarding.photos")}</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">{t("onboarding.photo_desc")}</div>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((p) => {
                  const isNsfw = p.nsfw_score >= 0.75;
                  return (
                    <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-md border bg-[hsl(var(--muted))]">
                      <NsfwBlurOverlay active={isNsfw} revealed={true} onReveal={() => {}} className="h-full w-full">
                        <img src={p.data} alt="" className="h-full w-full object-cover" />
                      </NsfwBlurOverlay>
                      <div className="absolute inset-x-0 bottom-0 bg-black/45 text-white text-[11px] px-2 py-1 flex items-center justify-between">
                        <span>{p.has_face ? "face" : "no face"}</span>
                        <span>NSFW {(p.nsfw_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
                <label className="aspect-[3/4] grid place-items-center rounded-md border border-dashed hover:bg-[hsl(var(--secondary))] cursor-pointer text-sm text-[hsl(var(--muted-foreground))]" data-testid="onboarding-photo-upload">
                  <div className="flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" />
                    <span>{uploading ? t("profile.analyzing") : t("profile.add_photo")}</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} data-testid="onboarding-photo-input" />
                </label>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>{t("onboarding.back")}</Button>
                <Button onClick={() => setStep(4)} disabled={photos.length === 0} data-testid="onboarding-step3-next">{t("onboarding.continue")}</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="font-display text-2xl tracking-tight">{t("onboarding.ready_title")}</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">{t("onboarding.ready_desc")}</div>
              <div className="rounded-md border p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="font-medium">{t("onboarding.ready_title")}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{t("onboarding.mutual_intro")}</div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={finish} data-testid="onboarding-finish-button">{t("onboarding.enter")}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
