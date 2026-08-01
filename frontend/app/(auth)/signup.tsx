import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [usernameShake] = useState(() => new Animated.Value(0));
  const [emailShake] = useState(() => new Animated.Value(0));

  const shakeField = (value: Animated.Value) => {
    value.setValue(0);
    Animated.sequence([
      Animated.timing(value, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(value, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(value, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.timing(value, { toValue: 5, duration: 55, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const submit = async () => {
    setErr("");
    setUsernameError("");
    setEmailError("");

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanDisplayName) {
      setErr("Display name is required.");
      return;
    }

    if (!/^[A-Za-z ]+$/.test(cleanDisplayName)) {
      setErr("Display name can only contain English letters and spaces.");
      return;
    }

    if (!cleanUsername) {
      setErr("Username is required.");
      return;
    }

    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      setErr("Username can only contain lowercase letters, numbers, dots, and underscores.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErr("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await signup(cleanEmail, password, cleanUsername, cleanDisplayName);
      router.replace("/(auth)/setup-profile");
    } catch (e: any) {
      const message = String(e?.message || "");

      if (/username.*(already|taken)|already.*username/i.test(message)) {
        setUsernameError("This username is already taken.");
        shakeField(usernameShake);
      } else if (/email.*(already|registered|exists)|already.*email/i.test(message)) {
        setEmailError("An account with this email already exists.");
        shakeField(emailShake);
      } else {
        setErr(message || "Signup failed");
      }
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
          <Field
            label="Username"
            testID="signup-username-input"
            value={username}
            onChangeText={(t: string) => {
              setUsername(t.replace(/\s/g, "").toLowerCase());
              if (usernameError) setUsernameError("");
            }}
            placeholder="aria"
            autoCapitalize="none"
            error={usernameError}
            shakeValue={usernameShake}
          />

          <Field
            label="Email"
            testID="signup-email-input"
            value={email}
            onChangeText={(t: string) => {
              setEmail(t);
              if (emailError) setEmailError("");
            }}
            placeholder="you@nexus.io"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
            shakeValue={emailShake}
          />
          <Field
            label="Password"
            testID="signup-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword((current) => !current)}
          />

          <Field
            label="Confirm Password"
            testID="signup-confirm-password-input"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Enter your password again"
            secureTextEntry={!showConfirmPassword}
            rightIcon={showConfirmPassword ? "eye-off" : "eye"}
            onRightIconPress={() =>
              setShowConfirmPassword((current) => !current)
            }
          />

          {confirmPassword ? (
            <NxText
              variant="bodySm"
              style={{
                marginTop: -4,
                marginBottom: spacing.md,
                color:
                  password === confirmPassword
                    ? colors.success
                    : colors.danger,
                fontFamily: fonts.bodyMedium,
              }}
            >
              {password === confirmPassword
                ? "Passwords match"
                : "Passwords do not match"}
            </NxText>
          ) : null}

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

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  testID,
  rightIcon,
  onRightIconPress,
  error,
  shakeValue,
  ...rest
}: any) {
  const { colors } = useTheme();

  const fieldContent = (
    <View
      style={[
        styles.field,
        {
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : colors.border,
        },
      ]}
    >
      <TextInput
        testID={testID}
        placeholderTextColor={colors.mutedFg}
        style={[styles.input, { color: colors.foreground }]}
        {...rest}
      />

      {rightIcon ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onRightIconPress}
          style={styles.fieldIcon}
        >
          <Feather
            name={rightIcon}
            size={19}
            color={colors.mutedFg}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={{ marginBottom: spacing.md }}>
      <NxText variant="label">{label}</NxText>

      {shakeValue ? (
        <Animated.View
          style={{
            transform: [{ translateX: shakeValue }],
          }}
        >
          {fieldContent}
        </Animated.View>
      ) : (
        fieldContent
      )}

      {error ? (
        <NxText
          variant="bodySm"
          style={{
            color: colors.danger,
            marginTop: 6,
            fontFamily: fonts.bodyMedium,
          }}
        >
          {error}
        </NxText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: spacing.xl },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  field: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 52,
    fontFamily: "Outfit",
    fontSize: 15,
  },
  fieldIcon: {
    width: 40,
    height: 52,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  primaryBtn: { height: 56, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  errBox: { padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 12 },
});
