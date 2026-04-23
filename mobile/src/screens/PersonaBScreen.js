import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

const BODY_TYPES = ["slim", "athletic", "average", "curvy", "muscular", "plus_size", "prefer_not_say"];

export default function PersonaBScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [b, setB] = useState({
    display_name: "", age: "", pronouns: "", bio: "",
    height_cm: "", body_type: "", photos: [],
  });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      const pb = data.persona_b || {};
      setB({
        display_name: pb.display_name || "",
        age: pb.age ? String(pb.age) : "",
        pronouns: pb.pronouns || "",
        bio: pb.bio || "",
        height_cm: pb.height_cm ? String(pb.height_cm) : "",
        body_type: pb.body_type || "",
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

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        display_name: b.display_name || undefined,
        age: b.age ? parseInt(b.age, 10) : undefined,
        pronouns: b.pronouns || undefined,
        bio: b.bio || undefined,
        height_cm: b.height_cm ? parseInt(b.height_cm, 10) : undefined,
        body_type: b.body_type || undefined,
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
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>{p.is_primary ? "PRIMÄR" : ""}</Text>
              </View>
              <View style={styles.photoActions}>
                {!p.is_primary && <TouchableOpacity onPress={() => setPrimary(p.id)}><Text style={styles.photoLink}>Primär</Text></TouchableOpacity>}
                <TouchableOpacity onPress={() => removePhoto(p.id)}><Text style={[styles.photoLink, { color: colors.danger }]}>Entfernen</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {b.photos.length < 5 && (
            <TouchableOpacity style={styles.addTile} onPress={pickPhoto}>
              <Text style={styles.addTileText}>+ Foto</Text>
            </TouchableOpacity>
          )}
        </View>
      </Section>

      <Section title="Basisangaben">
        <Label>Anzeigename</Label>
        <TextInput style={styles.input} value={b.display_name} onChangeText={(v) => setB((s) => ({ ...s, display_name: v }))} />
        <Label>Alter</Label>
        <TextInput style={styles.input} value={b.age} onChangeText={(v) => setB((s) => ({ ...s, age: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" />
        <Label>Pronomen</Label>
        <TextInput style={styles.input} value={b.pronouns} onChangeText={(v) => setB((s) => ({ ...s, pronouns: v }))} />
        <Label>Bio</Label>
        <TextInput style={[styles.input, { height: 90 }]} value={b.bio} onChangeText={(v) => setB((s) => ({ ...s, bio: v }))} multiline />
      </Section>

      <Section title="Körper">
        <Label>Größe (cm)</Label>
        <TextInput style={styles.input} value={b.height_cm} onChangeText={(v) => setB((s) => ({ ...s, height_cm: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" />
        <Label>Statur</Label>
        <View style={styles.chipRow}>
          {BODY_TYPES.map((bt) => {
            const active = b.body_type === bt;
            return (
              <TouchableOpacity key={bt} style={[styles.chip, active && styles.chipActive]} onPress={() => setB((s) => ({ ...s, body_type: active ? "" : bt }))}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{bt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 4, marginBottom: spacing(3) },
  section: { marginTop: spacing(5), padding: spacing(4), backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sectionSub: { color: colors.textMuted, fontSize: 11 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 10, marginBottom: 4 },
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
  btn: { marginTop: spacing(5), backgroundColor: colors.accent, borderRadius: radii.pill, paddingVertical: 14, alignItems: "center" },
  btnText: { color: colors.bg, fontWeight: "700", fontSize: 14 },
});
