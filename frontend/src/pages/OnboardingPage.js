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

export default function OnboardingPage() {
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    gender_identity: "",
    pronouns: "",
    orientation: "",
    bio: "",
    location: null, // [lng, lat]
    relationship_types: [],
    seeking_roles: [],
    preferences: {
      age_min: 21,
      age_max: 40,
      seeking_genders: [],
      radius_km: 50,
      only_with_photos: true,
      only_face_photo: false,
      only_verified: false,
      hide_seen: true,
      online_only: false,
      relationship_types: [],
      seeking_roles: [],
      kinks: [],
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
      toast.success(`Photo analyzed (NSFW ${(data.nsfw_score * 100).toFixed(0)}%, face: ${data.has_face ? "yes" : "no"})`);
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

  return (
    <div className="min-h-screen app-shell-bg py-10 px-4">
      <div className="mx-auto max-w-xl">
        <div className="mb-4">
          <Progress value={pct} />
          <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Step {step} of {total}</div>
        </div>
        <div className="p-5 rounded-[var(--radius-lg)] border bg-card shadow-[var(--shadow-md)]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="font-display text-2xl">Identity</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gender identity</Label>
                  <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
                    <SelectTrigger data-testid="onboarding-gender-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pronouns</Label>
                  <Input data-testid="onboarding-pronouns-input" value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} placeholder="they/them" />
                </div>
              </div>
              <div>
                <Label>Orientation</Label>
                <Select value={form.orientation} onValueChange={(v) => setForm({ ...form, orientation: v })}>
                  <SelectTrigger data-testid="onboarding-orientation-select"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {ORIENTATIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bio</Label>
                <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="onboarding-bio-textarea" placeholder="A few lines about you…" />
              </div>
              <div>
                <Label>Relationship types</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {RELATIONSHIP_TYPES.map((r) => {
                    const on = form.relationship_types.includes(r.value);
                    return (
                      <button type="button" key={r.value}
                        onClick={() => toggleArr("relationship_types", r.value)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Seeking roles (optional)</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SEEKING_ROLES.map((r) => {
                    const on = form.seeking_roles.includes(r.value);
                    return (
                      <button type="button" key={r.value}
                        onClick={() => toggleArr("seeking_roles", r.value)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveBasics} data-testid="onboarding-step1-next">Continue</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="font-display text-2xl">Preferences</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Your age and gender filters are mutual — we only show people whose preferences also match yours.
              </div>
              <div>
                <Label>Seeking genders</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {GENDERS.map((g) => {
                    const on = form.preferences.seeking_genders.includes(g.value);
                    return (
                      <button type="button" key={g.value}
                        onClick={() => toggleArr("seeking_genders", g.value, "preferences")}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}
                        data-testid={`onboarding-seek-${g.value}`}>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Age range {form.preferences.age_min} – {form.preferences.age_max}</Label>
                <Slider
                  min={18} max={99} step={1}
                  value={[form.preferences.age_min, form.preferences.age_max]}
                  onValueChange={([a, b]) => setForm({ ...form, preferences: { ...form.preferences, age_min: a, age_max: b } })}
                  data-testid="onboarding-age-range"
                />
              </div>
              <div>
                <Label>Distance radius {form.preferences.radius_km} km</Label>
                <Slider
                  min={1} max={500} step={1}
                  value={[form.preferences.radius_km]}
                  onValueChange={([v]) => setForm({ ...form, preferences: { ...form.preferences, radius_km: v } })}
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={savePreferences} data-testid="onboarding-step2-next">Continue</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="font-display text-2xl">Photos</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Upload at least one photo. Our AI will analyze each photo for safety (face detection + sensitive content). Sensitive photos will be blurred for others until they confirm 18+.
              </div>
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
                  <div className="flex flex-col items-center gap-1">
                    <ImagePlus className="h-5 w-5" />
                    <span>{uploading ? "Analyzing..." : "Add photo"}</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} data-testid="onboarding-photo-input" />
                </label>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={() => setStep(4)} disabled={photos.length === 0} data-testid="onboarding-step3-next">Continue</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="font-display text-2xl">All set</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">You can refine your profile any time in Settings.</div>
              <div className="rounded-md border p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="font-medium">Profile ready</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Start discovering people who match your preferences — mutually.</div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={finish} data-testid="onboarding-finish-button">Enter Eros</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
