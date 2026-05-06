import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image, Alert,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

export default function ChatScreen({ route, navigation }) {
  const { matchId } = route.params;
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [senders, setSenders] = useState({});
  const [coupleMeta, setCoupleMeta] = useState({});
  const [peerHeader, setPeerHeader] = useState("");
  const [text, setText] = useState("");
  const [pic4pic, setPic4pic] = useState(null);
  const [pic4picBusy, setPic4picBusy] = useState(false);
  const listRef = useRef(null);

  // Reload chat messages + the current Pic4Pic exchange snapshot.
  // Polled every 4s so partner-side changes show up without a WS layer
  // on mobile (kept consistent with the existing message polling pattern).
  const load = async () => {
    const { data } = await api.get(`/matches/${matchId}/messages`);
    setMsgs(data.messages || []);
    setSenders(data.senders || {});
    setCoupleMeta(data.couple_meta || {});
    try {
      const ex = await api.get(`/pic4pic/match/${matchId}`);
      setPic4pic(ex.data?.exchange || null);
    } catch {
      // Pic4Pic is optional; never block the chat list on its failure.
    }
  };
  useEffect(() => {
    load().catch(() => {});
    const i = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(i);
  }, [matchId]);

  useEffect(() => {
    // Compute header title from couple_meta
    const meId = user?.id;
    const myPartner = user?.partner_user_id;
    const other = Object.values(coupleMeta || {}).find(
      (cm) => cm && !(cm.people || []).some((p) => p.id === meId || p.id === myPartner)
    );
    if (other) {
      const names = (other.people || []).map((p) => p.display_name).filter(Boolean).join(" & ");
      setPeerHeader(names);
      navigation.setOptions({ title: names });
    }
  }, [coupleMeta, navigation, user?.id, user?.partner_user_id]);

  const myIds = new Set([user?.id, user?.partner_user_id].filter(Boolean));
  const send = async () => {
    if (!text.trim()) return;
    const { data } = await api.post("/messages", { match_id: matchId, text: text.trim() });
    setText("");
    setMsgs((prev) => [...prev, data]);
    if (data.sender) setSenders((s) => ({ ...s, [data.sender.id]: data.sender }));
  };

  // ----- Pic4Pic helpers --------------------------------------------------
  const pickPic4PicImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Berechtigung", "Galerie-Zugriff fehlt.");
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.8, base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return null;
    const a = res.assets[0];
    const mime = a.mimeType || "image/jpeg";
    return `data:${mime};base64,${a.base64}`;
  };

  const startPic4Pic = async () => {
    if (pic4picBusy) return;
    const dataUrl = await pickPic4PicImage();
    if (!dataUrl) return;
    setPic4picBusy(true);
    try {
      await api.post("/pic4pic/initiate", { match_id: matchId, data_url: dataUrl });
      await load();
      Alert.alert("Pic4Pic", "Foto versiegelt – warte auf Antwort.");
    } catch (e) {
      Alert.alert("Pic4Pic", e?.response?.data?.detail || "Konnte nicht starten");
    } finally {
      setPic4picBusy(false);
    }
  };

  const respondPic4Pic = async () => {
    if (pic4picBusy || !pic4pic?.id) return;
    const dataUrl = await pickPic4PicImage();
    if (!dataUrl) return;
    setPic4picBusy(true);
    try {
      await api.post("/pic4pic/respond", { exchange_id: pic4pic.id, data_url: dataUrl });
      await load();
      Alert.alert("Pic4Pic", "Antwort gesendet — beide Fotos sind jetzt sichtbar.");
    } catch (e) {
      Alert.alert("Pic4Pic", e?.response?.data?.detail || "Konnte nicht antworten");
    } finally {
      setPic4picBusy(false);
    }
  };

  const cancelPic4Pic = async () => {
    if (pic4picBusy || !pic4pic?.id) return;
    setPic4picBusy(true);
    try {
      await api.post("/pic4pic/cancel", { exchange_id: pic4pic.id });
      await load();
    } catch (e) {
      Alert.alert("Pic4Pic", e?.response?.data?.detail || "Abbruch fehlgeschlagen");
    } finally {
      setPic4picBusy(false);
    }
  };

  // Show sender labels when this thread involves a couple on either side
  const isCoupleThread =
    !!user?.partner_user_id ||
    !!coupleMeta?.user_a?.is_couple ||
    !!coupleMeta?.user_b?.is_couple;

  const status = pic4pic?.status || null;
  const role = pic4pic?.your_role || null;
  const isPending = status === "pending";
  const isRecipient = role === "recipient";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = myIds.has(item.sender_id);
          const senderProfile = item.sender || senders[item.sender_id] || null;
          const media = item.media_data_url;
          const isNsfw = media && (item.nsfw_score ?? 0) >= 0.75;
          return (
            <View style={[{ flexDirection: "row", marginBottom: 6, alignItems: "flex-end", gap: 6 }, mine ? { justifyContent: "flex-end" } : {}]}>
              {!mine && senderProfile?.avatar && (
                <Image source={{ uri: senderProfile.avatar }} style={styles.sa} />
              )}
              <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem, { maxWidth: "78%" }]}>
                {isCoupleThread && senderProfile?.display_name && (
                  <Text style={[styles.senderLabel, mine ? { color: "rgba(244,239,231,0.8)" } : { color: colors.accent }]}>
                    {senderProfile.display_name}
                  </Text>
                )}
                {!!item.text && (
                  <Text style={mine ? styles.bubbleMeTxt : styles.bubbleThemTxt}>{item.text}</Text>
                )}
                {media && (
                  <View style={{ marginTop: item.text ? 6 : 0, borderRadius: 10, overflow: "hidden" }}>
                    <Image
                      source={{ uri: media }}
                      style={{ width: 220, height: 280, opacity: isNsfw ? 0.25 : 1 }}
                      resizeMode="cover"
                    />
                    {isNsfw && (
                      <Text style={{ color: colors.text, fontSize: 11, marginTop: 4 }}>
                        Sensibler Inhalt — separat öffnen.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Pic4Pic banner */}
      <Pic4PicBanner
        status={status}
        isPending={isPending}
        isRecipient={isRecipient}
        busy={pic4picBusy}
        onStart={startPic4Pic}
        onRespond={respondPic4Pic}
        onCancel={cancelPic4Pic}
      />

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nachricht schreiben …"
          placeholderTextColor={colors.textDim}
        />
        <TouchableOpacity style={styles.send} onPress={send}>
          <Text style={{ color: colors.bg, fontWeight: "700" }}>Senden</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Sealed-photo exchange banner shown above the chat composer. */
function Pic4PicBanner({ status, isPending, isRecipient, busy, onStart, onRespond, onCancel }) {
  // Idle state — show a compact CTA so users discover the feature.
  if (!isPending) {
    return (
      <View style={styles.p4pIdle}>
        <Text style={styles.p4pTitle}>🔒 Pic4Pic</Text>
        <Text style={styles.p4pBody}>
          Sicherer Foto-Tausch. Beide Bilder werden erst sichtbar, wenn die Gegenseite ebenfalls eines schickt.
        </Text>
        <TouchableOpacity
          style={[styles.p4pBtnOutline, busy && { opacity: 0.5 }]}
          onPress={onStart}
          disabled={busy}
        >
          <Text style={styles.p4pBtnOutlineTxt}>Pic4Pic starten</Text>
        </TouchableOpacity>
      </View>
    );
  }
  // Pending — role-specific copy + actions.
  return (
    <View style={styles.p4pPending}>
      <Text style={styles.p4pTitle}>🔒 Pic4Pic — versiegelt</Text>
      <Text style={styles.p4pBody}>
        {isRecipient
          ? "Es wartet ein versiegeltes Foto. Sende ein eigenes Foto, um beide gleichzeitig zu sehen."
          : "Dein Foto ist versiegelt. Du erhältst die Antwort, sobald die Gegenseite ein Foto sendet."}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {isRecipient && (
          <TouchableOpacity
            style={[styles.p4pBtn, busy && { opacity: 0.5 }]}
            onPress={onRespond}
            disabled={busy}
          >
            <Text style={styles.p4pBtnTxt}>Antworten</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.p4pBtnGhost, busy && { opacity: 0.5 }]}
          onPress={onCancel}
          disabled={busy}
        >
          <Text style={styles.p4pBtnGhostTxt}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sa: { width: 28, height: 28, borderRadius: 14 },
  bubble: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMe: { backgroundColor: colors.text, alignSelf: "flex-end" },
  bubbleThem: { backgroundColor: colors.card, alignSelf: "flex-start" },
  bubbleMeTxt: { color: colors.bg },
  bubbleThemTxt: { color: colors.text },
  senderLabel: { fontSize: 10.5, fontWeight: "700", marginBottom: 2 },
  row: { flexDirection: "row", padding: 8, borderTopWidth: 1, borderTopColor: colors.card, gap: 8 },
  input: { flex: 1, color: colors.text, backgroundColor: colors.bgAlt, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 10 },
  send: { backgroundColor: colors.text, borderRadius: radii.pill, paddingHorizontal: 16, justifyContent: "center" },

  // Pic4Pic banner styles
  p4pIdle: {
    marginHorizontal: 8, marginTop: 4, padding: 10,
    backgroundColor: colors.bgAlt, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.card,
  },
  p4pPending: {
    marginHorizontal: 8, marginTop: 4, padding: 10,
    backgroundColor: colors.card, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.accent,
  },
  p4pTitle: { color: colors.text, fontWeight: "700", marginBottom: 2 },
  p4pBody: { color: colors.textDim, fontSize: 12, marginBottom: 8 },
  p4pBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radii.pill, alignSelf: "flex-start",
  },
  p4pBtnTxt: { color: colors.bg, fontWeight: "700", fontSize: 12 },
  p4pBtnOutline: {
    borderWidth: 1, borderColor: colors.text, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radii.pill, alignSelf: "flex-start",
  },
  p4pBtnOutlineTxt: { color: colors.text, fontWeight: "700", fontSize: 12 },
  p4pBtnGhost: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radii.pill, alignSelf: "flex-start",
  },
  p4pBtnGhostTxt: { color: colors.textDim, fontSize: 12 },
});
