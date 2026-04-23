import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Image, ActivityIndicator, StyleSheet, TouchableOpacity,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function AlbumDetailScreen({ route }) {
  const { id } = route.params || {};
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/albums/${id}`);
        setAlbum(data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  const requestAccess = async () => {
    setRequesting(true);
    try {
      await api.post("/albums/unlock-request", { album_id: id, message: "Zugriffsanfrage \u00fcber die Eros Mobile-App" });
      const { data } = await api.get(`/albums/${id}`);
      setAlbum(data);
    } catch {}
    finally { setRequesting(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (!album) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Album nicht gefunden.</Text></View>;

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>{album.title || "Ohne Titel"}</Text>
      {album.description ? <Text style={styles.desc}>{album.description}</Text> : null}
      {album.locked ? (
        <View style={styles.locked}>
          <Text style={styles.lockedTitle}>Privates Album</Text>
          <Text style={styles.lockedText}>Du hast aktuell keinen Zugriff auf diese Inhalte.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestAccess} disabled={requesting}>
            <Text style={styles.btnText}>{requesting ? "Sende Anfrage…" : "Zugriff anfragen"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          {(album.photos || []).map((p, i) => (
            <Image key={i} source={{ uri: p.data }} style={styles.tile} blurRadius={album.is_nsfw ? 24 : 0} />
          ))}
          {(album.photos || []).length === 0 && (
            <Text style={{ color: colors.textMuted }}>Dieses Album ist noch leer.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 26, fontWeight: "700" },
  desc: { color: colors.textMuted, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tile: { width: "48%", aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.card },
  locked: { marginTop: 20, padding: spacing(4), borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  lockedTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  lockedText: { color: colors.textMuted, marginTop: 6, fontSize: 13 },
  btn: { marginTop: 10, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, alignItems: "center" },
  btnText: { color: colors.bg, fontWeight: "700" },
});
