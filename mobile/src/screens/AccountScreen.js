import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet,
} from "react-native";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function AccountScreen() {
  const { user, logout, refresh } = useAuth();
  const [coupleData, setCoupleData] = useState(null);
  const [quota, setQuota] = useState(null);
  const [invites, setInvites] = useState({ incoming: [], outgoing: [] });
  const [inviteEmail, setInviteEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [m, iv, q] = await Promise.all([
        api.get("/couples/me"),
        api.get("/couples/invites"),
        api.get("/likes/quota"),
      ]);
      setCoupleData(m.data); setInvites(iv.data); setQuota(q.data);
    } catch (e) {}
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    const v = inviteEmail.trim(); if (!v) return;
    setBusy(true);
    try {
      await api.post("/couples/invite", v.includes("@") ? { email: v } : { user_id: v });
      setInviteEmail(""); await load();
      Alert.alert("Einladung", "Einladung gesendet");
    } catch (e) { Alert.alert("Fehler", e?.response?.data?.detail || "Einladung fehlgeschlagen"); }
    finally { setBusy(false); }
  };
  const accept = async (id) => { try { await api.post(`/couples/invites/${id}/accept`); await refresh(); await load(); } catch (e) {} };
  const decline = async (id) => { try { await api.post(`/couples/invites/${id}/decline`); await load(); } catch (e) {} };
  const revoke = async (id) => { try { await api.delete(`/couples/invites/${id}`); await load(); } catch (e) {} };
  const unlink = async () => {
    Alert.alert("Verknüpfung aufheben?", "Beide Konten werden wieder getrennt.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Aufheben", style: "destructive", onPress: async () => { try { await api.post("/couples/unlink"); await refresh(); await load(); } catch (e) {} } },
    ]);
  };
  const redeem = async () => {
    const v = promoCode.trim().toUpperCase(); if (!v) return;
    try {
      const { data } = await api.post("/promo/redeem", { code: v });
      setPromoCode(""); await refresh(); await load();
      const msg = data.kind === "premium_days" ? `${data.value} Tage Premium freigeschaltet 🎉` : `${data.value} Min Boost aktiv`;
      Alert.alert("Eingelöst", msg);
    } catch (e) { Alert.alert("Einlösung fehlgeschlagen", e?.response?.data?.detail || ""); }
  };

  const isLinked = !!coupleData?.partner;
  const isDuo = coupleData?.account_type === "duo";

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>Konto</Text>
      <Text style={styles.sub}>{user?.display_name} · {user?.email}</Text>

      {/* Premium Summary */}
      <Section title="Premium">
        <Text style={styles.kv}>Status: <Text style={{ color: colors.text }}>{quota?.is_premium ? "Aktiv" : "Free-Tarif"}</Text></Text>
        <Text style={styles.kv}>Likes heute: <Text style={{ color: colors.text }}>{quota?.likes_today ?? 0}{quota?.daily_like_limit ? ` / ${quota.daily_like_limit}` : " (unbegrenzt)"}</Text></Text>
        <Text style={styles.kv}>Super-Likes: <Text style={{ color: colors.text }}>{quota?.super_likes_today ?? 0}{typeof quota?.super_likes_remaining === "number" ? ` · ${quota.super_likes_remaining} übrig` : ""}</Text></Text>
      </Section>

      {/* Promo */}
      <Section title="Promo-Code einlösen">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} value={promoCode} onChangeText={(v) => setPromoCode(v.toUpperCase())} placeholder="z. B. WELCOME30" placeholderTextColor={colors.textDim} autoCapitalize="characters" />
          <TouchableOpacity style={styles.btn} onPress={redeem}><Text style={styles.btnText}>Einlösen</Text></TouchableOpacity>
        </View>
      </Section>

      {/* Couple */}
      <Section title="Partner-Profil">
        {isDuo && (
          <Text style={styles.kv}>Dein Konto ist ein Paar-Account (Person B: {coupleData?.persona_b?.display_name || "—"}).</Text>
        )}
        {isLinked && (
          <View>
            <Text style={styles.kv}>Verknüpft mit <Text style={{ color: colors.text }}>{coupleData.partner.display_name}</Text></Text>
            <TouchableOpacity style={[styles.btnSmall, { backgroundColor: colors.danger, marginTop: 8 }]} onPress={unlink}>
              <Text style={[styles.btnText, { color: colors.text }]}>Verknüpfung aufheben</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isDuo && !isLinked && (
          <View>
            <Text style={styles.kv}>Lade einen Partner per E-Mail oder User-ID ein.</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={inviteEmail} onChangeText={setInviteEmail} placeholder="E-Mail oder ID" placeholderTextColor={colors.textDim} autoCapitalize="none" />
              <TouchableOpacity style={styles.btn} onPress={invite} disabled={busy}><Text style={styles.btnText}>Einladen</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {(invites.incoming || []).length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.secLabel}>Eingehend</Text>
            {invites.incoming.map((iv) => (
              <View key={iv.id} style={styles.inviteRow}>
                <Text style={{ color: colors.text, flex: 1 }}>{iv.from_display_name}</Text>
                <TouchableOpacity style={[styles.btnSmall]} onPress={() => accept(iv.id)}><Text style={styles.btnText}>Annehmen</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnSmall, styles.btnGhost]} onPress={() => decline(iv.id)}><Text style={{ color: colors.text }}>Ablehnen</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {(invites.outgoing || []).length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.secLabel}>Ausgehend</Text>
            {invites.outgoing.map((iv) => (
              <View key={iv.id} style={styles.inviteRow}>
                <Text style={{ color: colors.textMuted, flex: 1 }}>an {iv.to_display_name}</Text>
                <TouchableOpacity style={[styles.btnSmall, styles.btnGhost]} onPress={() => revoke(iv.id)}><Text style={{ color: colors.text }}>Zurückziehen</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </Section>

      <TouchableOpacity style={[styles.btn, { marginTop: spacing(4), backgroundColor: colors.danger }]} onPress={logout}>
        <Text style={[styles.btnText, { color: colors.text }]}>Abmelden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing(4), marginTop: spacing(4) }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 2 },
  kv: { color: colors.textMuted, marginTop: 6, fontSize: 13 },
  secLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 10, borderRadius: radii.md },
  btn: { backgroundColor: colors.text, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  btnSmall: { backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  btnText: { color: colors.bg, fontWeight: "700", fontSize: 13 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
});
