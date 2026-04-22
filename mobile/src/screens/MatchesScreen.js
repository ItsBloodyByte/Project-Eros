import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity, RefreshControl, StyleSheet,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function MatchesScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/matches");
      setMatches(data.matches || []);
    } catch (e) {}
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg, flex: 1 }}
      contentContainerStyle={{ padding: spacing(3) }}
      data={matches}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 40 }}>Noch keine Matches</Text>}
      renderItem={({ item }) => {
        const u = item.user;
        const photo = (u.photos || []).find((p) => p.is_primary)?.data || (u.photos || [])[0]?.data;
        const partner = u.partner || (u.account_type === "duo" ? u.persona_b : null);
        const name = partner ? `${u.display_name} & ${partner.display_name}` : u.display_name;
        return (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("Chat", { matchId: item.id })}>
            {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.card }]} />}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.name}>{name}</Text>
                {partner && <Text style={styles.pairTag}>PAAR</Text>}
                {u.is_system && <Text style={styles.pairTag}>OFFIZIELL</Text>}
              </View>
              <Text style={styles.sub}>
                {item.last_message_at ? new Date(item.last_message_at).toLocaleString() : "Neuer Match"}
              </Text>
            </View>
            {item.unread_count > 0 && (
              <View style={styles.unread}><Text style={styles.unreadTxt}>{item.unread_count}</Text></View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { color: colors.text, fontWeight: "700", fontSize: 15 },
  sub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  pairTag: { color: colors.accent, fontSize: 9, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: colors.accent, borderRadius: radii.pill },
  unread: { backgroundColor: colors.accent, borderRadius: 12, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: "center" },
  unreadTxt: { color: colors.bg, fontSize: 11, fontWeight: "700" },
});
