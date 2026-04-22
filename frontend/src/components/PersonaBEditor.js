import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import {
  ImagePlus, Star, Trash2, Save, UserRound,
} from "lucide-react";
import {
  GENDERS, BODY_TYPES, SMOKING_VALUES as SMOKING, DRINKING_VALUES as DRINKING,
  DIET_VALUES as DIET, STI_VALUES as STI, CUP_SIZES, COMMON_KINKS,
} from "../lib/constants";
import { useTranslation } from "react-i18next";

const KINK_OPTIONS = COMMON_KINKS;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * PersonaBEditor — full editor for the second person in a duo account.
 * Persists via PATCH /api/me/persona-b (photos included in the same payload).
 */
export function PersonaBEditor() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pb = user?.persona_b || {};

  useEffect(() => {
    if (!user) return;
    const p = user.persona_b || {};
    setForm({
      display_name: p.display_name || "",
      birth_date: p.birth_date || "",
      gender_identity: p.gender_identity || "",
      pronouns: p.pronouns || "",
      orientation: p.orientation || "",
      bio: p.bio || "",
      photos: p.photos || [],
      height_cm: p.height_cm || "",
      body_type: p.body_type || "",
      ethnicity: p.ethnicity || "",
      smoking: p.smoking || "",
      drinking: p.drinking || "",
      diet: p.diet || "",
      sti_status: p.sti_status || "",
      sti_tested_on: p.sti_tested_on || "",
      cup_size: p.cup_size || "",
      penis_length_cm: p.penis_length_cm || "",
      penis_girth_cm: p.penis_girth_cm || "",
      languages: p.languages || [],
      interests: p.interests || [],
      kinks: p.kinks || [],
    });
  }, [user?.id, user?.persona_b]);

  if (!user || user.account_type !== "duo") {
    return (
      <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6">
        <div className="text-sm text-[hsl(var(--muted-foreground))]">
          Dein Konto ist kein Paar-Account. Person B ist nicht verfügbar.
        </div>
      </div>
    );
  }
  if (!form) return null;

  const patch = async (partial) => {
    try {
      await api.patch("/me/persona-b", partial);
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen");
      throw e;
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      ["height_cm", "penis_length_cm", "penis_girth_cm"].forEach((k) => {
        if (payload[k] === "" || payload[k] === null) delete payload[k];
        else payload[k] = Number(payload[k]);
      });
      if (!payload.birth_date) delete payload.birth_date;
      await patch(payload);
      toast.success("Person B gespeichert");
    } finally { setSaving(false); }
  };

  // Photo handling — persists via PATCH persona-b with new photos array
  const addPhoto = async (file) => {
    if (!file) return;
    if ((form.photos || []).length >= 5) { toast.error("Maximal 5 Fotos für Person B"); return; }
    setUploading(true);
    try {
      const data_url = await readFileAsDataURL(file);
      const next = [
        ...(form.photos || []),
        { data: data_url, is_primary: !(form.photos || []).length },
      ];
      setForm((f) => ({ ...f, photos: next }));
      await patch({ photos: next });
      toast.success("Foto hinzugefügt");
    } catch (e) {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removePhoto = async (idx) => {
    const next = form.photos.filter((_, i) => i !== idx);
    if (next.length > 0 && !next.some((p) => p.is_primary)) next[0].is_primary = true;
    setForm((f) => ({ ...f, photos: next }));
    await patch({ photos: next });
  };
  const setPrimary = async (idx) => {
    const next = form.photos.map((p, i) => ({ ...p, is_primary: i === idx }));
    setForm((f) => ({ ...f, photos: next }));
    await patch({ photos: next });
  };

  const toggleKink = (k) => {
    const has = form.kinks.includes(k);
    setForm({ ...form, kinks: has ? form.kinks.filter((x) => x !== k) : [...form.kinks, k] });
  };

  return (
    <div className="space-y-6" data-testid="persona-b-editor">
      {/* Intro */}
      <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--accent))]/5 ring-1 ring-[hsl(var(--accent))]/30 p-4 flex items-start gap-3">
        <UserRound className="h-5 w-5 text-[hsl(var(--accent))] mt-0.5" />
        <div className="text-sm">
          <div className="font-medium">Person B — Paar-Profil</div>
          <div className="text-[hsl(var(--muted-foreground))] text-xs mt-1">
            Pflege hier alle Angaben der zweiten Person. Beide Identitäten erscheinen nebeneinander in eurem öffentlichen Profil.
          </div>
        </div>
      </div>

      {/* Photos */}
      <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg">Fotos Person B</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{(form.photos || []).length} / 5</div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {(form.photos || []).map((p, idx) => (
            <div key={idx} className="relative group aspect-[3/4] rounded-[var(--radius-md)] overflow-hidden ring-1 ring-[hsl(var(--border))]">
              <img src={p.data} alt="" className="h-full w-full object-cover" />
              {p.is_primary && (
                <span className="absolute top-1.5 left-1.5 text-[10px] font-medium rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] px-1.5 py-0.5">Primary</span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!p.is_primary && (
                  <button onClick={() => setPrimary(idx)} className="text-white/90 hover:text-white" title="Als Primär setzen" data-testid={`pb-photo-primary-${idx}`}>
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => removePhoto(idx)} className="text-red-300 hover:text-red-200" title="Entfernen" data-testid={`pb-photo-delete-${idx}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {(form.photos || []).length < 5 && (
            <label
              className="aspect-[3/4] rounded-[var(--radius-md)] border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--accent))] cursor-pointer grid place-items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]"
              data-testid="pb-photo-add"
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => addPhoto(e.target.files?.[0])}
                disabled={uploading}
              />
              <div className="text-xs font-medium flex flex-col items-center gap-1 p-2 text-center">
                <ImagePlus className="h-6 w-6" />
                {uploading ? "Lade…" : "Foto hinzufügen"}
              </div>
            </label>
          )}
        </div>
      </section>

      {/* Basics */}
      <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4">
        <div className="font-display text-lg">Basisangaben</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} data-testid="pb-name" />
          </div>
          <div>
            <Label className="text-xs">Geburtsdatum</Label>
            <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} data-testid="pb-birthdate" />
          </div>
          <div>
            <Label className="text-xs">Gender</Label>
            <Select value={form.gender_identity} onValueChange={(v) => setForm({ ...form, gender_identity: v })}>
              <SelectTrigger data-testid="pb-gender"><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{t(`genders.${g}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Pronomen</Label>
            <Input value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} placeholder="sie/ihr, er/ihm …" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Bio</Label>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="pb-bio" />
          </div>
        </div>
      </section>

      {/* Body & Lifestyle */}
      <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4">
        <div className="font-display text-lg">Körper & Life-Style</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Größe (cm)</Label>
            <Input type="number" min="100" max="250" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Körpertyp</Label>
            <Select value={form.body_type} onValueChange={(v) => setForm({ ...form, body_type: v })}>
              <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>{BODY_TYPES.map((b) => <SelectItem key={b} value={b}>{t(`body_types.${b}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ethnie</Label>
            <Input value={form.ethnicity} onChange={(e) => setForm({ ...form, ethnicity: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Rauchen</Label>
            <Select value={form.smoking} onValueChange={(v) => setForm({ ...form, smoking: v })}>
              <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>{SMOKING.map((s) => <SelectItem key={s} value={s}>{t(`lifestyle.smoking.${s}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Alkohol</Label>
            <Select value={form.drinking} onValueChange={(v) => setForm({ ...form, drinking: v })}>
              <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>{DRINKING.map((s) => <SelectItem key={s} value={s}>{t(`lifestyle.drinking.${s}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ernährung</Label>
            <Select value={form.diet} onValueChange={(v) => setForm({ ...form, diet: v })}>
              <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>{DIET.map((s) => <SelectItem key={s} value={s}>{t(`lifestyle.diet.${s}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">STI-Status</Label>
            <Select value={form.sti_status} onValueChange={(v) => setForm({ ...form, sti_status: v })}>
              <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>{STI.map((s) => <SelectItem key={s} value={s}>{t(`lifestyle.sti.${s}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Zuletzt getestet</Label>
            <Input type="date" value={form.sti_tested_on} onChange={(e) => setForm({ ...form, sti_tested_on: e.target.value })} />
          </div>
          {form.gender_identity && ["woman", "trans_woman", "nonbinary", "other"].includes(form.gender_identity) && (
            <div>
              <Label className="text-xs">Körbchengröße</Label>
              <Select value={form.cup_size} onValueChange={(v) => setForm({ ...form, cup_size: v })}>
                <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
                <SelectContent>{CUP_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.gender_identity && ["man", "trans_man", "nonbinary", "other"].includes(form.gender_identity) && (
            <>
              <div>
                <Label className="text-xs">Penis-Länge (cm)</Label>
                <Input type="number" min="1" max="30" value={form.penis_length_cm} onChange={(e) => setForm({ ...form, penis_length_cm: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Penis-Umfang (cm)</Label>
                <Input type="number" min="1" max="25" value={form.penis_girth_cm} onChange={(e) => setForm({ ...form, penis_girth_cm: e.target.value })} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Kinks */}
      <section className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3">
        <div className="font-display text-lg">Kinks</div>
        <div className="flex flex-wrap gap-1.5">
          {KINK_OPTIONS.map((k) => {
            const active = form.kinks.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKink(k)}
                data-testid={`pb-kink-${k}`}
                className={[
                  "rounded-full px-3 py-1 text-xs border transition-colors capitalize",
                  active
                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]"
                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]",
                ].join(" ")}
              >
                {k}
              </button>
            );
          })}
        </div>
        {form.kinks.length > 0 && (
          <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Ausgewählt: {form.kinks.length}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-1" data-testid="pb-save">
          <Save className="h-4 w-4" /> {saving ? "Speichere…" : "Person B speichern"}
        </Button>
      </div>
    </div>
  );
}

export default PersonaBEditor;
