import React, { useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

export default function ChangePassword() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [old, setOld] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await api("/auth/change-password", { method: "POST", body: { old_password: old, new_password: pwd }, token: token! });
      setMsg("Password changed.");
      setTimeout(() => router.back(), 700);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="chp-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Change password</NxText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <NxText variant="label">Current password</NxText>
        <TextInput testID="chp-old" value={old} onChangeText={setOld} secureTextEntry style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} placeholderTextColor={colors.mutedFg} />
        <View style={{ height: spacing.md }} />
        <NxText variant="label">New password</NxText>
        <TextInput testID="chp-new" value={pwd} onChangeText={setPwd} secureTextEntry placeholder="At least 6 characters" placeholderTextColor={colors.mutedFg} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />

        {err ? <NxText variant="bodySm" style={{ color: colors.danger, marginTop: 12 }}>{err}</NxText> : null}
        {msg ? <NxText variant="bodySm" style={{ color: colors.success, marginTop: 12 }}>{msg}</NxText> : null}

        <TouchableOpacity testID="chp-submit" disabled={busy || !old || pwd.length < 6} onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}>
          <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Update password</NxText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: radii.md, padding: 14, fontFamily: "Outfit", fontSize: 15, marginTop: 6 },
  btn: { height: 54, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
});
