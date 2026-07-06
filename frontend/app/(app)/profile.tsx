import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

const ADMIN_EMAIL = "smdkawsar2@gmail.com";

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: DOCK_PAD }}>
        <View style={styles.coverWrap}>
          {user.cover_picture ? (
            <Image source={{ uri: user.cover_picture }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={StyleSheet.absoluteFillObject} />
          )}
          <View style={styles.headerRow}>
            <TouchableOpacity testID="profile-theme-toggle" onPress={toggle} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
              <Feather name={mode === "dark" ? "sun" : "moon"} size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity testID="profile-settings" onPress={() => router.push("/settings")} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
              <Feather name="settings" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          <View style={{ marginTop: -50 }}>
            <Avatar uri={user.profile_picture} name={user.display_name} size={100} online />
          </View>
          <View style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <NxText variant="title" style={{ flexShrink: 1 }}>{user.display_name}</NxText>
                <VerifiedBadge badgeType={user.badge_type} size={18} />
              </View>
              <NxText variant="bodySm">@{user.username}</NxText>
            </View>
            <TouchableOpacity
              testID="profile-edit"
              onPress={() => router.push("/settings/edit-profile")}
              style={[styles.editBtn, { borderColor: colors.primary }]}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <NxText style={{ color: colors.primary, marginLeft: 6, fontFamily: fonts.bodySemi, fontSize: 13 }}>Edit</NxText>
            </TouchableOpacity>
          </View>

          {user.bio ? (
            <NxText variant="body" style={{ marginTop: spacing.md, color: colors.foreground, lineHeight: 22 }}>
              {user.bio}
            </NxText>
          ) : (
            <NxText variant="bodySm" style={{ marginTop: spacing.md, fontStyle: "italic" }}>
              No bio yet. Tap Edit to add one.
            </NxText>
          )}

          <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Stat label="Bonds" value={"—"} />
            <Divider />
            <Stat label="Reveries" value={"—"} />
            <Divider />
            <Stat label="Since" value={user.email_verified ? "Verified" : "New"} />
          </View>

          <View style={{ height: spacing.lg }} />

          <QuickLink icon="bell" label="Notifications" onPress={() => router.push("/notifications")} testID="profile-notifications" />
          <QuickLink icon="users" label="My Bonds" onPress={() => router.push("/(app)/friends")} testID="profile-friends" />
          <QuickLink icon="shield" label="Blocked" onPress={() => router.push("/settings/blocked")} testID="profile-blocked" />
          {user.email === ADMIN_EMAIL && (
            <QuickLink icon="lock" label="Admin Panel" tint={colors.primary} onPress={() => router.push("/admin")} testID="profile-admin" />
          )}
          <QuickLink icon="log-out" label="Sign out" tint={colors.danger} onPress={async () => { await logout(); router.replace("/"); }} testID="profile-logout" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <NxText variant="titleSm">{value}</NxText>
      <NxText variant="caption" style={{ marginTop: 2 }}>{label}</NxText>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ width: 1, height: 24, backgroundColor: colors.border }} />;
}

function QuickLink({ icon, label, onPress, testID, tint }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8} style={[styles.link, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.linkIcon, { backgroundColor: colors.surfaceHigh }]}>
        <Feather name={icon} size={16} color={tint || colors.foreground} />
      </View>
      <NxText style={{ marginLeft: 14, fontFamily: fonts.bodyMedium, color: tint || colors.foreground, fontSize: 14 }}>{label}</NxText>
      <View style={{ flex: 1 }} />
      <Feather name="chevron-right" size={18} color={colors.mutedFg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  coverWrap: { height: 200, position: "relative" },
  headerRow: { position: "absolute", top: spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: spacing.lg },
  editBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1 },
  statsRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg },
  link: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm },
  linkIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
