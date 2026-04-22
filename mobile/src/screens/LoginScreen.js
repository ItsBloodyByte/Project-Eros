import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../AuthContext";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setErr(null); setBusy(true);
    try { await login(email, password); }
    catch (e) { setErr(e?.response?.data?.detail || t("auth.login_failed")); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Eros</Text>
      <Text style={styles.tag}>{t("auth.login_tagline")}</Text>
      <Text style={styles.label}>{t("auth.email")}</Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Text style={styles.label}>{t("auth.password")}</Text>
      <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
      {err && <Text style={styles.err}>{err}</Text>}
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#0c0f14" /> : <Text style={styles.btnText}>{t("auth.sign_in")}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c0f14", padding: 24, justifyContent: "center" },
  brand: { fontSize: 48, color: "#f4efe7", fontFamily: "EB Garamond", textAlign: "center" },
  tag: { color: "#b8b0a2", textAlign: "center", marginBottom: 24 },
  label: { color: "#b8b0a2", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#2b313c", color: "#f4efe7", padding: 12, borderRadius: 12, marginTop: 4 },
  btn: { backgroundColor: "#f4efe7", padding: 14, borderRadius: 9999, alignItems: "center", marginTop: 20 },
  btnText: { color: "#0c0f14", fontWeight: "600" },
  err: { color: "#e25c4a", marginTop: 10 },
});
