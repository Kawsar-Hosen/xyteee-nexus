import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";

export default function AccountsScreen() {
  const { colors } = useTheme();
  const { user, accounts, switchAccount, removeAccount, login } = useAuth();
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doAdd = async () => {
    setErr(""); setBusy(true);
    try {
      await login(email.trim(), password);
      setAddOpen(false);
      setEmail(""); setPassword("");
      router.replace("/(app)/feed");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally { setBusy(false); }
  };

  const doSwitch = async (uid: string) => {
    try {
      await switchAccount(uid);
      router.replace("/(app)/feed");
    } catch (e: any) {
      setErr(e.message || "Switch failed");
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity testID="accounts-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Accounts</NxText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <NxText variant="body" style={{ color: colors.mutedFg, marginBottom: spacing.lg }}>
          Stay signed in to multiple Nexus accounts. Tap one to switch instantly.
        </NxText>

        {accounts.map((a) => {
          const active = user?.user_id === a.user_id;
          return (
            <View
              key={a.user_id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border }]}
            >
              <Avatar uri={a.profile_picture} name={a.display_name} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <NxText variant="titleSm">{a.display_name}</NxText>
                  {active ? (
                    <View style={[styles.badge, { borderColor: colors.primary }]}>
                      <NxText variant="caption" style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>ACTIVE</NxText>
                    </View>
                  ) : null}
                </View>
                <NxText variant="bodySm">@{a.username}</NxText>
              </View>
              {!active ? (
                <TouchableOpacity testID={`switch-${a.username}`} onPress={() => doSwitch(a.user_id)} style={[styles.smallBtn, { backgroundColor: colors.primary }]}>
                  <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 12 }}>Use</NxText>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                testID={`remove-${a.username}`}
                onPress={() => removeAccount(a.user_id)}
                style={[styles.iconBtn2, { borderColor: colors.border }]}
              >
                <Feather name="x" size={14} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          testID="accounts-add"
          onPress={() => setAddOpen(true)}
          activeOpacity={0.85}
          style={[styles.addBtn, { borderColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color={colors.primary} />
          <NxText style={{ color: colors.primary, marginLeft: 8, fontFamily: fonts.bodySemi }}>Add another account</NxText>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
              <NxText variant="title">Sign in to another account</NxText>
              <TouchableOpacity onPress={() => setAddOpen(false)} testID="add-close">
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <NxText variant="bodySm" style={{ marginBottom: spacing.lg }}>
              Your current session stays saved. This one will become active.
            </NxText>
            <NxText variant="label">Email</NxText>
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="add-email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@nexus.io"
                placeholderTextColor={colors.mutedFg}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            <View style={{ height: spacing.md }} />
            <NxText variant="label">Password</NxText>
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="add-password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={colors.mutedFg}
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            {err ? <NxText variant="bodySm" style={{ color: colors.danger, marginTop: 10 }}>{err}</NxText> : null}
            <TouchableOpacity
              testID="add-submit"
              disabled={busy || !email || !password}
              onPress={doAdd}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1, marginTop: spacing.lg }]}
            >
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : (
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Sign in & switch</NxText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  iconBtn2: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, marginLeft: 8 },
  card: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, marginBottom: 10 },
  badge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, borderWidth: 1 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderStyle: "dashed", marginTop: spacing.md },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { padding: spacing.xl, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  field: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 14, marginTop: 6 },
  input: { height: 50, fontFamily: "Outfit", fontSize: 15 },
  primaryBtn: { height: 54, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
});
