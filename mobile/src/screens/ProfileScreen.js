import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api";

export default function ProfileScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { id } = route.params;
  const [p, setP] = useState(null);

  useEffect(() => {
    api.post(`/seen/${id}`).catch(()=>{});
    api.get(`/users/${id}`).then(r => setP(r.data)).catch(()=>{});
  }, [id]);

  if (!p) return <View style={{ flex: 1, backgroundColor: "#0c0f14" }} />;

  const row = (label, v) => (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) ? null : (
    <View style={{ marginTop: 8 }}><Text style={styles.key}>{label}</Text><Text style={styles.val}>{Array.isArray(v)?v.join(" · "):v}</Text></View>
  );

  const like = async () => {
    const { data } = await api.post("/likes", { target_user_id: id });
    if (data.matched) navigation.navigate("Chat", { matchId: data.match_id });
  };

  return (
    <ScrollView style={{ backgroundColor: "#0c0f14" }} contentContainerStyle={{ padding: 16 }}>
      {(p.photos||[]).map((ph) => (
        <Image key={ph.id} source={{ uri: ph.data }} style={styles.hero} blurRadius={ph.nsfw_score>=0.75?24:0} />
      ))}
      <Text style={styles.name}>{p.display_name} · {p.age}</Text>
      {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
      {row(t("profile.height"), p.height_cm ? `${p.height_cm} cm` : null)}
      {row(t("profile.body_type"), p.body_type ? t(`body_types.${p.body_type}`) : null)}
      {row(t("profile.ethnicity"), p.ethnicity)}
      {row(t("profile.penis_category"), p.penis_category)}
      {row(t("profile.cup_size"), p.cup_size)}
      {row(t("profile.languages"), p.languages)}
      {p.match_id ? (
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate("Chat", { matchId: p.match_id })}>
          <Text style={styles.btnText}>{t("profile.open_chat")}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btn} onPress={like}>
          <Text style={styles.btnText}>{t("profile.like")}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  hero: { width: "100%", aspectRatio: 3/4, borderRadius: 16, marginBottom: 12 },
  name: { color: "#f4efe7", fontSize: 24, fontWeight: "700" },
  bio: { color: "#b8b0a2", marginTop: 6 },
  key: { color: "#b8b0a2", fontSize: 12 },
  val: { color: "#f4efe7", fontSize: 14 },
  btn: { backgroundColor: "#2a7f78", padding: 14, borderRadius: 9999, marginTop: 20, alignItems: "center" },
  btnText: { color: "#f4efe7", fontWeight: "600" },
});
