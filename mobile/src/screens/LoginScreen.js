import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setErr(null); setBusy(true);
    try { await login(email, password); }
    catch (e) { setErr(e?.response?.data?.detail || "Anmeldung fehlgeschlagen"); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Eros</Text>
      <Text style={styles.tag}>Willkommen zurück</Text>
      <Text style={styles.label}>E-Mail</Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Text style={styles.label}>Passwort</Text>
      <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
      {err && <Text style={styles.err}>{err}</Text>}
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>Anmelden</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Register")} style={styles.altLink}>
        <Text style={{ color: colors.textMuted }}>Noch kein Konto? Registrieren</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing(6), justifyContent: "center" },
  brand: { fontSize: 48, color: colors.text, textAlign: "center" },
  tag: { color: colors.textMuted, textAlign: "center", marginBottom: spacing(6) },
  label: { color: colors.textMuted, marginTop: spacing(2) },
  input: { borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 12, borderRadius: radii.md, marginTop: 4 },
  btn: { backgroundColor: colors.text, padding: 14, borderRadius: radii.pill, alignItems: "center", marginTop: spacing(5) },
  btnText: { color: colors.bg, fontWeight: "700" },
  err: { color: colors.danger, marginTop: 10 },
  altLink: { alignItems: "center", marginTop: spacing(4) },
});
