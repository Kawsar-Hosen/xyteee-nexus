import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

export default function DeleteAccount() {
  const { colors } = useTheme();
  const { user, deleteAccount } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isEmailUser = user?.provider === "email";
  const canProceed = confirmText.trim().toLowerCase() === "delete";
  const canSubmit = canProceed && (!isEmailUser || password.length >= 6);

  const doDelete = async () => {
    setBusy(true); setErr("");
    try {
      await deleteAccount(isEmailUser ? password : undefined);
      setConfirmOpen(false);
      router.replace("/");
    } catch (e: any) {
      setErr(e.message || "Failed to delete");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity testID="delete-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Delete account</NxText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.warningCard, { borderColor: colors.danger, backgroundColor: colors.surface }]}>
          <Feather name="alert-triangle" size={22} color={colors.danger} />
          <NxText variant="titleSm" style={{ marginTop: 8, color: colors.danger }}>This cannot be undone</NxText>
          <NxText variant="bodySm" style={{ marginTop: 6, lineHeight: 20 }}>
            Deleting your account will permanently remove your profile, reveries, messages, bonds and notifications from XYTEEE Nexus. This action is irreversible.
          </NxText>
        </View>

        {isEmailUser ? (
          <View style={{ marginTop: spacing.lg }}>
            <NxText variant="label">Confirm your password</NxText>
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="delete-password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Your account password"
                placeholderTextColor={colors.mutedFg}
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.md }}>
          <NxText variant="label">Type DELETE to confirm</NxText>
          <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              testID="delete-confirm-text"
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="DELETE"
              placeholderTextColor={colors.mutedFg}
              autoCapitalize="characters"
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
        </View>

        {err ? <NxText variant="bodySm" style={{ color: colors.danger, marginTop: 12 }}>{err}</NxText> : null}

        <TouchableOpacity
          testID="delete-submit"
          disabled={!canSubmit || busy}
          onPress={() => setConfirmOpen(true)}
          style={[styles.dangerBtn, { backgroundColor: colors.danger, opacity: canSubmit && !busy ? 1 : 0.5 }]}
        >
          <NxText style={{ color: "#fff", fontFamily: fonts.bodySemi }}>Permanently delete my account</NxText>
        </TouchableOpacity>
      </ScrollView>

      <Modal transparent visible={confirmOpen} animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <NxText variant="title">Delete for real?</NxText>
            <NxText variant="body" style={{ marginTop: 8, color: colors.mutedFg }}>
              All your data will be wiped from XYTEEE Nexus. There is no recovery.
            </NxText>
            <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
              <TouchableOpacity testID="delete-cancel" onPress={() => setConfirmOpen(false)} style={[styles.secondaryBtn, { borderColor: colors.border, flex: 1 }]}>
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Cancel</NxText>
              </TouchableOpacity>
              <TouchableOpacity testID="delete-confirm-final" disabled={busy} onPress={doDelete} style={[styles.dangerBtn, { flex: 1, backgroundColor: colors.danger, marginTop: 0, opacity: busy ? 0.6 : 1 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <NxText style={{ color: "#fff", fontFamily: fonts.bodySemi }}>Delete</NxText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  warningCard: { padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1 },
  field: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 14, marginTop: 6 },
  input: { height: 50, fontFamily: "Outfit", fontSize: 15 },
  dangerBtn: { height: 54, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  secondaryBtn: { height: 54, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", padding: spacing.lg, justifyContent: "center" },
  modalCard: { padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1 },
});
