import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

const BODY_TYPES = ["slim", "athletic", "average", "curvy", "muscular", "plus_size", "prefer_not_say"];
const BODY_LABELS = {
  slim: "Schlank", athletic: "Sportlich", average: "Durchschnitt", curvy: "Kurvig",
  muscular: "Muskulös", plus_size: "Plus-Size", prefer_not_say: "Keine Angabe",
};
const SMOKING = [
  { k: "never", l: "Nie" }, { k: "sometimes", l: "Gelegentlich" },
  { k: "often", l: "Oft" }, { k: "prefer_not_say", l: "Keine Angabe" },
];
const DRINKING = SMOKING;
const DIET = [
  { k: "omnivore", l: "Omnivor" }, { k: "vegetarian", l: "Vegetarisch" },
  { k: "vegan", l: "Vegan" }, { k: "pescetarian", l: "Pescetarisch" },
  { k: "kosher", l: "Koscher" }, { k: "halal", l: "Halal" }, { k: "other", l: "Andere" },
];
const STI = [
  { k: "negative", l: "Negativ" }, { k: "positive_undetectable", l: "Positiv (n.n.)" },
  { k: "positive", l: "Positiv" }, { k: "on_prep", l: "PrEP" }, { k: "prefer_not_say", l: "Keine Angabe" },
];
const CUP_SIZES = ["A", "B", "C", "D", "DD", "E", "F", "G", "H", "I"];
const COMMON_KINKS = [
  "BDSM", "Rope / Bondage", "Leather", "Latex", "Rubber",
  "Feet", "Socks", "Underwear", "Jockstrap",
  "Uniform", "Sportswear", "Lycra",
  "Role-play", "Daddy", "Boy", "Pup play",
  "Voyeur", "Exhibition", "Group", "Threesome",
  "Dom", "Sub", "Switch", "Edging",
  "Oral", "Kissing",
];

/** Based on B's gender_identity, decide which body metrics are relevant.
 * Mirrors the web `showsCupSize` / `showsPenisSize`. Defaults to showing
 * both when the gender is empty, so users see all options while filling
 * the form for the first time. */
function showsCupSize(gender) {
  if (!gender) return true;
  return ["woman", "trans_woman", "nonbinary", "genderqueer", "agender", "other"].includes(gender);
}
function showsPenisSize(gender) {
  if (!gender) return true;
  return ["man", "trans_man", "nonbinary", "genderqueer", "agender", "other"].includes(gender);
}

const GENDER_CHOICES = [
  { k: "woman", l: "Frau" }, { k: "man", l: "Mann" },
  { k: "nonbinary", l: "Non-binär" }, { k: "trans_woman", l: "Trans Frau" },
  { k: "trans_man", l: "Trans Mann" }, { k: "genderqueer", l: "Genderqueer" },
  { k: "agender", l: "Agender" }, { k: "other", l: "Andere" },
];

export default function PersonaBScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [b, setB] = useState({
    display_name: "", age: "", pronouns: "", bio: "",
    gender_identity: "",
    height_cm: "", body_type: "", ethnicity: "",
    smoking: "", drinking: "", diet: "", sti_status: "",
    cup_size: "", penis_length_cm: "", penis_girth_cm: "",
    languages: [], interests: [], kinks: [],
    photos: [],
  });
  const [langDraft, setLangDraft] = useState("");
  const [interestDraft, setInterestDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      const pb = data.persona_b || {};
      setB({
        display_name: pb.display_name || "",
        age: pb.age ? String(pb.age) : "",
        pronouns: pb.pronouns || "",
        bio: pb.bio || "",
        gender_identity: pb.gender_identity || "",
        height_cm: pb.height_cm ? String(pb.height_cm) : "",
        body_type: pb.body_type || "",
        ethnicity: pb.ethnicity || "",
        smoking: pb.smoking || "",
        drinking: pb.drinking || "",
        diet: pb.diet || "",
        sti_status: pb.sti_status || "",
        cup_size: pb.cup_size || "",
        penis_length_cm: pb.penis_length_cm ? String(pb.penis_length_cm) : "",
        penis_girth_cm: pb.penis_girth_cm ? String(pb.penis_girth_cm) : "",
        languages: Array.isArray(pb.languages) ? pb.languages : [],
        interests: Array.isArray(pb.interests) ? pb.interests : [],
        kinks: Array.isArray(pb.kinks) ? pb.kinks : [],
        photos: Array.isArray(pb.photos) ? pb.photos : [],
      });
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (user && user.account_type !== "duo") {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted, textAlign: "center", paddingHorizontal: 30 }}>
          Dieser Bereich ist nur für Duo-Accounts verfügbar.
        </Text>
      </View>
    );
  }

  const toggleArr = (key, v) => setB((s) => ({
    ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v],
  }));
  const addTag = (key, raw, reset) => {
    const v = (raw || "").trim();
    if (!v) return;
    setB((s) => ({ ...s, [key]: Array.from(new Set([...s[key], v])) }));
    reset();
  };
  const removeTag = (key, v) => setB((s) => ({ ...s, [key]: s[key].filter((x) => x !== v) }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        display_name: b.display_name || undefined,
        age: b.age ? parseInt(b.age, 10) : undefined,
        pronouns: b.pronouns || undefined,
        bio: b.bio || undefined,
        gender_identity: b.gender_identity || undefined,
        height_cm: b.height_cm ? parseInt(b.height_cm, 10) : undefined,
        body_type: b.body_type || undefined,
        ethnicity: b.ethnicity || undefined,
        smoking: b.smoking || undefined,
        drinking: b.drinking || undefined,
        diet: b.diet || undefined,
        sti_status: b.sti_status || undefined,
        // Only send body metrics that actually belong to this gender; the
        // backend would silently ignore stale values but we prefer to be
        // explicit so the payload stays clean for future validation.
        cup_size: showsCupSize(b.gender_identity) ? (b.cup_size || undefined) : undefined,
        penis_length_cm: showsPenisSize(b.gender_identity) && b.penis_length_cm
          ? parseFloat(b.penis_length_cm) : undefined,
        penis_girth_cm: showsPenisSize(b.gender_identity) && b.penis_girth_cm
          ? parseFloat(b.penis_girth_cm) : undefined,
        languages: b.languages,
        interests: b.interests,
        kinks: b.kinks,
        photos: b.photos,
      };
      await api.patch("/me/persona-b", payload);
      await refresh();
      Alert.alert("Gespeichert", "Person-B-Profil aktualisiert.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Fehler", e?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally { setSaving(false); }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Berechtigung", "Galerie-Zugriff fehlt."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.8, base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const a = res.assets[0];
    const mime = a.mimeType || "image/jpeg";
    const data = `data:${mime};base64,${a.base64}`;
    setB((s) => {
      const next = [...(s.photos || []), { id: `tmp-${Date.now()}`, data, is_primary: (s.photos || []).length === 0 }];
      return { ...s, photos: next.slice(0, 5) };
    });
  };
  const setPrimary = (id) => setB((s) => ({
    ...s, photos: (s.photos || []).map((p) => ({ ...p, is_primary: p.id === id })),
  }));
  const removePhoto = (id) => setB((s) => ({
    ...s, photos: (s.photos || []).filter((p) => p.id !== id),
  }));

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>Person B</Text>
      <Text style={styles.sub}>Pflege die Angaben der zweiten Person deines Paar-Accounts.</Text>

      <Section title="Fotos" sub={`${b.photos.length} / 5`}>
        <View style={styles.photoGrid}>
          {b.photos.map((p) => (
            <View key={p.id} style={styles.photoTile}>
              <View style={[styles.photoThumb, p.is_primary && styles.photoPrimary]}>
                {p.data ? (
                  <Image source={{ uri: p.data }} style={{ width: "100%", height: "100%", borderRadius: radii.md }} />
                ) : null}
                {p.is_primary ? <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>PRIMÄR</Text></View> : null}
              </View>
              <View style={styles.photoActions}>
                {!p.is_primary && <TouchableOpacity onPress={() => setPrimary(p.id)} testID={`persona-b-primary-${p.id}`}><Text style={styles.photoLink}>Primär</Text></TouchableOpacity>}
                <TouchableOpacity onPress={() => removePhoto(p.id)} testID={`persona-b-remove-${p.id}`}><Text style={[styles.photoLink, { color: colors.danger }]}>Entfernen</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {b.photos.length < 5 && (
            <TouchableOpacity style={styles.addTile} onPress={pickPhoto} testID="persona-b-add-photo">
              <Text style={styles.addTileText}>+ Foto</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.helpText}>
          Änderungen an Fotos werden erst nach „Speichern" übernommen.
        </Text>
      </Section>

      <Section title="Basisangaben">
        <Label>Anzeigename</Label>
        <TextInput style={styles.input} value={b.display_name} onChangeText={(v) => setB((s) => ({ ...s, display_name: v }))} placeholderTextColor={colors.textDim} />
        <Label>Alter</Label>
        <TextInput style={styles.input} value={b.age} onChangeText={(v) => setB((s) => ({ ...s, age: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" />
        <Label>Pronomen</Label>
        <TextInput style={styles.input} value={b.pronouns} onChangeText={(v) => setB((s) => ({ ...s, pronouns: v }))} placeholder="sie/ihr, er/ihm, they/them…" placeholderTextColor={colors.textDim} />
        <Label>Geschlechtsidentität</Label>
        <View style={styles.chipRow}>
          {GENDER_CHOICES.map((g) => {
            const active = b.gender_identity === g.k;
            return (
              <TouchableOpacity key={g.k} style={[styles.chip, active && styles.chipActive]} onPress={() => setB((s) => ({ ...s, gender_identity: active ? "" : g.k }))}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Label>Bio</Label>
        <TextInput style={[styles.input, { height: 90 }]} value={b.bio} onChangeText={(v) => setB((s) => ({ ...s, bio: v }))} multiline placeholder="Über Person B…" placeholderTextColor={colors.textDim} />
      </Section>

      <Section title="Körper & Life-Style">
        <Label>Größe (cm)</Label>
        <TextInput style={styles.input} value={b.height_cm} onChangeText={(v) => setB((s) => ({ ...s, height_cm: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" />
        <Label>Statur</Label>
        <View style={styles.chipRow}>
          {BODY_TYPES.map((bt) => {
            const active = b.body_type === bt;
            return (
              <TouchableOpacity key={bt} style={[styles.chip, active && styles.chipActive]} onPress={() => setB((s) => ({ ...s, body_type: active ? "" : bt }))}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{BODY_LABELS[bt]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Label>Ethnizität (freiwillig)</Label>
        <TextInput style={styles.input} value={b.ethnicity} onChangeText={(v) => setB((s) => ({ ...s, ethnicity: v }))} placeholderTextColor={colors.textDim} />

        {showsCupSize(b.gender_identity) && (
          <View testID="persona-b-cup-field">
            <Label>Körbchengröße</Label>
            <View style={styles.chipRow}>
              {CUP_SIZES.map((c) => {
                const active = b.cup_size === c;
                return (
                  <TouchableOpacity key={c} style={[styles.chip, active && styles.chipActive]} onPress={() => setB((s) => ({ ...s, cup_size: active ? "" : c }))}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {showsPenisSize(b.gender_identity) && (
          <View testID="persona-b-penis-field">
            <Label>Penislänge (cm)</Label>
            <TextInput
              style={styles.input}
              value={b.penis_length_cm}
              onChangeText={(v) => setB((s) => ({ ...s, penis_length_cm: v.replace(/[^0-9.,]/g, "").replace(",", ".") }))}
              keyboardType="decimal-pad"
            />
            <Label>Umfang (cm)</Label>
            <TextInput
              style={styles.input}
              value={b.penis_girth_cm}
              onChangeText={(v) => setB((s) => ({ ...s, penis_girth_cm: v.replace(/[^0-9.,]/g, "").replace(",", ".") }))}
              keyboardType="decimal-pad"
            />
          </View>
        )}

        <Label>Rauchen</Label>
        <ChipRow values={SMOKING} active={b.smoking} onToggle={(k) => setB((s) => ({ ...s, smoking: s.smoking === k ? "" : k }))} />
        <Label>Alkohol</Label>
        <ChipRow values={DRINKING} active={b.drinking} onToggle={(k) => setB((s) => ({ ...s, drinking: s.drinking === k ? "" : k }))} />
        <Label>Ernährung</Label>
        <ChipRow values={DIET} active={b.diet} onToggle={(k) => setB((s) => ({ ...s, diet: s.diet === k ? "" : k }))} />
        <Label>STI-Status (freiwillig)</Label>
        <ChipRow values={STI} active={b.sti_status} onToggle={(k) => setB((s) => ({ ...s, sti_status: s.sti_status === k ? "" : k }))} />
      </Section>

      <Section title="Kinks">
        <View style={styles.chipRow}>
          {COMMON_KINKS.map((k) => {
            const active = b.kinks.includes(k);
            return (
              <TouchableOpacity key={k} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleArr("kinks", k)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{k}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <TagField
        title="Sprachen"
        values={b.languages}
        draft={langDraft}
        setDraft={setLangDraft}
        onAdd={() => addTag("languages", langDraft, () => setLangDraft(""))}
        onRemove={(v) => removeTag("languages", v)}
        placeholder="z. B. Deutsch"
      />
      <TagField
        title="Interessen"
        values={b.interests}
        draft={interestDraft}
        setDraft={setInterestDraft}
        onAdd={() => addTag("interests", interestDraft, () => setInterestDraft(""))}
        onRemove={(v) => removeTag("interests", v)}
        placeholder="Kunst, Wandern, Kochen…"
      />

      <TouchableOpacity style={styles.btn} onPress={save} disabled={saving} testID="persona-b-save">
        <Text style={styles.btnText}>{saving ? "Speichert…" : "Person B speichern"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, sub, children }) {
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}
function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}
function ChipRow({ values, active, onToggle }) {
  return (
    <View style={styles.chipRow}>
      {values.map((v) => {
        const isActive = active === v.k;
        return (
          <TouchableOpacity key={v.k} style={[styles.chip, isActive && styles.chipActive]} onPress={() => onToggle(v.k)}>
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{v.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
function TagField({ title, values, draft, setDraft, onAdd, onRemove, placeholder }) {
  return (
    <Section title={title}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={draft} onChangeText={setDraft} placeholder={placeholder} placeholderTextColor={colors.textDim} onSubmitEditing={onAdd} />
        <TouchableOpacity style={styles.smallBtn} onPress={onAdd}><Text style={styles.btnText}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.chipRow}>
        {values.map((v) => (
          <TouchableOpacity key={v} style={[styles.chip, styles.chipActive]} onPress={() => onRemove(v)}>
            <Text style={[styles.chipText, styles.chipTextActive]}>{v}  ×</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 4, marginBottom: spacing(3) },
  section: { marginTop: spacing(5), padding: spacing(4), backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sectionSub: { color: colors.textMuted, fontSize: 11 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 10, marginBottom: 4 },
  helpText: { color: colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 15 },
  input: { borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 10, borderRadius: radii.md, fontSize: 15, backgroundColor: colors.bg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.bg },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoTile: { width: "30%", alignItems: "center" },
  photoThumb: { width: "100%", aspectRatio: 3 / 4, borderRadius: radii.md, backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
  photoPrimary: { borderWidth: 2, borderColor: colors.accent },
  primaryBadge: { position: "absolute", top: 4, left: 4, backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 2 },
  primaryBadgeText: { color: colors.bg, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  photoActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  photoLink: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  addTile: { width: "30%", aspectRatio: 3 / 4, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  addTileText: { color: colors.accent, fontWeight: "700" },
  btn: { marginTop: spacing(5), backgroundColor: colors.accent, borderRadius: radii.pill, paddingVertical: 14, alignItems: "center" },
  btnText: { color: colors.bg, fontWeight: "700", fontSize: 14 },
  smallBtn: { backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
});
