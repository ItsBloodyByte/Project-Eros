import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

const MAX_VIDEOS = 4;
const MAX_DURATION_S = 60;
const MAX_LONGER_EDGE_PX = 1920;

export default function VideosScreen() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [videos, setVideos] = useState([]);

  const isPremium = !!user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickAndUpload = async () => {
    if (!isPremium) {
      Alert.alert("Premium erforderlich", "Video-Uploads sind Premium-Mitgliedern vorbehalten.");
      return;
    }
    const active = videos.filter((v) => v.moderation_status !== "rejected");
    if (active.length >= MAX_VIDEOS) {
      Alert.alert("Limit erreicht", `Maximal ${MAX_VIDEOS} Videos erlaubt. Bitte lösche zuerst ein vorhandenes Video.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Berechtigung", "Galerie-Zugriff fehlt."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: MAX_DURATION_S,
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const duration = (a.duration || 0) / 1000; // expo returns ms
    const width = a.width || 0;
    const height = a.height || 0;
    if (duration > MAX_DURATION_S + 0.5) {
      Alert.alert("Zu lang", `Videos dürfen höchstens ${MAX_DURATION_S} Sekunden lang sein.`);
      return;
    }
    if (Math.max(width, height) > MAX_LONGER_EDGE_PX + 2) {
      Alert.alert("Zu groß", "Videos dürfen max. 1080p sein (längste Kante ≤ 1920 px).");
      return;
    }
    if (!a.base64) {
      Alert.alert("Fehler", "Video konnte nicht gelesen werden (base64 fehlt).");
      return;
    }
    const mime = a.mimeType || "video/mp4";
    const data_url = `data:${mime};base64,${a.base64}`;
    // Guard: ~30 MB raw → ~40MB base64
    if (data_url.length > 41_000_000) {
      Alert.alert("Zu groß", "Bitte wähle ein kleineres Video (max. ~30 MB).");
      return;
    }
    setUploading(true);
    try {
      await api.post("/me/videos", {
        data_url, caption: caption || undefined,
        duration_seconds: duration, width, height,
      });
      setCaption("");
      await load();
      await refresh();
      Alert.alert("Hochgeladen", "Dein Video wird von der Moderation geprüft.");
    } catch (e) {
      Alert.alert("Upload fehlgeschlagen", e?.response?.data?.detail || "Unbekannter Fehler");
    } finally { setUploading(false); }
  };

  const remove = (id) => {
    Alert.alert("Video löschen?", "Das Video wird entfernt.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: async () => {
        try { await api.delete(`/me/videos/${id}`); await load(); await refresh(); }
        catch (e) { Alert.alert("Fehler", e?.response?.data?.detail || "Löschen fehlgeschlagen"); }
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>Meine Videos</Text>
      <Text style={styles.sub}>Premium-Feature · max. {MAX_VIDEOS} Videos · {MAX_DURATION_S} s · 1080p</Text>

      {!isPremium && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Premium erforderlich</Text>
          <Text style={styles.noticeText}>Mit Premium kannst du bis zu {MAX_VIDEOS} Kurzvideos auf deinem Profil zeigen.</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Neues Video hochladen</Text>
        <TextInput
          style={styles.input} value={caption} onChangeText={setCaption}
          placeholder="Optionale Bildunterschrift…" placeholderTextColor={colors.textDim}
          maxLength={120}
        />
        <TouchableOpacity
          style={[styles.btn, (!isPremium || uploading) && { opacity: 0.6 }]}
          onPress={pickAndUpload}
          disabled={!isPremium || uploading}
        >
          <Text style={styles.btnText}>{uploading ? "Lädt hoch…" : "Video auswählen & hochladen"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing(5) }]}>Bereits hochgeladen ({videos.length})</Text>
      {videos.length === 0 ? (
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>Noch keine Videos vorhanden.</Text>
      ) : videos.map((v) => (
        <View key={v.id} style={styles.videoCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.videoTitle}>{v.caption || "Ohne Titel"}</Text>
            <Text style={styles.videoMeta}>
              {v.duration_seconds ? `${Math.round(v.duration_seconds)}s` : ""}
              {v.width && v.height ? ` · ${v.width}×${v.height}` : ""}
              {v.moderation_status ? ` · ${statusLabel(v.moderation_status)}` : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={() => remove(v.id)}>
            <Text style={{ color: colors.danger, fontWeight: "700" }}>Löschen</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function statusLabel(s) {
  return ({
    pending: "in Prüfung", approved: "freigegeben", rejected: "abgelehnt",
  })[s] || s;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 4 },
  notice: { marginTop: spacing(4), padding: spacing(4), borderRadius: radii.lg, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.card },
  noticeTitle: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  noticeText: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  section: { marginTop: spacing(5), padding: spacing(4), backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  input: { marginTop: 10, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 10, borderRadius: radii.md, fontSize: 14, backgroundColor: colors.bg },
  btn: { marginTop: 12, backgroundColor: colors.accent, borderRadius: radii.pill, paddingVertical: 12, alignItems: "center" },
  btnText: { color: colors.bg, fontWeight: "700", fontSize: 14 },
  videoCard: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, padding: spacing(3), backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  videoTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  videoMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
