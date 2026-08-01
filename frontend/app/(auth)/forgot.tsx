import React, { useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { api } from "@/src/api/client";
import { fonts, radii, spacing } from "@/src/theme";

export default function Forgot() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [pwd, setPwd] = useState("");
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const request = async () => {
    setBusy(true);
    setErr("");
    try {
      await api<{ ok: boolean }>("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setStage("reset");
      setMsg(
        "We sent a 6-digit reset code to your email. The code expires in 15 minutes."
      );
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, new_password: pwd } });
      setMsg("Password reset. You can sign in now.");
      setTimeout(() => router.replace("/(auth)/login"), 900);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <TouchableOpacity testID="forgot-back" onPress={() => router.back()} style={styles.back}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>

        <NxText variant="display" style={{ marginTop: spacing.lg }}>Reset access</NxText>
        <NxText variant="body" style={{ color: colors.mutedFg, marginTop: 8 }}>
          {stage === "request" ? "Enter your Nexus email." : "Enter your reset code and pick a new password."}
        </NxText>

        <View style={{ height: spacing.xl }} />

        {stage === "request" ? (
          <>
            <NxText variant="label">Email</NxText>
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="forgot-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@nexus.io"
                placeholderTextColor={colors.mutedFg}
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            <View style={{ height: spacing.xl }} />
            <TouchableOpacity
              testID="forgot-request-button"
              onPress={request}
              disabled={busy || !email}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
            >
              <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Send reset code</NxText>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <NxText variant="label">Reset code</NxText>
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="forgot-token-input"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                placeholderTextColor={colors.mutedFg}
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            <View style={{ height: spacing.md }} />
            <NxText variant="label">New password</NxText>
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="forgot-new-password-input"
                value={pwd}
                onChangeText={setPwd}
                secureTextEntry
                placeholder="At least 6 characters"
                placeholderTextColor={colors.mutedFg}
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            <View style={{ height: spacing.xl }} />
            <TouchableOpacity
              testID="forgot-reset-button"
              onPress={reset}
              disabled={busy || pwd.length < 6 || !token}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
            >
              <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Reset password</NxText>
            </TouchableOpacity>
          </>
        )}

        {msg ? <NxText variant="bodySm" style={{ marginTop: 16, color: colors.success }}>{msg}</NxText> : null}
        {err ? <NxText variant="bodySm" style={{ marginTop: 16, color: colors.danger }}>{err}</NxText> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: spacing.xl },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  field: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, marginTop: 6 },
  input: { height: 52, fontFamily: "Outfit", fontSize: 15 },
  primaryBtn: { height: 56, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
});
