import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { NexusMark } from "@/src/components/NexusMark";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

const BG = "https://images.pexels.com/photos/13568041/pexels-photo-13568041.jpeg";

export default function Welcome() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFillObject} blurRadius={12} />
      <LinearGradient
        colors={["rgba(7,7,9,0.55)", "rgba(7,7,9,0.88)", colors.background]}
        style={StyleSheet.absoluteFillObject}
        locations={[0, 0.5, 1]}
      />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <View style={styles.header}>
            <NexusMark size={72} />
            <NxText variant="display" style={{ marginTop: spacing.lg, letterSpacing: 6 }}>
              XYTEEE
            </NxText>
            <NxText variant="label" style={{ color: colors.primary, marginTop: 2 }}>
              NEXUS
            </NxText>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.pitch}>
            <NxText variant="displaySm" style={{ textAlign: "center", lineHeight: 34 }}>
              Where quiet conversations{"\n"}become close bonds.
            </NxText>
            <NxText variant="body" style={{ textAlign: "center", marginTop: spacing.md, color: colors.mutedFg }}>
              A serene, real-time space for the people who matter most.
            </NxText>
          </View>

          <View style={{ height: spacing.xl }} />

          <TouchableOpacity
            testID="welcome-email-signup"
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/signup")}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>
              Create your Nexus account
            </NxText>
          </TouchableOpacity>

          <TouchableOpacity
            testID="welcome-email-login"
            activeOpacity={0.7}
            onPress={() => router.push("/(auth)/login")}
            style={styles.ghostBtn}
          >
            <NxText variant="body" style={{ color: colors.foreground }}>
              Already inside? <NxText style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Sign in</NxText>
            </NxText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  header: { alignItems: "flex-start" },
  pitch: { alignItems: "center", paddingHorizontal: spacing.md },
  primaryBtn: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  ghostBtn: { alignItems: "center", padding: spacing.md },
});
