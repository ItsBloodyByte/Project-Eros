import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api";

export default function DiscoverScreen({ navigation }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data } = await api.get("/discover");
    setUsers(data.results || []);
  };
  useEffect(() => { load().catch(()=>{}); }, []);

  return (
    <FlatList
      style={{ backgroundColor: "#0c0f14" }}
      data={users}
      keyExtractor={(u) => u.id}
      contentContainerStyle={{ padding: 12 }}
      numColumns={2}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async ()=>{ setRefreshing(true); await load().catch(()=>{}); setRefreshing(false); }} />}
      renderItem={({ item }) => {
        const primary = (item.photos||[]).find(p=>p.is_primary) || (item.photos||[])[0];
        const isNsfw = primary && primary.nsfw_score >= 0.75;
        return (
          <TouchableOpacity onPress={()=>navigation.navigate("Profile", { id: item.id })} style={styles.card}>
            {primary && <Image source={{ uri: primary.data }} style={[styles.img, isNsfw && { opacity: 0.4 }]} blurRadius={isNsfw ? 20 : 0} />}
            <View style={styles.meta}>
              <Text style={styles.name}>{item.display_name} · {item.age}</Text>
              {typeof item.distance_km === "number" && <Text style={styles.dist}>~{item.distance_km} km</Text>}
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>{t("discover.no_results_title")}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 4, borderRadius: 16, overflow: "hidden", backgroundColor: "#131822", aspectRatio: 3/4 },
  img: { width: "100%", height: "100%" },
  meta: { position: "absolute", left: 8, right: 8, bottom: 8 },
  name: { color: "#f4efe7", fontSize: 16, fontWeight: "600" },
  dist: { color: "#e5dfd1", fontSize: 12 },
  empty: { color: "#b8b0a2", textAlign: "center", marginTop: 40 },
});
