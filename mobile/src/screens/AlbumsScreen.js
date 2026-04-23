import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function AlbumsScreen({ navigation }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/albums");
      setAlbums(data.albums || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }) => {
    const cover = (item.photos || [])[0]?.data;
    const count = (item.photos || []).length;
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("AlbumDetail", { id: item.id, title: item.title })}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cover} blurRadius={item.is_nsfw ? 30 : 0} />
          : <View style={[styles.cover, { backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }]}><Text style={{ color: colors.textMuted }}>Leer</Text></View>}
        {item.is_nsfw && (
          <View style={styles.nsfwBadge}><Text style={styles.nsfwText}>NSFW</Text></View>
        )}
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{item.title || "Ohne Titel"}</Text>
          <Text style={styles.sub}>{count} Foto{count === 1 ? "" : "s"} · {(item.shared_with || []).length} Freigabe{(item.shared_with || []).length === 1 ? "" : "n"}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg, flex: 1 }}
      data={albums}
      numColumns={2}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: 10 }}
      refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={<Text style={styles.empty}>Noch keine Alben.{"\n"}Erstelle welche über die Web-App.</Text>}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  card: { flex: 1, margin: 6, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.card, aspectRatio: 3 / 4, position: "relative" },
  cover: { width: "100%", height: "100%" },
  meta: { position: "absolute", left: 10, right: 10, bottom: 10 },
  title: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sub: { color: "#e5dfd1", fontSize: 11, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing(10) },
  nsfwBadge: { position: "absolute", top: 8, left: 8, backgroundColor: colors.danger, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  nsfwText: { color: colors.text, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
});
