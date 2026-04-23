import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Image,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function BlogScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/blog/posts", { params: { limit: 30 } });
      setPosts(data.posts || []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg, flex: 1 }}
      contentContainerStyle={{ padding: spacing(3) }}
      data={posts}
      keyExtractor={(p) => p.id || p.slug}
      refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={<Text style={styles.empty}>Noch keine Beiträge.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("BlogPost", { slug: item.slug, title: item.title })}>
          {item.cover_image_url ? (
            <Image source={{ uri: item.cover_image_url }} style={styles.cover} />
          ) : null}
          <View style={{ padding: spacing(3) }}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            {item.excerpt ? <Text style={styles.excerpt} numberOfLines={3}>{item.excerpt}</Text> : null}
            <Text style={styles.meta}>{(item.published_at || item.created_at || "").slice(0, 10)}{item.author_name ? ` · ${item.author_name}` : ""}</Text>
            {(item.tags || []).length > 0 && (
              <View style={styles.tags}>
                {(item.tags || []).slice(0, 4).map((t) => (
                  <Text key={t} style={styles.tag}>{t}</Text>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 50 },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cover: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.bgAlt },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  excerpt: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 19 },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 8 },
  tags: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  tag: { color: colors.accent, fontSize: 10, letterSpacing: 0.5, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill, textTransform: "uppercase" },
});
