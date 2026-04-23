import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

const fmt = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
};

export default function EventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/events", { params: { upcoming_only: true } });
      setEvents(data.events || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rsvp = async (id, status) => {
    try {
      await api.post(`/events/${id}/rsvp`, { status });
      await load();
    } catch {}
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg, flex: 1 }}
      contentContainerStyle={{ padding: spacing(3) }}
      data={events}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={<Text style={styles.empty}>Keine anstehenden Events.</Text>}
      renderItem={({ item }) => {
        const going = item.my_rsvp === "going";
        const interested = item.my_rsvp === "interested";
        return (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("EventDetail", { id: item.id, title: item.title })}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.meta}>{fmt(item.starts_at)}{item.city ? ` · ${item.city}` : ""}</Text>
                <Text style={styles.host}>Von {item.owner_name || "—"}</Text>
              </View>
              <View style={styles.counts}>
                <Text style={styles.count}>{item.going_count} zusagen</Text>
                <Text style={styles.countMuted}>{item.interested_count} interessiert</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.pill, going && styles.pillActive]} onPress={() => rsvp(item.id, going ? "not_going" : "going")}>
                <Text style={[styles.pillText, going && styles.pillTextActive]}>{going ? "Zugesagt" : "Zusagen"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pill, interested && styles.pillActive]} onPress={() => rsvp(item.id, interested ? "not_going" : "interested")}>
                <Text style={[styles.pillText, interested && styles.pillTextActive]}>{interested ? "Interessiert" : "Vielleicht"}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 50 },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing(3), marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  host: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  counts: { alignItems: "flex-end" },
  count: { color: colors.accent, fontWeight: "700", fontSize: 12 },
  countMuted: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: colors.bg },
});
