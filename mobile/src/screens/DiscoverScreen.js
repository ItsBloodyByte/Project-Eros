import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity, RefreshControl, StyleSheet,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function DiscoverScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/discover", { params: { limit: 30 } });
      setUsers(data.results || []);
    } catch (e) {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={users}
      keyExtractor={(u) => u.id}
      contentContainerStyle={{ padding: 10 }}
      numColumns={2}
      refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>Keine Profile gefunden</Text> : null}
      renderItem={({ item }) => {
        const primary = (item.photos || []).find((p) => p.is_primary) || (item.photos || [])[0];
        const isNsfw = primary && (primary.nsfw_score || 0) >= 0.75;
        const partner =
          item.partner ||
          (item.account_type === "duo" ? item.persona_b : null);
        const partnerPhoto = partner
          ? (partner.photos || []).find((p) => p.is_primary)?.data || (partner.photos || [])[0]?.data
          : null;
        const name = partner ? `${item.display_name} & ${partner.display_name}` : item.display_name;
        const age = partner && partner.age ? `${item.age} & ${partner.age}` : item.age;
        return (
          <TouchableOpacity onPress={() => navigation.navigate("Profile", { id: item.id })} style={styles.card}>
            {primary
              ? <Image source={{ uri: primary.data }} style={[styles.img, isNsfw && { opacity: 0.4 }]} blurRadius={isNsfw ? 24 : 0} />
              : <View style={[styles.img, { backgroundColor: colors.card }]} />}
            {partner && (
              <View style={styles.coupleBadge}><Text style={styles.coupleBadgeText}>PAAR</Text></View>
            )}
            {partnerPhoto && (
              <Image source={{ uri: partnerPhoto }} style={styles.partnerOverlay} />
            )}
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.sub}>{age}{typeof item.distance_km === "number" ? ` · ~${item.distance_km} km` : ""}{item.city ? ` · ${item.city}` : ""}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 6, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.card, aspectRatio: 3 / 4, position: "relative" },
  img: { width: "100%", height: "100%" },
  meta: { position: "absolute", left: 10, right: 10, bottom: 10 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  sub: { color: "#e5dfd1", fontSize: 11, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing(10) },
  coupleBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: colors.accent, borderRadius: radii.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  coupleBadgeText: { color: colors.bg, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  partnerOverlay: {
    position: "absolute", right: 8, bottom: 56,
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.9)",
  },
});
