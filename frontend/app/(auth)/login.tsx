import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

export default function Login() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [moderationInfo, setModerationInfo] = useState<any>(null);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/(app)/feed");
    } catch (e: any) {
      const detail = e?.data?.detail;

      if (
        detail?.code === "ACCOUNT_SUSPENDED" ||
        detail?.code === "ACCOUNT_BANNED"
      ) {
        setModerationInfo(detail);
        setErr("");
      } else {
        setErr(e.message || "Sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  };

  if (moderationInfo) {
    const isSuspended = moderationInfo.code === "ACCOUNT_SUSPENDED";

    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView
          contentContainerStyle={styles.moderationPage}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.moderationIcon,
              {
                backgroundColor: isSuspended
                  ? colors.primary + "18"
                  : colors.danger + "18",
              },
            ]}
          >
            <Feather
              name={isSuspended ? "pause-circle" : "slash"}
              size={34}
              color={isSuspended ? colors.primary : colors.danger}
            />
          </View>

          <NxText variant="display" style={{ textAlign: "center", marginTop: spacing.lg }}>
            {isSuspended ? "Account Suspended" : "Account Permanently Disabled"}
          </NxText>

          <NxText
            variant="body"
            style={{
              color: colors.mutedFg,
              textAlign: "center",
              marginTop: 10,
              lineHeight: 22,
            }}
          >
            {isSuspended
              ? "Your access to XYTEEE Nexus has been temporarily restricted."
              : "Your access to XYTEEE Nexus has been permanently disabled."}
          </NxText>

          <View
            style={[
              styles.moderationInfoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <NxText variant="caption" style={{ color: colors.mutedFg }}>
              Reason
            </NxText>
            <NxText variant="body" style={{ marginTop: 6, lineHeight: 22 }}>
              {moderationInfo.reason || "Account policy enforcement"}
            </NxText>

            <View style={[styles.moderationDivider, { backgroundColor: colors.border }]} />

            <NxText variant="caption" style={{ color: colors.mutedFg }}>
              User ID
            </NxText>
            <NxText
              variant="bodySm"
              style={{ marginTop: 6, fontFamily: fonts.bodySemi }}
            >
              {moderationInfo.user_id || "—"}
            </NxText>
          </View>

          {isSuspended && moderationInfo.appeal_status === "pending" ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(auth)/appeal" as any,
                  params: {
                    user_id: moderationInfo.user_id || "",
                    name: moderationInfo.name || "",
                    email: moderationInfo.email || "",
                    reason: moderationInfo.reason || "",
                    pending: "true",
                  },
                })
              }
              style={[styles.appealButton, { backgroundColor: colors.primary }]}
            >
              <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>
                View Appeal Status
              </NxText>
            </TouchableOpacity>
          ) : isSuspended ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(auth)/appeal" as any,
                  params: {
                    user_id: moderationInfo.user_id || "",
                    name: moderationInfo.name || "",
                    email: moderationInfo.email || "",
                    reason: moderationInfo.reason || "",
                  },
                })
              }
              style={[styles.appealButton, { backgroundColor: colors.primary }]}
            >
              <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>
                Appeal this decision
              </NxText>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => {
              setModerationInfo(null);
              setPassword("");
            }}
            style={{ marginTop: spacing.lg, padding: spacing.md }}
          >
            <NxText
              variant="bodySm"
              style={{ color: colors.mutedFg, textAlign: "center" }}
            >
              Back to sign in
            </NxText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="login-back" onPress={() => router.back()} style={styles.back}>
            <Feather name="chevron-left" size={26} color={colors.foreground} />
          </TouchableOpacity>

          <View style={{ marginTop: spacing.xl }}>
            <NxText variant="display">Welcome back.</NxText>
            <NxText variant="body" style={{ color: colors.mutedFg, marginTop: 8 }}>
              Your Nexus is right where you left it.
            </NxText>
          </View>

          <View style={{ height: spacing.xxl }} />

          <NxText variant="label">Email</NxText>
          <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@nexus.io"
              placeholderTextColor={colors.mutedFg}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>

          <View style={{ height: spacing.md }} />
          <NxText variant="label">Password</NxText>
          <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedFg}
              style={[styles.input, { color: colors.foreground, flex: 1 }]}
            />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)} testID="login-toggle-password">
              <Feather name={showPwd ? "eye-off" : "eye"} size={18} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="login-forgot"
            onPress={() => router.push("/(auth)/forgot")}
            style={{ alignSelf: "flex-end", marginTop: 10 }}
          >
            <NxText variant="bodySm" style={{ color: colors.primary }}>Forgot password?</NxText>
          </TouchableOpacity>

          {err ? (
            <View style={[styles.errBox, { borderColor: colors.danger }]}>
              <NxText variant="bodySm" style={{ color: colors.danger }}>{err}</NxText>
            </View>
          ) : null}

          <View style={{ height: spacing.xl }} />

          <TouchableOpacity
            testID="login-submit-button"
            disabled={busy || !email || !password}
            onPress={submit}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>
              {busy ? "Signing in…" : "Sign in"}
            </NxText>
          </TouchableOpacity>

          <TouchableOpacity
            testID="login-go-signup"
            onPress={() => router.replace("/(auth)/signup")}
            style={{ alignItems: "center", padding: spacing.lg }}
          >
            <NxText variant="body" style={{ color: colors.mutedFg }}>
              New here? <NxText style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Create account</NxText>
            </NxText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  moderationPage: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  moderationIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  moderationInfoCard: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  moderationDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.lg,
  },
  appealButton: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  wrap: { flexGrow: 1, paddingHorizontal: spacing.xl },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  input: { flex: 1, height: 52, fontFamily: "Outfit", fontSize: 15 },
  primaryBtn: { height: 56, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  errBox: { padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 12 },
});
