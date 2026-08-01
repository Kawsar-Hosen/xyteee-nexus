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
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { api } from "@/src/api/client";
import { fonts, radii, spacing } from "@/src/theme";

export default function AppealPage() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    user_id?: string;
    name?: string;
    email?: string;
    reason?: string;
    pending?: string;
  }>();

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(params.pending === "true");
  const [submitError, setSubmitError] = useState("");

  const submitAppeal = async () => {
    if (!params.user_id || !message.trim() || busy) return;

    setBusy(true);
    setSubmitError("");

    try {
      await api("/auth/appeal", {
        method: "POST",
        body: {
          user_id: params.user_id,
          message: message.trim(),
        },
      });
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e?.message || "Could not submit your appeal. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={styles.successPage}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: colors.primary + "18" },
            ]}
          >
            <Feather name="check-circle" size={38} color={colors.primary} />
          </View>

          <NxText
            variant="display"
            style={{ textAlign: "center", marginTop: spacing.lg }}
          >
            Appeal Submitted
          </NxText>

          <NxText
            variant="body"
            style={{
              color: colors.mutedFg,
              textAlign: "center",
              marginTop: 12,
              lineHeight: 23,
            }}
          >
            Thank you. We’ve received your appeal and your account will be reviewed by our team.
          </NxText>

          <View
            style={[
              styles.reviewCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Feather name="clock" size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <NxText variant="titleSm">Review time: 24–72 hours</NxText>
              <NxText
                variant="bodySm"
                style={{ color: colors.mutedFg, marginTop: 5, lineHeight: 20 }}
              >
                Please avoid submitting repeated appeals while your review is pending. If the suspension was applied by mistake, access may be restored after review.
              </NxText>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
          >
            <NxText
              style={{
                color: colors.onPrimary,
                fontFamily: fonts.bodySemi,
              }}
            >
              Back to Sign In
            </NxText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Feather name="chevron-left" size={26} color={colors.foreground} />
          </TouchableOpacity>

          <NxText variant="display" style={{ marginTop: spacing.lg }}>
            Submit an Appeal
          </NxText>

          <NxText
            variant="body"
            style={{ color: colors.mutedFg, marginTop: 8, lineHeight: 22 }}
          >
            Tell us why you believe this suspension was made by mistake.
          </NxText>

          <View style={{ height: spacing.xxl }} />

          <NxText variant="label">Name</NxText>
          <View
            style={[
              styles.field,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <NxText variant="body">{params.name || "—"}</NxText>
          </View>

          <View style={{ height: spacing.md }} />

          <NxText variant="label">Email</NxText>
          <View
            style={[
              styles.field,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <NxText variant="body">{params.email || "—"}</NxText>
          </View>

          <View style={{ height: spacing.md }} />

          <NxText variant="label">Appeal Message</NxText>
          <View
            style={[
              styles.messageField,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              placeholder="Explain why you believe this suspension should be reviewed..."
              placeholderTextColor={colors.mutedFg}
              textAlignVertical="top"
              style={[styles.messageInput, { color: colors.foreground }]}
            />
          </View>

          <NxText
            variant="caption"
            style={{
              color: colors.mutedFg,
              textAlign: "right",
              marginTop: 6,
            }}
          >
            {message.length}/1000
          </NxText>

          {submitError ? (
            <NxText
              variant="bodySm"
              style={{
                color: colors.danger,
                marginTop: spacing.md,
                textAlign: "center",
              }}
            >
              {submitError}
            </NxText>
          ) : null}

          <TouchableOpacity
            onPress={submitAppeal}
            disabled={!message.trim() || busy}
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: message.trim() && !busy ? 1 : 0.45,
              },
            ]}
          >
            <NxText
              style={{
                color: colors.onPrimary,
                fontFamily: fonts.bodySemi,
              }}
            >
              {busy ? "Submitting…" : "Submit Appeal"}
            </NxText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  successPage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  reviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  wrap: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  field: {
    minHeight: 56,
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  messageField: {
    minHeight: 180,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
  },
  messageInput: {
    minHeight: 145,
    fontFamily: "Outfit",
    fontSize: 15,
    lineHeight: 22,
  },
  submitButton: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
});
