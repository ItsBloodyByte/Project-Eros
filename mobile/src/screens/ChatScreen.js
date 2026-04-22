import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
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
  const listRef = useRef(null);

  const load = async () => {
    const { data } = await api.get(`/matches/${matchId}/messages`);
    setMsgs(data.messages || []);
    setSenders(data.senders || {});
    setCoupleMeta(data.couple_meta || {});
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

  // Show sender labels when this thread involves a couple on either side
  const isCoupleThread =
    !!user?.partner_user_id ||
    !!coupleMeta?.user_a?.is_couple ||
    !!coupleMeta?.user_b?.is_couple;

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
                <Text style={mine ? styles.bubbleMeTxt : styles.bubbleThemTxt}>{item.text}</Text>
              </View>
            </View>
          );
        }}
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
});
