import React, { useEffect, useState } from "react";
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
} from "react-native";
import { api } from "../api";
import { colors, radii, spacing } from "../theme";

export default function ProfileScreen({ route, navigation }) {
  const { id } = route.params;
  const [p, setP] = useState(null);

  useEffect(() => {
    api.post(`/seen/${id}`).catch(() => {});
    api.get(`/users/${id}`).then((r) => setP(r.data)).catch(() => {});
  }, [id]);

  if (!p) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const like = async () => {
    try {
      const { data } = await api.post("/likes", { target_user_id: id });
      if (data.matched) navigation.navigate("Chat", { matchId: data.match_id });
    } catch (e) {}
  };
  const superLike = async () => {
    try {
      const { data } = await api.post("/likes/super", { target_user_id: id });
      if (data.matched) navigation.navigate("Chat", { matchId: data.match_id });
    } catch (e) {}
  };

  const duoPartner = !p.partner && p.account_type === "duo" ? p.persona_b : null;
  const bigName = p.partner
    ? `${p.display_name} & ${p.partner.display_name}`
    : duoPartner ? `${p.display_name} & ${duoPartner.display_name}`
    : p.display_name;
  const ages = p.partner
    ? `${p.age} / ${p.partner.age}`
    : duoPartner ? `${p.age} / ${duoPartner.age || ""}`
    : `${p.age}`;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing(4) }}>
      {(p.photos || []).map((ph, idx) => (
        <Image
          key={ph.id || idx}
          source={{ uri: ph.data }}
          style={styles.hero}
          blurRadius={ph.nsfw_score >= 0.75 ? 24 : 0}
        />
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={styles.name}>{bigName}</Text>
        {(p.partner || duoPartner) && <Badge>PAAR</Badge>}
        {p.id_verified && <Badge success>ID VERIFIZIERT</Badge>}
      </View>
      <Text style={styles.ages}>{ages}{p.city ? ` · ${p.city}` : ""}{typeof p.distance_km === "number" ? ` · ~${p.distance_km} km` : ""}</Text>
      {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}

      <PersonDetails person={p} title={(p.partner || duoPartner) ? p.display_name : null} />
      {p.partner && <PersonDetails person={p.partner} title={p.partner.display_name} />}
      {!p.partner && duoPartner && <PersonDetails person={duoPartner} title={duoPartner.display_name || "Person B"} />}

      <View style={{ flexDirection: "row", gap: 10, marginTop: spacing(5) }}>
        {p.match_id ? (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => navigation.navigate("Chat", { matchId: p.match_id })}>
            <Text style={styles.btnPrimaryText}>Chat öffnen</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={like}>
            <Text style={styles.btnPrimaryText}>Like</Text>
          </TouchableOpacity>
        )}
        {p.is_premium_viewer && !p.match_id && !p.i_liked && (
          <TouchableOpacity style={[styles.btn, styles.btnAccent]} onPress={superLike}>
            <Text style={{ color: colors.accent, fontWeight: "700" }}>Super-Like</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function Badge({ children, success }) {
  return (
    <View style={{
      backgroundColor: success ? "rgba(42, 127, 120, 0.2)" : colors.accentSoft,
      borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2,
      borderWidth: 1, borderColor: success ? colors.success : colors.accent,
    }}>
      <Text style={{ color: success ? colors.success : colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>{children}</Text>
    </View>
  );
}

/**
 * PersonDetails — always renders Körper & Life-Style + Kinks (with "Keine Angaben" fallback)
 * plus relationship/roles/interests when present. Matches web parity.
 */
function PersonDetails({ person, title }) {
  if (!person) return null;
  const hasBody = person.height_cm || person.body_type || person.ethnicity ||
    person.smoking || person.drinking || person.diet || person.sti_status ||
    person.cup_size || person.penis_length_cm || (person.languages || []).length;
  const Pair = ({ k, v }) => {
    if (!v && v !== 0) return null;
    if (Array.isArray(v)) { if (!v.length) return null; v = v.join(" · "); }
    return (
      <View style={{ width: "48%", marginTop: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{k}</Text>
        <Text style={{ color: colors.text, fontSize: 13 }}>{String(v)}</Text>
      </View>
    );
  };
  return (
    <View style={{ marginTop: spacing(5), padding: spacing(4), borderRadius: radii.md, backgroundColor: colors.card }}>
      {title && (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{title}</Text>
          {person.age ? <Text style={{ color: colors.textMuted }}>{person.age}</Text> : null}
          {person.pronouns ? <Text style={{ color: colors.textDim, fontSize: 11 }}>· {person.pronouns}</Text> : null}
        </View>
      )}
      {person.bio ? <Text style={{ color: colors.text, marginTop: 6 }}>{person.bio}</Text> : null}

      <Text style={styles.sec}>Körper & Life-Style</Text>
      {hasBody ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12 }}>
          <Pair k="Größe" v={person.height_cm ? `${person.height_cm} cm` : null} />
          <Pair k="Körpertyp" v={person.body_type} />
          <Pair k="Ethnie" v={person.ethnicity} />
          <Pair k="Rauchen" v={person.smoking} />
          <Pair k="Alkohol" v={person.drinking} />
          <Pair k="Ernährung" v={person.diet} />
          <Pair k="STI" v={person.sti_status} />
          <Pair k="Getestet" v={person.sti_tested_on} />
          <Pair k="Körbchen" v={person.cup_size} />
          <Pair k="Penis" v={person.penis_category} />
          <Pair k="Sprachen" v={person.languages} />
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>Keine Angaben</Text>
      )}

      <Text style={styles.sec}>Kinks</Text>
      {(person.kinks || []).length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {(person.kinks || []).map((k) => (
            <View key={k} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: colors.text, fontSize: 11 }}>{k}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>Keine Angaben</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", aspectRatio: 3 / 4, borderRadius: radii.lg, marginBottom: spacing(3) },
  name: { color: colors.text, fontSize: 24, fontWeight: "700" },
  ages: { color: colors.textMuted, marginTop: 2 },
  bio: { color: "#e5dfd1", marginTop: 10 },
  sec: { color: colors.textMuted, marginTop: 14, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  btn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: radii.pill, alignItems: "center", flex: 1 },
  btnPrimary: { backgroundColor: colors.text },
  btnPrimaryText: { color: colors.bg, fontWeight: "700" },
  btnAccent: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
});
