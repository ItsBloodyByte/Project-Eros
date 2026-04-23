import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

const fmt = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" }); }
  catch { return iso; }
};

export default function EventDetailScreen({ route }) {
  const { id } = route.params || {};
  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get(`/events/${id}`);
      setEv(data);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const rsvp = async (status) => {
    try {
      await api.post(`/events/${id}/rsvp`, { status });
      await load();
    } catch {}
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (!ev) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Event nicht gefunden.</Text></View>;

  const myStatus = ev.my_rsvp || (ev.rsvps || []).find((r) => r.is_me)?.status;
  const going = myStatus === "going";
  const interested = myStatus === "interested";

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>{ev.title}</Text>
      <Text style={styles.meta}>{fmt(ev.starts_at)}</Text>
      {ev.city ? <Text style={styles.meta}>{ev.city}{ev.venue ? ` · ${ev.venue}` : ""}</Text> : null}
      {ev.description ? <Text style={styles.body}>{ev.description}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.pill, going && styles.pillActive]} onPress={() => rsvp(going ? "not_going" : "going")}>
          <Text style={[styles.pillText, going && styles.pillTextActive]}>{going ? "Zugesagt" : "Zusagen"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pill, interested && styles.pillActive]} onPress={() => rsvp(interested ? "not_going" : "interested")}>
          <Text style={[styles.pillText, interested && styles.pillTextActive]}>{interested ? "Interessiert" : "Vielleicht"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.section}>Teilnehmer:innen</Text>
      {(ev.rsvps || []).length === 0 ? (
        <Text style={{ color: colors.textMuted }}>Noch keine RSVPs.</Text>
      ) : (
        (ev.rsvps || []).map((r) => (
          <View key={r.user_id} style={styles.rsvpRow}>
            <Text style={{ color: colors.text, flex: 1 }}>{r.display_name || r.user_id}</Text>
            <Text style={{ color: r.status === "going" ? colors.accent : colors.textMuted, fontSize: 11, fontWeight: "700" }}>
              {r.status === "going" ? "ZUSAGE" : r.status === "interested" ? "VIELLEICHT" : r.status.toUpperCase()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 26, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  body: { color: colors.text, marginTop: 12, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: colors.bg },
  section: { color: colors.text, fontWeight: "700", marginTop: spacing(5), marginBottom: spacing(2) },
  rsvpRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
});
