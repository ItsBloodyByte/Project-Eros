import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api";

export default function ChatScreen({ route }) {
  const { matchId } = route.params;
  const { t } = useTranslation();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  const load = async () => { const { data } = await api.get(`/matches/${matchId}/messages`); setMsgs(data.messages || []); };
  useEffect(() => { load().catch(()=>{}); const i = setInterval(()=>load().catch(()=>{}), 4000); return () => clearInterval(i); }, [matchId]);

  const send = async () => {
    if (!text.trim()) return;
    await api.post("/messages", { match_id: matchId, text: text.trim() });
    setText("");
    await load();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "#0c0f14" }}>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={styles.bubble}><Text style={styles.bubbleText}>{item.text}</Text></View>
        )}
      />
      <View style={styles.row}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder={t("chat.placeholder")} placeholderTextColor="#5a6370" />
        <TouchableOpacity style={styles.send} onPress={send}><Text style={{ color: "#0c0f14", fontWeight: "700" }}>{t("chat.send")}</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  bubble: { backgroundColor: "#1a2230", borderRadius: 18, padding: 10, marginBottom: 6, maxWidth: "80%", alignSelf: "flex-start" },
  bubbleText: { color: "#f4efe7" },
  row: { flexDirection: "row", padding: 8, borderTopWidth: 1, borderTopColor: "#1a2230" },
  input: { flex: 1, color: "#f4efe7", backgroundColor: "#131822", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  send: { marginLeft: 8, backgroundColor: "#f4efe7", borderRadius: 18, paddingHorizontal: 16, justifyContent: "center" },
});
