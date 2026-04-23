import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";

const MENU = [
  { key: "Albums",   title: "Alben",       sub: "Private Fotosammlungen · Zugriff anfragen" },
  { key: "Events",   title: "Events",      sub: "Community-Veranstaltungen · RSVP" },
  { key: "Visitors", title: "Besucher:innen", sub: "Wer dein Profil besucht hat" },
  { key: "Blog",     title: "Blog",        sub: "News, Tipps & Stories von Eros" },
];

export default function MenuScreen({ navigation }) {
  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.h1}>Mehr</Text>
      <Text style={styles.sub}>Entdecke weitere Eros-Funktionen.</Text>
      <View style={{ marginTop: spacing(4), gap: 10 }}>
        {MENU.map((m) => (
          <TouchableOpacity key={m.key} style={styles.tile} onPress={() => navigation.navigate(m.key)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>{m.title}</Text>
              <Text style={styles.tileSub}>{m.sub}</Text>
            </View>
            <Text style={styles.chev}>{"›"}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 4 },
  tile: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing(4), borderWidth: 1, borderColor: colors.border },
  tileTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  tileSub: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  chev: { color: colors.textDim, fontSize: 26, fontWeight: "300" },
});
