import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";
import {
  GAY_POSITIONS, NSFW_OPTIONS, isGayMaleLike, nsfwToValue, valueToNsfw,
} from "../demographics";

const RELATIONSHIP_TYPES = ["monogamous", "polyamorous", "casual", "friendship", "play", "long_term", "long_distance", "other"];
const RT_LABELS = {
  monogamous: "Monogam", polyamorous: "Polyam", casual: "Zwanglos", friendship: "Freundschaft",
  play: "Play", long_term: "Langfristig", long_distance: "Fernbeziehung", other: "Sonstiges",
};
const BODY_TYPES = ["slim", "athletic", "average", "curvy", "muscular", "plus_size", "prefer_not_say"];
const BODY_LABELS = {
  slim: "Schlank", athletic: "Sportlich", average: "Durchschnittlich", curvy: "Kurvig",
  muscular: "Muskulös", plus_size: "Plus-Size", prefer_not_say: "Keine Angabe",
};

export default function EditProfileScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({
    display_name: "", bio: "", pronouns: "",
    height_cm: "", body_type: "", ethnicity: "",
    languages: [], interests: [], relationship_types: [],
    accept_nsfw: "na", gay_position: "",
  });
  const [languageDraft, setLanguageDraft] = useState("");
  const [interestDraft, setInterestDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      setFields({
        display_name: data.display_name || "",
        bio: data.bio || "",
        pronouns: data.pronouns || "",
        height_cm: data.height_cm ? String(data.height_cm) : "",
        body_type: data.body_type || "",
        ethnicity: data.ethnicity || "",
        languages: Array.isArray(data.languages) ? data.languages : [],
        interests: Array.isArray(data.interests) ? data.interests : [],
        relationship_types: Array.isArray(data.relationship_types) ? data.relationship_types : [],
        accept_nsfw: nsfwToValue(data.accept_nsfw),
        gay_position: data.gay_position || "",
      });
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleChip = (key, v) => setFields((s) => ({
    ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v],
  }));
  const addTag = (key, raw, reset) => {
    const v = raw.trim();
    if (!v) return;
    setFields((s) => ({ ...s, [key]: Array.from(new Set([...s[key], v])) }));
    reset();
  };
  const removeTag = (key, v) => setFields((s) => ({ ...s, [key]: s[key].filter((x) => x !== v) }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        display_name: fields.display_name || undefined,
        bio: fields.bio || undefined,
        pronouns: fields.pronouns || undefined,
        height_cm: fields.height_cm ? parseInt(fields.height_cm, 10) : undefined,
        body_type: fields.body_type || undefined,
        ethnicity: fields.ethnicity || undefined,
        languages: fields.languages,
        interests: fields.interests,
        relationship_types: fields.relationship_types,
        // NSFW preference — always send (null clears the choice)
        accept_nsfw: valueToNsfw(fields.accept_nsfw),
        // Position — only send when the account currently qualifies;
        // backend would null it anyway otherwise.
        gay_position: isGayMaleLike(user)
          ? (fields.gay_position || null)
          : undefined,
      };
      await api.patch("/me", payload);
      await refresh();
      Alert.alert("Gespeichert", "Dein Profil wurde aktualisiert.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Fehler", e?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally { setSaving(false); }
  };

  const pickAndUploadPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Berechtigung", "Mediengalerie ist nicht freigegeben."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.8, base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || "image/jpeg";
    const data_url = `data:${mime};base64,${asset.base64}`;
    try {
      await api.post("/me/photos", { data_url, is_primary: false });
      await refresh();
      Alert.alert("Upload", "Foto hochgeladen.");
    } catch (e) {
      Alert.alert("Upload fehlgeschlagen", e?.response?.data?.detail || "Unbekannter Fehler");
    }
  };

  const setPrimary = async (id) => {
    try { await api.post(`/me/photos/${id}/primary`); await refresh(); } catch {}
  };
  const removePhoto = async (id) => {
    Alert.alert("Foto löschen?", "Das Foto wird unwiderruflich entfernt.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: async () => {
        try { await api.delete(`/me/photos/${id}`); await refresh(); } catch (e) { Alert.alert("Fehler", e?.response?.data?.detail || "Löschen fehlgeschlagen"); }
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const photos = user?.photos || [];

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>Profil bearbeiten</Text>

      <Section title="Fotos" sub={`${photos.length} / 5`}>
        <View style={styles.photoGrid}>
          {photos.map((p) => (
            <View key={p.id} style={styles.photoTile}>
              <View style={[styles.photoThumb, p.is_primary && styles.photoPrimary]}>
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>{p.is_primary ? "PRIMÄR" : ""}</Text>
              </View>
              <View style={styles.photoActions}>
                {!p.is_primary && <TouchableOpacity onPress={() => setPrimary(p.id)}><Text style={styles.photoLink}>Primär</Text></TouchableOpacity>}
                <TouchableOpacity onPress={() => removePhoto(p.id)}><Text style={[styles.photoLink, { color: colors.danger }]}>Löschen</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {photos.length < 5 && (
            <TouchableOpacity style={styles.addTile} onPress={pickAndUploadPhoto}>
              <Text style={styles.addTileText}>+ Foto</Text>
            </TouchableOpacity>
          )}
        </View>
      </Section>

      <Section title="Basisangaben">
        <Label>Anzeigename</Label>
        <TextInput style={styles.input} value={fields.display_name} onChangeText={(v) => setFields((s) => ({ ...s, display_name: v }))} placeholderTextColor={colors.textDim} />
        <Label>Pronomen</Label>
        <TextInput style={styles.input} value={fields.pronouns} onChangeText={(v) => setFields((s) => ({ ...s, pronouns: v }))} placeholder="sie/ihr, er/ihm, they/them…" placeholderTextColor={colors.textDim} />
        <Label>Bio</Label>
        <TextInput style={[styles.input, { height: 100 }]} value={fields.bio} onChangeText={(v) => setFields((s) => ({ ...s, bio: v }))} multiline placeholder="Erzähl etwas über dich…" placeholderTextColor={colors.textDim} />
      </Section>

      <Section title="Körper & Lifestyle">
        <Label>Größe (cm)</Label>
        <TextInput style={styles.input} value={fields.height_cm} onChangeText={(v) => setFields((s) => ({ ...s, height_cm: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" />
        <Label>Statur</Label>
        <View style={styles.chipRow}>
          {BODY_TYPES.map((b) => {
            const active = fields.body_type === b;
            return (
              <TouchableOpacity key={b} style={[styles.chip, active && styles.chipActive]} onPress={() => setFields((s) => ({ ...s, body_type: active ? "" : b }))}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{BODY_LABELS[b]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Label>Ethnizität (freiwillig)</Label>
        <TextInput style={styles.input} value={fields.ethnicity} onChangeText={(v) => setFields((s) => ({ ...s, ethnicity: v }))} placeholderTextColor={colors.textDim} />
      </Section>

      <Section title="Beziehungsform">
        <View style={styles.chipRow}>
          {RELATIONSHIP_TYPES.map((r) => {
            const active = fields.relationship_types.includes(r);
            return (
              <TouchableOpacity key={r} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleChip("relationship_types", r)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{RT_LABELS[r]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <Section title="Präferenzen & Sichtbarkeit">
        <Label>NSFW-Inhalte</Label>
        <View style={styles.chipRow}>
          {NSFW_OPTIONS.map((o) => {
            const active = fields.accept_nsfw === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFields((s) => ({ ...s, accept_nsfw: o.value }))}
                testID={`nsfw-option-${o.value}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.helpText}>
          Signalisiert anderen, ob du explizite Nachrichten/Inhalte empfangen möchtest.
        </Text>

        {isGayMaleLike(user) && (
          <View testID="gay-position-field">
            <Label>Position</Label>
            <View style={styles.chipRow}>
              {GAY_POSITIONS.map((p) => {
                const active = fields.gay_position === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFields((s) => ({ ...s, gay_position: active ? "" : p.value }))}
                    testID={`gay-position-${p.value}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helpText}>
              Sichtbar für andere männlich-gleichgeschlechtlich suchende Nutzer.
            </Text>
          </View>
        )}
      </Section>

      <TagField title="Sprachen" values={fields.languages} draft={languageDraft} setDraft={setLanguageDraft}
        onAdd={() => addTag("languages", languageDraft, () => setLanguageDraft(""))}
        onRemove={(v) => removeTag("languages", v)} placeholder="z. B. Deutsch" />

      <TagField title="Interessen" values={fields.interests} draft={interestDraft} setDraft={setInterestDraft}
        onAdd={() => addTag("interests", interestDraft, () => setInterestDraft(""))}
        onRemove={(v) => removeTag("interests", v)} placeholder="Kunst, Wandern, Kochen…" />

      <TouchableOpacity style={[styles.btn, { marginTop: spacing(4) }]} onPress={save} disabled={saving}>
        <Text style={styles.btnText}>{saving ? "Speichert…" : "Speichern"}</Text>
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
  photoThumb: { width: "100%", aspectRatio: 3 / 4, borderRadius: radii.md, backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" },
  photoPrimary: { borderWidth: 2, borderColor: colors.accent },
  photoActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  photoLink: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  addTile: { width: "30%", aspectRatio: 3 / 4, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  addTileText: { color: colors.accent, fontWeight: "700" },
  btn: { backgroundColor: colors.accent, borderRadius: radii.pill, paddingVertical: 14, alignItems: "center" },
  btnText: { color: colors.bg, fontWeight: "700", fontSize: 14 },
  smallBtn: { backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
});
