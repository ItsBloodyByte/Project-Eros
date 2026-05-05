import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

export default function SettingsScreen() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [privacy, setPrivacy] = useState({
    read_receipts: true, show_online_status: true, show_typing: true,
    hidden_mode: false, screenshot_notifications: true, stealth_mode: false,
    role_badge_visible: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      setPrivacy({ ...privacy, ...(data.privacy || {}) });
    } catch {}
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const isPremium = !!user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();

  const save = async (patch) => {
    setSaving(true);
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    try {
      await api.patch("/me", { privacy: next });
      await refresh();
    } catch (e) {
      // revert optimistic UI
      setPrivacy(privacy);
      Alert.alert("Fehler", e?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>Einstellungen</Text>
      <Text style={styles.sub}>Privatsphäre & Sichtbarkeit</Text>

      <Section title="Sichtbarkeit">
        <Row label="Online-Status anzeigen" description="Andere sehen, wenn du gerade aktiv bist."
             value={privacy.show_online_status} onValueChange={(v) => save({ show_online_status: v })} />
        <Row label="Tipp-Indikator" description="Zeigt anderen, wenn du gerade schreibst."
             value={privacy.show_typing} onValueChange={(v) => save({ show_typing: v })} />
        <Row label="Lesebestätigungen" description="Versand von &#8222;gelesen&#8220;-Markierungen in Chats."
             value={privacy.read_receipts} onValueChange={(v) => save({ read_receipts: v })} />
      </Section>

      <Section title="Privatsphäre">
        <Row label="Profil verstecken" description="Dein Profil erscheint nicht mehr im Discover."
             value={privacy.hidden_mode} onValueChange={(v) => save({ hidden_mode: v })} />
        <Row
          label={`Stealth-Modus ${isPremium ? "" : "(Premium)"}`}
          description="Browse, ohne als Besucher:in zu erscheinen."
          value={privacy.stealth_mode}
          disabled={!isPremium}
          onValueChange={(v) => save({ stealth_mode: v })}
        />
        <Row
          label="Partner-Einladungen zulassen"
          description="Wenn aus: andere können dich nicht als Partner:in für ein gemeinsames Paarprofil anfragen."
          value={privacy.allow_couple_invites !== false}
          onValueChange={(v) => save({ allow_couple_invites: v })}
        />
      </Section>

      {(user?.role && user.role !== "user") && (
        <Section title="Team">
          <Row label="Rollen-Badge auf dem Profil zeigen" description="Wenn aus, sehen andere deine Team-Rolle nicht."
               value={privacy.role_badge_visible} onValueChange={(v) => save({ role_badge_visible: v })} />
        </Section>
      )}

      {saving && <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 10 }}>Speichert…</Text>}
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ label, description, value, onValueChange, disabled }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.rowLabel, disabled && { color: colors.textDim }]}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled}
        thumbColor={value ? colors.accent : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 4 },
  section: { marginTop: spacing(5), padding: spacing(4), backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing(2) },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rowDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
