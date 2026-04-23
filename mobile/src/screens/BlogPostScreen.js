import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Image, StyleSheet } from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function BlogPostScreen({ route }) {
  const { slug } = route.params || {};
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/blog/posts/${slug}`);
        setPost(data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [slug]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (!post) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Beitrag nicht gefunden.</Text></View>;
  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      {post.cover_image_url ? <Image source={{ uri: post.cover_image_url }} style={styles.cover} /> : null}
      <Text style={styles.h1}>{post.title}</Text>
      <Text style={styles.meta}>
        {(post.published_at || post.created_at || "").slice(0, 10)}
        {post.author_name ? ` · ${post.author_name}` : ""}
      </Text>
      {post.excerpt ? <Text style={styles.excerpt}>{post.excerpt}</Text> : null}
      {/* Render markdown-as-plain-text (lightweight). Web app uses full markdown. */}
      <Text style={styles.body}>{post.content_markdown || post.content || ""}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  cover: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.lg, marginBottom: spacing(4), backgroundColor: colors.card },
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: 6, fontSize: 12 },
  excerpt: { color: colors.textMuted, marginTop: 12, fontSize: 14, fontStyle: "italic", lineHeight: 21 },
  body: { color: colors.text, marginTop: spacing(4), fontSize: 15, lineHeight: 23 },
});
