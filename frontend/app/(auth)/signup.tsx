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

export default function SignUp() {
  const { colors } = useTheme();
  const { signup } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!email || !username || !displayName || password.length < 6) {
      setErr("All fields required. Password minimum 6 chars.");
      return;
    }
    setBusy(true);
    try {
      await signup(email.trim(), password, username.trim().toLowerCase(), displayName.trim());
      router.replace("/(app)/feed");
    } catch (e: any) {
      setErr(e.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="signup-back" onPress={() => router.back()} style={styles.back}>
            <Feather name="chevron-left" size={26} color={colors.foreground} />
          </TouchableOpacity>

          <View style={{ marginTop: spacing.lg }}>
            <NxText variant="display">Claim your Nexus.</NxText>
            <NxText variant="body" style={{ color: colors.mutedFg, marginTop: 8 }}>
              A quiet corner of the internet, built just for you.
            </NxText>
          </View>

          <View style={{ height: spacing.xl }} />

          <Field label="Display name" testID="signup-name-input" value={displayName} onChangeText={setDisplayName} placeholder="Aria K." />
          <Field label="Username" testID="signup-username-input" value={username} onChangeText={(t: string) => setUsername(t.replace(/\s/g, "").toLowerCase())} placeholder="aria" autoCapitalize="none" />
          <Field label="Email" testID="signup-email-input" value={email} onChangeText={setEmail} placeholder="you@nexus.io" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" testID="signup-password-input" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />

          {err ? (
            <View style={[styles.errBox, { borderColor: colors.danger }]}>
              <NxText variant="bodySm" style={{ color: colors.danger }}>{err}</NxText>
            </View>
          ) : null}

          <View style={{ height: spacing.xl }} />

          <TouchableOpacity
            testID="signup-submit-button"
            disabled={busy}
            onPress={submit}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>
              {busy ? "Creating…" : "Create account"}
            </NxText>
          </TouchableOpacity>

          <TouchableOpacity
            testID="signup-go-login"
            onPress={() => router.replace("/(auth)/login")}
            style={{ alignItems: "center", padding: spacing.lg }}
          >
            <NxText variant="body" style={{ color: colors.mutedFg }}>
              Have an account?{" "}
              <NxText style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Sign in</NxText>
            </NxText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, testID, ...rest }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <NxText variant="label">{label}</NxText>
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          testID={testID}
          placeholderTextColor={colors.mutedFg}
          style={[styles.input, { color: colors.foreground }]}
          {...rest}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: spacing.xl },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  field: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, marginTop: 6 },
  input: { height: 52, fontFamily: "Outfit", fontSize: 15 },
  primaryBtn: { height: 56, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  errBox: { padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 12 },
});
