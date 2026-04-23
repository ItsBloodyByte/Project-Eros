import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../AuthContext";
import { colors, radii, spacing } from "../theme";

const CORE_MENU = [
  { key: "EditProfile", title: "Profil bearbeiten", sub: "Basisdaten, Fotos, Körper, Interessen" },
  { key: "Videos",      title: "Videos (Premium)",  sub: "Kurzvideos für dein Profil" },
  { key: "Settings",    title: "Einstellungen",     sub: "Privatsphäre, Stealth, Sichtbarkeit" },
];

const CONTENT_MENU = [
  { key: "Albums",      title: "Alben",             sub: "Private Fotosammlungen · Zugriff anfragen" },
  { key: "Visitors",    title: "Besucher:innen",    sub: "Wer dein Profil besucht hat" },
  { key: "Blog",        title: "Blog",              sub: "News, Tipps & Stories von Eros" },
];

export default function MenuScreen({ navigation }) {
  const { user } = useAuth();
  const isDuo = user?.account_type === "duo";

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>Mehr</Text>
      <Text style={styles.sub}>Dein Bereich & Eros-Features.</Text>

      <Text style={styles.section}>Dein Profil</Text>
      <View style={{ gap: 10 }}>
        {CORE_MENU.map((m) => (
          <Tile key={m.key} m={m} onPress={() => navigation.navigate(m.key)} />
        ))}
        {isDuo && (
          <Tile
            m={{ key: "PersonaB", title: "Person B pflegen", sub: "Zweite Person deines Paar-Accounts" }}
            onPress={() => navigation.navigate("PersonaB")}
          />
        )}
      </View>

      <Text style={styles.section}>Entdecken</Text>
      <View style={{ gap: 10 }}>
        {CONTENT_MENU.map((m) => (
          <Tile key={m.key} m={m} onPress={() => navigation.navigate(m.key)} />
        ))}
      </View>
    </ScrollView>
  );
}

function Tile({ m, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{m.title}</Text>
        <Text style={styles.tileSub}>{m.sub}</Text>
      </View>
      <Text style={styles.chev}>{"›"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 4 },
  section: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: spacing(5), marginBottom: spacing(2) },
  tile: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing(4), borderWidth: 1, borderColor: colors.border },
  tileTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  tileSub: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  chev: { color: colors.textDim, fontSize: 26, fontWeight: "300" },
});
