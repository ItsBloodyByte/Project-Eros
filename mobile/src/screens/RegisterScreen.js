import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  Platform, StyleSheet,
} from "react-native";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

const GENDERS = ["woman", "man", "nonbinary", "trans_woman", "trans_man", "other"];
const GENDER_LABELS = {
  woman: "Frau", man: "Mann", nonbinary: "Nicht-binär",
  trans_woman: "Trans-Frau", trans_man: "Trans-Mann", other: "Andere",
};

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [accountType, setAccountType] = useState("single");
  const [form, setForm] = useState({
    email: "", password: "", display_name: "", birth_date: "", gender_identity: "woman",
  });
  const [personaB, setPersonaB] = useState({
    display_name: "", birth_date: "", gender_identity: "man", pronouns: "", bio: "",
  });
  const [consents, setConsents] = useState({ terms: false, privacy: false, sensitive_data: false, nsfw_view: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const canSubmit = form.email && form.password && form.display_name && form.birth_date &&
    consents.terms && consents.privacy && consents.sensitive_data &&
    (accountType === "single" || (personaB.display_name && personaB.birth_date && personaB.gender_identity));

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      await register({
        ...form,
        consents,
        account_type: accountType,
        persona_b: accountType === "duo" ? personaB : undefined,
      });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Registrierung fehlgeschlagen");
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.root}>
      <Text style={styles.brand}>Eros</Text>
      <Text style={styles.tag}>Registrieren</Text>

      <Text style={styles.sectionLabel}>Kontotyp</Text>
      <View style={styles.typeRow}>
        {[{ v: "single", l: "Einzelperson" }, { v: "duo", l: "Paar" }].map((o) => (
          <TouchableOpacity
            key={o.v}
            onPress={() => setAccountType(o.v)}
            style={[styles.typeBtn, accountType === o.v && styles.typeBtnActive]}
          >
            <Text style={[styles.typeTxt, accountType === o.v && styles.typeTxtActive]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{accountType === "duo" ? "Name Person A" : "Anzeigename"}</Text>
      <TextInput style={styles.input} value={form.display_name} onChangeText={(v) => setForm({ ...form, display_name: v })} />
      <Text style={styles.label}>Geburtsdatum (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={form.birth_date} onChangeText={(v) => setForm({ ...form, birth_date: v })} placeholder="1995-06-01" placeholderTextColor={colors.textDim} />
      <Text style={styles.label}>E-Mail</Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
      <Text style={styles.label}>Passwort</Text>
      <TextInput style={styles.input} secureTextEntry value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} />
      <Text style={styles.label}>{accountType === "duo" ? "Gender Person A" : "Gender"}</Text>
      <GenderPicker value={form.gender_identity} onChange={(v) => setForm({ ...form, gender_identity: v })} />

      {accountType === "duo" && (
        <View style={styles.personaB}>
          <Text style={styles.personaBHeader}>Person B</Text>
          <Text style={styles.label}>Name Person B</Text>
          <TextInput style={styles.input} value={personaB.display_name} onChangeText={(v) => setPersonaB({ ...personaB, display_name: v })} />
          <Text style={styles.label}>Geburtsdatum Person B</Text>
          <TextInput style={styles.input} value={personaB.birth_date} onChangeText={(v) => setPersonaB({ ...personaB, birth_date: v })} placeholder="1993-08-12" placeholderTextColor={colors.textDim} />
          <Text style={styles.label}>Gender Person B</Text>
          <GenderPicker value={personaB.gender_identity} onChange={(v) => setPersonaB({ ...personaB, gender_identity: v })} />
          <Text style={styles.label}>Pronomen (optional)</Text>
          <TextInput style={styles.input} value={personaB.pronouns} onChangeText={(v) => setPersonaB({ ...personaB, pronouns: v })} />
          <Text style={styles.help}>Fotos & weitere Details kannst du nach der Registrierung im Profil-Editor ergänzen.</Text>
        </View>
      )}

      <View style={{ marginTop: spacing(4) }}>
        {[{ k: "terms", t: "AGB akzeptieren" }, { k: "privacy", t: "Datenschutz akzeptieren" }, { k: "sensitive_data", t: "Verarbeitung sensibler Daten" }].map((c) => (
          <TouchableOpacity key={c.k} onPress={() => setConsents({ ...consents, [c.k]: !consents[c.k] })} style={styles.consentRow}>
            <View style={[styles.checkbox, consents[c.k] && { backgroundColor: colors.accent, borderColor: colors.accent }]} />
            <Text style={styles.consent}>{c.t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {err && <Text style={styles.err}>{err}</Text>}
      <TouchableOpacity style={[styles.btn, (!canSubmit || busy) && { opacity: 0.5 }]} disabled={!canSubmit || busy} onPress={submit}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>Konto erstellen</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")} style={{ marginTop: spacing(3), alignItems: "center" }}>
        <Text style={{ color: colors.textMuted }}>Bereits registriert? Anmelden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function GenderPicker({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {GENDERS.map((g) => (
        <TouchableOpacity
          key={g}
          onPress={() => onChange(g)}
          style={{
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: value === g ? colors.accent : colors.border,
            backgroundColor: value === g ? colors.accentSoft : "transparent",
          }}
        >
          <Text style={{ color: value === g ? colors.accent : colors.textMuted, fontSize: 12 }}>{GENDER_LABELS[g]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing(6), paddingTop: Platform.OS === "ios" ? spacing(12) : spacing(8) },
  brand: { fontSize: 44, color: colors.text, textAlign: "center" },
  tag: { color: colors.textMuted, textAlign: "center", marginBottom: spacing(4) },
  sectionLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, marginTop: spacing(2) },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  typeBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  typeBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typeTxt: { color: colors.textMuted, fontWeight: "600" },
  typeTxtActive: { color: colors.accent },
  label: { color: colors.textMuted, marginTop: spacing(3), fontSize: 12 },
  input: { borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 12, borderRadius: radii.md, marginTop: 4 },
  personaB: { marginTop: spacing(4), padding: spacing(3), borderRadius: radii.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  personaBHeader: { color: colors.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 12, marginBottom: 4 },
  help: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  consentRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  consent: { color: colors.textMuted, fontSize: 13, flex: 1 },
  btn: { backgroundColor: colors.text, padding: 14, borderRadius: radii.pill, alignItems: "center", marginTop: spacing(5) },
  btnText: { color: colors.bg, fontWeight: "700" },
  err: { color: colors.danger, marginTop: 10, textAlign: "center" },
});
