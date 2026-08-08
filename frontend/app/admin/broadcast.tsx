/**
 * Admin Broadcast — send a "new feature" announcement to all users.
 * Backend creates an in-app notification for every account and pushes to all
 * registered device tokens (kind = feature_update).
 */
import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

export default function AdminBroadcast() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !busy;

  const send = async () => {
    if (!canSend || !token) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await api<{ push_sent: number; tokens: number; users: number }>(
        "/admin/broadcast",
        {
          method: "POST",
          token,
          body: { title: title.trim(), message: message.trim() },
        }
      );
      setResult(
        `Sent push to ${r.push_sent}/${r.tokens} device(s) + in-app notification for ${r.users} user(s).`
      );
      setTitle("");
      setMessage("");
    } catch (e: any) {
      Alert.alert("Broadcast failed", e?.message || e?.detail || "Please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={[colors.primaryDeep, colors.primary, `${colors.primary}88`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.heroBack}>
                <Feather name="chevron-left" size={22} color={colors.onPrimary} />
              </TouchableOpacity>
              <View style={[styles.heroBadge, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
                <Feather name="zap" size={12} color={colors.onPrimary} />
                <NxText style={styles.heroBadgeText}>ADMIN</NxText>
              </View>
            </View>
            <View style={styles.heroIcon}>
              <Feather name="zap" size={26} color={colors.primaryDeep} />
            </View>
            <NxText variant="title" style={[styles.heroTitle, { color: colors.onPrimary }]}>
              Broadcast
            </NxText>
            <NxText style={[styles.heroSub, { color: colors.onPrimary }]}>
              Announce a new feature to every user
            </NxText>
          </LinearGradient>

          <View style={styles.formCard}>
            <View style={styles.fieldHead}>
              <Feather name="type" size={15} color={colors.primary} />
              <NxText variant="titleSm">Title</NxText>
            </View>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. GIF & Stickers in chat"
              placeholderTextColor={colors.mutedFg}
              maxLength={120}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
            />

            <View style={[styles.fieldHead, { marginTop: spacing.md }]}>
              <Feather name="edit-2" size={15} color={colors.primary} />
              <NxText variant="titleSm">Message</NxText>
            </View>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Describe what's new…"
              placeholderTextColor={colors.mutedFg}
              multiline
              maxLength={500}
              style={[
                styles.input,
                styles.inputMultiline,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
            />

            <TouchableOpacity
              testID="admin-broadcast-send"
              disabled={!canSend}
              onPress={send}
              activeOpacity={0.82}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary, opacity: canSend ? 1 : 0.5 },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <Feather name="send" size={16} color={colors.onPrimary} />
                  <NxText style={[styles.sendLabel, { color: colors.onPrimary }]}>
                    Send to all users
                  </NxText>
                </>
              )}
            </TouchableOpacity>

            {result ? (
              <View style={[styles.resultBox, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                <Feather name="check-circle" size={16} color="#2E9B67" />
                <NxText variant="bodySm" style={{ flex: 1, marginLeft: 8 }}>
                  {result}
                </NxText>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.6,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginTop: spacing.lg,
  },
  heroTitle: {
    marginTop: spacing.md,
    fontSize: 26,
  },
  heroSub: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 13,
    opacity: 0.9,
  },
  formCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  fieldHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  sendBtn: {
    height: 50,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.lg,
  },
  sendLabel: {
    fontSize: 15,
    fontFamily: fonts.bodySemi,
  },
  resultBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    marginTop: spacing.md,
  },
});
