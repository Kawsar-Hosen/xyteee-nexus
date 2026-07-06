import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

export default function Settings() {
  const { colors, mode, toggle } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity testID="settings-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Settings</NxText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Section label="Profile">
          <Row icon="edit-2" label="Edit profile" onPress={() => router.push("/settings/edit-profile")} testID="settings-edit-profile" />
          <Row icon="lock" label="Change password" onPress={() => router.push("/settings/change-password")} testID="settings-change-password" />
        </Section>

        <Section label="Appearance">
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceHigh }]}>
              <Feather name={mode === "dark" ? "moon" : "sun"} size={16} color={colors.foreground} />
            </View>
            <NxText style={{ marginLeft: 12, fontFamily: fonts.bodyMedium, flex: 1 }}>Dark mode</NxText>
            <Switch testID="settings-theme-toggle" value={mode === "dark"} onValueChange={toggle} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
        </Section>

        <Section label="Privacy">
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceHigh }]}>
              <Feather name="eye-off" size={16} color={colors.foreground} />
            </View>
            <NxText style={{ marginLeft: 12, fontFamily: fonts.bodyMedium, flex: 1 }}>Private account</NxText>
            <Switch
              testID="settings-private-toggle"
              value={!!user?.is_private}
              onValueChange={(v) => updateUser({ is_private: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          <Row icon="shield" label="Blocked users" onPress={() => router.push("/settings/blocked")} testID="settings-blocked" />
        </Section>

        <Section label="Account">
          <Row icon="users" label="Accounts & switch" onPress={() => router.push("/settings/accounts")} testID="settings-accounts" />
          <Row icon="log-out" label="Sign out" tint={colors.danger} onPress={async () => { await logout(); router.replace("/"); }} testID="settings-signout" />
          <Row icon="trash-2" label="Delete account" tint={colors.danger} onPress={() => router.push("/settings/delete-account")} testID="settings-delete" />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: any) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <NxText variant="label" style={{ marginBottom: 6 }}>{label}</NxText>
      {children}
    </View>
  );
}

function Row({ icon, label, onPress, tint, testID }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceHigh }]}>
        <Feather name={icon} size={16} color={tint || colors.foreground} />
      </View>
      <NxText style={{ marginLeft: 12, fontFamily: fonts.bodyMedium, color: tint || colors.foreground, fontSize: 14, flex: 1 }}>{label}</NxText>
      <Feather name="chevron-right" size={18} color={colors.mutedFg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
