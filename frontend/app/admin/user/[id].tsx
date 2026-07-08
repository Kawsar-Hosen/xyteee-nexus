/**
 * Admin – User Detail page.
 * Shows user info and lets the admin assign / remove verification badges.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge, BADGE_LABELS, BadgeType } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";

const BADGE_COLORS: Record<string, string> = {
  blue: "#1D9BF0",
  gold: "#C9A227",
  gray: "#829AAB",
};

const MODERATION_REASONS = [
  { code: "spam_abuse", label: "Spam or abusive activity" },
  { code: "harassment", label: "Harassment or harmful behavior" },
  { code: "community_violation", label: "Violation of Nexus community rules" },
] as const;

type ModerationAction = "suspend" | "ban";

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [u, setU] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealBusy, setAppealBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [userResult, appealResult] = await Promise.all([
        api<{ user: any }>(`/admin/users/${id}`, { token }),
        api<{ appeals: any[] }>(`/admin/users/${id}/appeals`, { token }),
      ]);
      setU(userResult.user);
      setAppeals(appealResult.appeals || []);
    } catch {
      Alert.alert("Error", "Could not load user.");
      router.back();
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const setBadge = async (badgeType: BadgeType | null) => {
    if (!token || !id) return;
    setBusy(true);
    try {
      await api(`/admin/users/${id}/badge`, {
        method: "PUT",
        body: { badge_type: badgeType },
        token,
      });
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update badge.");
    } finally {
      setBusy(false);
    }
  };

  const applyModeration = async () => {
    if (!token || !id || !moderationAction || !selectedReason) return;

    setModerationBusy(true);
    try {
      await api(`/admin/users/${id}/${moderationAction}`, {
        method: "PUT",
        body: { reason_code: selectedReason },
        token,
      });
      setModerationAction(null);
      setSelectedReason(null);
      await load();
      Alert.alert(
        "Success",
        moderationAction === "ban"
          ? "User has been banned."
          : "User has been suspended."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Moderation action failed.");
    } finally {
      setModerationBusy(false);
    }
  };

  const rejectAppeal = async (appealId: string) => {
    if (!token || !appealId || appealBusy) return;

    setAppealBusy(true);
    try {
      await api(`/admin/appeals/${appealId}/reject`, {
        method: "PUT",
        token,
      });
      await load();
      Alert.alert(
        "Appeal Rejected",
        "The appeal has been rejected. The user may submit another appeal if they still have an appeal remaining."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not reject appeal.");
    } finally {
      setAppealBusy(false);
    }
  };

  const restoreUser = async () => {
    if (!token || !id) return;

    setModerationBusy(true);
    try {
      await api(`/admin/users/${id}/restore`, {
        method: "PUT",
        token,
      });
      await load();
      Alert.alert("Success", "User account has been restored.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not restore account.");
    } finally {
      setModerationBusy(false);
    }
  };

  if (!u) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Back */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <NxText variant="title">User Detail</NxText>
        </View>

        {/* Profile card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar
            uri={u.profile_picture}
            name={u.display_name}
            size={64}
            online={u.online}
            onlineStatus={u.online_status || "online"}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="title" style={{ flexShrink: 1 }}>{u.display_name}</NxText>
              <VerifiedBadge badgeType={u.badge_type} size={16} />
            </View>
            <NxText variant="bodySm" style={{ color: colors.mutedFg }}>@{u.username}</NxText>
            <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>{u.email}</NxText>
          </View>
        </View>

        {/* User stats */}
        <View style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoCell label="User ID" value={u.user_id} />
          <InfoCell label="Joined" value={u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"} />
          <InfoCell label="Status" value={u.online ? "Online" : "Offline"} />
        </View>

        {/* Current badge */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <NxText variant="titleSm" style={{ marginBottom: spacing.sm }}>
            Current Badge
          </NxText>
          {u.badge_type ? (
            <View style={[styles.currentBadge, { backgroundColor: (BADGE_COLORS[u.badge_type] || colors.primary) + "22", borderColor: BADGE_COLORS[u.badge_type] || colors.primary }]}>
              <VerifiedBadge badgeType={u.badge_type} size={18} />
              <NxText style={{ marginLeft: 8, fontFamily: fonts.bodySemi, color: BADGE_COLORS[u.badge_type] || colors.primary, textTransform: "capitalize" }}>
                {u.badge_type}
              </NxText>
              {busy ? (
                <ActivityIndicator size="small" color={colors.mutedFg} style={{ marginLeft: "auto" }} />
              ) : (
                <TouchableOpacity
                  onPress={() => setBadge(null)}
                  style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center" }}
                  disabled={busy}
                >
                  <Feather name="x" size={14} color={colors.danger} />
                  <NxText style={{ color: colors.danger, fontSize: 12, marginLeft: 4 }}>Remove</NxText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <NxText variant="bodySm" style={{ color: colors.mutedFg, fontStyle: "italic" }}>
              No badge assigned.
            </NxText>
          )}
        </View>

        {/* Assign badge */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <NxText variant="titleSm" style={{ marginBottom: spacing.sm }}>
            Assign Badge
          </NxText>
          <View style={styles.badgeGrid}>
            {BADGE_LABELS.map(({ type, label }) => {
              const isActive = u.badge_type === type;
              const color = BADGE_COLORS[type] || colors.primary;
              return (
                <TouchableOpacity
                  key={type}
                  disabled={busy || isActive}
                  onPress={() => setBadge(type as BadgeType)}
                  style={[
                    styles.badgeOption,
                    {
                      backgroundColor: isActive ? color + "33" : colors.surface,
                      borderColor: isActive ? color : colors.border,
                    },
                  ]}
                >
                  <VerifiedBadge badgeType={type} size={18} />
                  <NxText
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      fontFamily: fonts.bodySemi,
                      color: isActive ? color : colors.foreground,
                      textAlign: "center",
                    }}
                  >
                    {label}
                  </NxText>
                  {isActive && (
                    <NxText style={{ fontSize: 10, color: color, marginTop: 2 }}>Active</NxText>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Account moderation */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <NxText variant="titleSm" style={{ marginBottom: spacing.sm }}>
            Account Moderation
          </NxText>

          <View style={[styles.moderationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.moderationStatusRow}>
              <View style={{ flex: 1 }}>
                <NxText variant="caption" style={{ color: colors.mutedFg }}>
                  Current Status
                </NxText>
                <NxText
                  variant="titleSm"
                  style={{
                    marginTop: 3,
                    textTransform: "capitalize",
                    color:
                      u.moderation_status === "banned" || u.moderation_status === "suspended"
                        ? colors.danger
                        : colors.foreground,
                  }}
                >
                  {u.moderation_status || "active"}
                </NxText>
              </View>

              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      u.moderation_status === "banned" || u.moderation_status === "suspended"
                        ? colors.danger
                        : colors.primary,
                  },
                ]}
              />
            </View>

            {u.moderation_reason ? (
              <View style={[styles.reasonBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <NxText variant="caption" style={{ color: colors.mutedFg }}>
                  Reason
                </NxText>
                <NxText variant="bodySm" style={{ marginTop: 4, color: colors.foreground }}>
                  {u.moderation_reason}
                </NxText>
              </View>
            ) : null}

            {u.moderation_status === "banned" || u.moderation_status === "suspended" ? (
              <TouchableOpacity
                disabled={moderationBusy}
                onPress={restoreUser}
                style={[styles.moderationButton, { backgroundColor: colors.primary }]}
              >
                {moderationBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="rotate-ccw" size={16} color="#FFFFFF" />
                    <NxText style={styles.moderationButtonText}>Restore Account</NxText>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.moderationActions}>
                <TouchableOpacity
                  disabled={moderationBusy}
                  onPress={() => {
                    setSelectedReason(null);
                    setModerationAction("suspend");
                  }}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Feather name="pause-circle" size={17} color={colors.foreground} />
                  <NxText style={{ marginLeft: 7, fontFamily: fonts.bodySemi }}>
                    Suspend
                  </NxText>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={moderationBusy}
                  onPress={() => {
                    setSelectedReason(null);
                    setModerationAction("ban");
                  }}
                  style={[styles.actionButton, { backgroundColor: colors.danger + "18", borderColor: colors.danger }]}
                >
                  <Feather name="slash" size={17} color={colors.danger} />
                  <NxText style={{ marginLeft: 7, fontFamily: fonts.bodySemi, color: colors.danger }}>
                    Ban
                  </NxText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* User appeals */}
        {appeals.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <NxText variant="titleSm" style={{ marginBottom: spacing.sm }}>
              Account Appeals
            </NxText>

            {appeals.map((appeal, index) => (
              <View
                key={appeal.appeal_id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <NxText variant="titleSm">
                      Appeal #{appeals.length - index}
                    </NxText>
                    <NxText
                      variant="caption"
                      style={{ color: colors.mutedFg, marginTop: 3 }}
                    >
                      {appeal.created_at
                        ? new Date(appeal.created_at).toLocaleString()
                        : "—"}
                    </NxText>
                  </View>

                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: radii.pill,
                      backgroundColor:
                        appeal.status === "pending"
                          ? colors.primary + "18"
                          : appeal.status === "approved"
                          ? colors.primary + "18"
                          : colors.danger + "18",
                    }}
                  >
                    <NxText
                      style={{
                        fontSize: 11,
                        fontFamily: fonts.bodySemi,
                        textTransform: "capitalize",
                        color:
                          appeal.status === "rejected"
                            ? colors.danger
                            : colors.primary,
                      }}
                    >
                      {appeal.status}
                    </NxText>
                  </View>
                </View>

                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: colors.border,
                    marginVertical: spacing.md,
                  }}
                />

                <NxText variant="caption" style={{ color: colors.mutedFg }}>
                  User Message
                </NxText>
                <NxText
                  variant="body"
                  style={{ marginTop: 6, lineHeight: 22 }}
                >
                  {appeal.message || "No message provided."}
                </NxText>

                {appeal.status === "pending" ? (
                  <TouchableOpacity
                    disabled={appealBusy}
                    onPress={() =>
                      Alert.alert(
                        "Reject Appeal?",
                        "The user will be allowed to submit another appeal only if they have an appeal remaining.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Reject Appeal",
                            style: "destructive",
                            onPress: () => rejectAppeal(appeal.appeal_id),
                          },
                        ]
                      )
                    }
                    style={{
                      height: 48,
                      borderRadius: radii.pill,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: spacing.lg,
                      backgroundColor: colors.danger + "18",
                      borderColor: colors.danger,
                      borderWidth: 1,
                    }}
                  >
                    {appealBusy ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <NxText
                        style={{
                          color: colors.danger,
                          fontFamily: fonts.bodySemi,
                        }}
                      >
                        Reject Appeal
                      </NxText>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <Modal
          visible={moderationAction !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!moderationBusy) {
              setModerationAction(null);
              setSelectedReason(null);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!moderationBusy) {
                  setModerationAction(null);
                  setSelectedReason(null);
                }
              }}
            />

            <View style={[styles.reasonModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <NxText variant="title">
                    {moderationAction === "ban" ? "Ban User" : "Suspend User"}
                  </NxText>
                  <NxText variant="bodySm" style={{ color: colors.mutedFg, marginTop: 4 }}>
                    Choose one reason for this action.
                  </NxText>
                </View>

                <TouchableOpacity
                  disabled={moderationBusy}
                  onPress={() => {
                    setModerationAction(null);
                    setSelectedReason(null);
                  }}
                >
                  <Feather name="x" size={22} color={colors.mutedFg} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: spacing.md }}>
                {MODERATION_REASONS.map((reason) => {
                  const selected = selectedReason === reason.code;

                  return (
                    <TouchableOpacity
                      key={reason.code}
                      disabled={moderationBusy}
                      onPress={() => setSelectedReason(reason.code)}
                      style={[
                        styles.reasonOption,
                        {
                          backgroundColor: selected ? colors.primary + "18" : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: selected ? colors.primary : colors.mutedFg },
                        ]}
                      >
                        {selected ? (
                          <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                        ) : null}
                      </View>

                      <NxText
                        variant="bodySm"
                        style={{
                          flex: 1,
                          marginLeft: 12,
                          color: selected ? colors.primary : colors.foreground,
                        }}
                      >
                        {reason.label}
                      </NxText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                disabled={!selectedReason || moderationBusy}
                onPress={applyModeration}
                style={[
                  styles.confirmModerationButton,
                  {
                    backgroundColor:
                      !selectedReason || moderationBusy
                        ? colors.border
                        : moderationAction === "ban"
                          ? colors.danger
                          : colors.primary,
                  },
                ]}
              >
                {moderationBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <NxText style={styles.moderationButtonText}>
                    Confirm {moderationAction === "ban" ? "Ban" : "Suspension"}
                  </NxText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <NxText variant="titleSm" style={{ fontSize: 12 }}>{value}</NxText>
      <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>{label}</NxText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeOption: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 80,
  },
  moderationCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  moderationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reasonBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  moderationActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  moderationButton: {
    minHeight: 46,
    marginTop: spacing.lg,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  moderationButtonText: {
    marginLeft: 7,
    color: "#FFFFFF",
    fontFamily: fonts.bodySemi,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  reasonModal: {
    padding: spacing.lg,
    paddingBottom: 32,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reasonOption: {
    minHeight: 58,
    marginBottom: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  confirmModerationButton: {
    minHeight: 48,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
