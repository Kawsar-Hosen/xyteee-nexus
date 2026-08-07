import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";

export default function Settings() {
  const { colors, mode, toggle } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.glass, borderBottomColor: colors.border }]}>
        <TouchableOpacity testID="settings-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Settings</NxText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.mobileWrapper}>
        {/* ── Profile summary card ── */}
        <TouchableOpacity
          testID="settings-profile-summary"
          activeOpacity={0.85}
          onPress={() => router.push("/settings/edit-profile")}
          style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Avatar uri={user?.profile_picture} name={user?.display_name} size={62} frame={user?.profile_frame} achievement={user?.achievement_level} animation={user?.profile_animation} animationSpeed={user?.profile_animation_speed} animationIntensity={user?.profile_animation_intensity} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="titleSm" numberOfLines={1} style={{ flexShrink: 1 }}>
                {user?.display_name || "Nexus User"}
              </NxText>
              <VerifiedBadge badgeType={user?.badge_type} badgeIcon={user?.badge_icon} badgeExpiresAt={user?.badge_expires_at} size={15} />
            </View>
            <NxText variant="bodySm" numberOfLines={1} style={{ color: colors.mutedFg, marginTop: 2 }}>
              @{user?.username || "username"}
            </NxText>
          </View>
          <View style={[styles.editChip, { backgroundColor: colors.primary }]}>
            <Feather name="edit-2" size={13} color={colors.onPrimary} />
            <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 12, marginLeft: 5 }}>
              Edit
            </NxText>
          </View>
        </TouchableOpacity>

        {/* ── Profile section ── */}
        <Section label="Profile">
          <Card colors={colors}>
            <Row icon="edit-2" tint={colors.primary} label="Edit profile" onPress={() => router.push("/settings/edit-profile")} testID="settings-edit-profile" colors={colors} />
            <Row icon="lock" tint="#F0B232" label="Change password" onPress={() => router.push("/settings/change-password")} testID="settings-change-password" colors={colors} last />
          </Card>
        </Section>

        {/* ── Appearance section ── */}
        <Section label="Appearance">
          <Card colors={colors}>
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={[styles.rowIcon, { backgroundColor: colors.primary }]}>
                <Feather name={mode === "dark" ? "moon" : "sun"} size={16} color="#fff" />
              </View>
              <NxText style={{ marginLeft: 12, fontFamily: fonts.bodyMedium, flex: 1 }}>Dark mode</NxText>
              <Switch testID="settings-theme-toggle" value={mode === "dark"} onValueChange={toggle} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.background} />
            </View>
          </Card>
        </Section>

        {/* ── Privacy section ── */}
        <Section label="Privacy">
          <Card colors={colors}>
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={[styles.rowIcon, { backgroundColor: "#23A55A" }]}>
                <Feather name="eye-off" size={16} color="#fff" />
              </View>
              <NxText style={{ marginLeft: 12, fontFamily: fonts.bodyMedium, flex: 1 }}>Private account</NxText>
              <Switch
                testID="settings-private-toggle"
                value={!!user?.is_private}
                onValueChange={(v) => updateUser({ is_private: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.background}
              />
            </View>
            <Row icon="shield" tint="#7DC48A" label="Blocked users" onPress={() => router.push("/settings/blocked")} testID="settings-blocked" colors={colors} />
            <Row icon="file-text" tint={colors.primary} label="Privacy & Policy" onPress={() => router.push("/settings/privacy-policy")} testID="settings-privacy-policy" colors={colors} last />
          </Card>
        </Section>

        {/* ── Account section ── */}
        <Section label="Account">
          <Card colors={colors}>
            <Row icon="users" tint="#a78bfa" label="Accounts & switch" onPress={() => router.push("/settings/accounts")} testID="settings-accounts" colors={colors} />
            <Row icon="trash-2" tint={colors.danger} label="Delete account" onPress={() => router.push("/settings/delete-account")} testID="settings-delete" colors={colors} />
            <Row icon="log-out" tint={colors.danger} label="Sign out" onPress={async () => { await logout(); router.replace("/"); }} testID="settings-signout" colors={colors} last />
          </Card>
        </Section>

        <View style={{ alignItems: "center", marginTop: spacing.xl }}>
          <NxText style={{ color: colors.mutedFg, fontSize: 11, letterSpacing: 0.5 }}>
            XYTEEE NEXUS · v1.0.0
          </NxText>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <NxText variant="label" style={{ color: colors.mutedFg }}>{label}</NxText>
      </View>
      {children}
    </View>
  );
}

function Card({ children, colors }: any) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function Row({ icon, label, onPress, tint, testID, colors, last }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint || colors.primary }]}>
        <Feather name={icon} size={16} color="#fff" />
      </View>
      <NxText style={{ marginLeft: 12, fontFamily: fonts.bodyMedium, color: tint && tint === colors.danger ? tint : colors.foreground, fontSize: 14, flex: 1 }}>
        {label}
      </NxText>
      <Feather name="chevron-right" size={18} color={colors.mutedFg} style={{ opacity: 0.6 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mobileWrapper: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === "web"
      ? { backdropFilter: "blur(20px)" as any, WebkitBackdropFilter: "blur(20px)" as any }
      : {}),
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    overflow: "hidden",
  },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
