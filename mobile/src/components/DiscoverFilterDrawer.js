import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet, Switch,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

const GENDERS = ["female", "male", "non_binary", "trans_female", "trans_male", "other"];
const GENDER_LABELS = {
  female: "Weiblich", male: "Männlich", non_binary: "Non-binär",
  trans_female: "Trans Frau", trans_male: "Trans Mann", other: "Andere",
};

export default function DiscoverFilterDrawer({ visible, onClose, onApplied }) {
  const [prefs, setPrefs] = useState({
    age_min: 18, age_max: 99, radius_km: 50,
    seeking_genders: [], only_with_photos: true, only_face_photo: false, only_verified: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/me");
      const p = data.preferences || {};
      setPrefs({
        age_min: p.age_min ?? 18,
        age_max: p.age_max ?? 99,
        radius_km: p.radius_km ?? 50,
        seeking_genders: Array.isArray(p.seeking_genders) ? p.seeking_genders : [],
        only_with_photos: p.only_with_photos ?? true,
        only_face_photo: p.only_face_photo ?? false,
        only_verified: p.only_verified ?? false,
      });
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const toggleGender = (g) => {
    setPrefs((s) => ({
      ...s,
      seeking_genders: s.seeking_genders.includes(g)
        ? s.seeking_genders.filter((x) => x !== g)
        : [...s.seeking_genders, g],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/me", { preferences: prefs });
      onApplied?.();
      onClose?.();
    } catch {}
    finally { setSaving(false); }
  };

  const numInput = (key, min, max) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.kvLabel}>{key === "age_min" ? "Min. Alter" : key === "age_max" ? "Max. Alter" : "Radius (km)"}</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={String(prefs[key])}
        onChangeText={(v) => {
          const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
          if (!Number.isNaN(n) && n >= min && n <= max) setPrefs((s) => ({ ...s, [key]: n }));
          else if (v === "") setPrefs((s) => ({ ...s, [key]: min }));
        }}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Filter</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>×</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
            {loading ? (
              <Text style={{ color: colors.textMuted }}>Lädt…</Text>
            ) : (
              <>
                <View>
                  <Text style={styles.section}>Alter</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {numInput("age_min", 18, 120)}
                    {numInput("age_max", 18, 120)}
                  </View>
                </View>
                <View>
                  <Text style={styles.section}>Entfernung</Text>
                  {numInput("radius_km", 1, 500)}
                </View>
                <View>
                  <Text style={styles.section}>Geschlechter (Suche)</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {GENDERS.map((g) => {
                      const active = prefs.seeking_genders.includes(g);
                      return (
                        <TouchableOpacity key={g} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleGender(g)}>
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{GENDER_LABELS[g]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View>
                  <Text style={styles.section}>Qualität</Text>
                  <ToggleRow label="Nur mit Foto" value={prefs.only_with_photos} onValueChange={(v) => setPrefs((s) => ({ ...s, only_with_photos: v }))} />
                  <ToggleRow label="Nur mit Gesicht auf Foto" value={prefs.only_face_photo} onValueChange={(v) => setPrefs((s) => ({ ...s, only_face_photo: v }))} />
                  <ToggleRow label="Nur verifiziert" value={prefs.only_verified} onValueChange={(v) => setPrefs((s) => ({ ...s, only_verified: v }))} />
                </View>
              </>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={save} disabled={saving || loading}>
              <Text style={styles.btnText}>{saving ? "Speichert…" : "Anwenden"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ToggleRow({ label, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} thumbColor={value ? colors.accent : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, maxHeight: "90%" },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing(4), paddingTop: spacing(3), paddingBottom: spacing(2) },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  close: { color: colors.textMuted, fontSize: 28, paddingHorizontal: 8 },
  section: { color: colors.text, fontWeight: "700", marginBottom: 8 },
  kvLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 10, borderRadius: radii.md, fontSize: 15 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.bg },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  footer: { flexDirection: "row", gap: 8, padding: spacing(4), borderTopWidth: 1, borderTopColor: colors.border },
  btn: { flex: 1, backgroundColor: colors.accent, borderRadius: radii.pill, paddingVertical: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  btnText: { color: colors.bg, fontWeight: "700", fontSize: 14 },
});
