import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

export default function Nexus() {
  const { colors } = useTheme();
  const router = useRouter();

  const actions = [
    { key: "story", label: "Add a Reverie", desc: "Post a 24-hour photo story", icon: "aperture", coming: false, onPress: () => router.push("/story/create") },
    { key: "post", label: "Create a Post", desc: "Long-form posts for your circle", icon: "feather", coming: true, onPress: () => {} },
    { key: "chat", label: "New Bond", desc: "Find a friend to talk to", icon: "message-circle", coming: false, onPress: () => router.push("/(app)/search") },
    { key: "friend", label: "Invite Someone", desc: "Discover people to connect", icon: "user-plus", coming: false, onPress: () => router.push("/(app)/friends") },
  ] as const;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingBottom: DOCK_PAD }}>
        <NxText variant="displaySm">Create.</NxText>
        <NxText variant="body" style={{ color: colors.mutedFg, marginTop: 6 }}>
          Small acts, deep resonance.
        </NxText>

        <View style={{ height: spacing.xl }} />

        {actions.map((a) => (
          <TouchableOpacity
            key={a.key}
            testID={`nexus-${a.key}`}
            activeOpacity={a.coming ? 1 : 0.85}
            onPress={a.onPress}
            disabled={a.coming}
            style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: a.coming ? 0.75 : 1 }]}
          >
            <View style={[styles.tileIcon, { backgroundColor: a.coming ? colors.surfaceHigh : colors.primary }]}>
              <Feather name={a.icon as any} size={22} color={a.coming ? colors.primary : colors.onPrimary} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                <NxText variant="titleSm">{a.label}</NxText>
                {a.coming ? (
                  <View style={[styles.chip, { borderColor: colors.primary }]}>
                    <NxText variant="caption" style={{ color: colors.primary, fontFamily: fonts.bodySemi, letterSpacing: 1 }}>
                      COMING SOON
                    </NxText>
                  </View>
                ) : null}
              </View>
              <NxText variant="bodySm">{a.desc}</NxText>
            </View>
            {!a.coming ? <Feather name="chevron-right" size={20} color={colors.mutedFg} /> : null}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  tileIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  chip: { marginLeft: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, borderWidth: 1 },
});
