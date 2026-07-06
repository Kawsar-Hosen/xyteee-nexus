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

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [u, setU] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const r = await api<{ user: any }>(`/admin/users/${id}`, { token });
      setU(r.user);
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
          <Avatar uri={u.profile_picture} name={u.display_name} size={64} online={u.online} />
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
});
