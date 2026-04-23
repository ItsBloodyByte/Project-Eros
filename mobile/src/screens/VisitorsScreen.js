import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

const rel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tag${Math.floor(diff/86400) === 1 ? "" : "en"}`;
  return d.toLocaleDateString("de-DE");
};

export default function VisitorsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [premium, setPremium] = useState(null);

  const load = useCallback(async () => {
    try {
      const [v, p] = await Promise.all([
        api.get("/me/visitors"),
        api.get("/premium/status"),
      ]);
      const visible = (v.data.visitors || []).map((x) => ({ ...x, blurred: false }));
      const blurred = (v.data.blurred_visitors || []).map((x) => ({ ...x, blurred: true }));
      setItems([...visible, ...blurred]);
      setPremium(p.data);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg, flex: 1 }}
      contentContainerStyle={{ padding: spacing(3) }}
      data={items}
      keyExtractor={(v, i) => v.id || `visitor-${i}`}
      refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={!premium?.premium ? (
        <View style={styles.premiumHint}>
          <Text style={styles.premiumHintTitle}>Premium zeigt dir, wer dich besucht hat.</Text>
          <Text style={styles.premiumHintText}>In der Gratis-Version werden Besucher:innen anonymisiert.</Text>
        </View>
      ) : null}
      ListEmptyComponent={<Text style={styles.empty}>Noch keine Besuche.</Text>}
      renderItem={({ item }) => {
        const u = item.blurred ? {} : item; // response flattens user fields onto the item
        const photo = (u.photos || []).find((p) => p.is_primary)?.data || (u.photos || [])[0]?.data;
        const locked = item.blurred || !premium?.premium;
        return (
          <TouchableOpacity style={styles.row} onPress={() => !locked && navigation.navigate("Profile", { id: u.id })} activeOpacity={locked ? 1 : 0.7}>
            {photo
              ? <Image source={{ uri: photo }} style={[styles.avatar, locked && { opacity: 0.4 }]} blurRadius={locked ? 18 : 0} />
              : <View style={[styles.avatar, { backgroundColor: colors.card }]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{locked ? "Anonyme:r Besucher:in" : (u.display_name || "—")}</Text>
              <Text style={styles.meta}>{rel(item.visited_at)}{item.visit_count > 1 ? ` · ${item.visit_count}×\u00A0besucht` : ""}</Text>
            </View>
            {!locked && <Text style={styles.chevron}>{"›"}</Text>}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 50 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { color: colors.text, fontWeight: "700", fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  chevron: { color: colors.textDim, fontSize: 22, fontWeight: "300" },
  premiumHint: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing(3), marginBottom: 12, borderWidth: 1, borderColor: colors.accent },
  premiumHintTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  premiumHintText: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
});
