/**
 * Admin Panel — user management dashboard.
 * Only reachable by admin email (enforced by _layout.tsx + backend).
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";

const BADGE_COLORS: Record<string, string> = {
  blue: "#1D9BF0",
  gold: "#C9A227",
  gray: "#829AAB",
};

export default function AdminPanel() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const loadUsers = useCallback(async (query = "") => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await api<{ users: any[]; total: number }>("/admin/users", {
        token,
        query: query ? { q: query } : {},
      });
      setUsers(r.users || []);
      setTotal(r.total || 0);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const h = setTimeout(() => loadUsers(q), 300);
    return () => clearTimeout(h);
  }, [q, loadUsers]);

  const onlineCount = users.filter((u) => u.online).length;
  const verifiedCount = users.filter((u) => u.badge_type).length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const newToday = users.filter(
    (u) => u.created_at && new Date(u.created_at) >= todayStart
  ).length;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.user_id}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Hero banner */}
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
                  <Feather name="shield" size={12} color={colors.onPrimary} />
                  <NxText style={styles.heroBadgeText}>ADMIN</NxText>
                </View>
              </View>

              <View style={styles.heroIcon}>
                <Feather name="shield" size={26} color={colors.primaryDeep} />
              </View>
              <NxText variant="title" style={[styles.heroTitle, { color: colors.onPrimary }]}>
                Admin Panel
              </NxText>
              <NxText style={[styles.heroSub, { color: colors.onPrimary }]}>
                User management dashboard
              </NxText>
            </LinearGradient>

            {/* Stats grid */}
            <View style={styles.statsWrap}>
              <StatCard
                icon="users"
                label="Total users"
                value={String(total)}
                tint={colors.primary}
              />
              <StatCard
                icon="activity"
                label="Online now"
                value={String(onlineCount)}
                tint="#7DC48A"
              />
              <StatCard
                icon="award"
                label="Verified"
                value={String(verifiedCount)}
                tint="#C9A227"
              />
              <StatCard
                icon="user-plus"
                label="New today"
                value={String(newToday)}
                tint="#a78bfa"
              />
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="search" size={15} color={colors.mutedFg} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search users…"
                  placeholderTextColor={colors.mutedFg}
                  style={{ flex: 1, marginLeft: 10, color: colors.foreground, fontFamily: "Outfit", fontSize: 14 }}
                  autoCapitalize="none"
                />
                {q ? (
                  <TouchableOpacity onPress={() => setQ("")}>
                    <Feather name="x" size={15} color={colors.mutedFg} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {loading ? <ActivityIndicator color={colors.primary} style={{ marginLeft: 10 }} /> : null}
            </View>

            {/* Quick tools */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/admin/reports")}
              style={[styles.reportsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.reportsIcon, { backgroundColor: "#E5484D1e" }]}>
                <Feather name="flag" size={16} color="#E5484D" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <NxText variant="titleSm">Reports</NxText>
                <NxText variant="caption" style={{ color: colors.mutedFg }}>
                  Review community reports & moderate users
                </NxText>
              </View>
              <View style={styles.rowChevron}>
                <Feather name="chevron-right" size={18} color={colors.mutedFg} />
              </View>
            </TouchableOpacity>

            <View style={styles.sectionHead}>
              <NxText variant="titleSm">All Users</NxText>
              <NxText variant="caption" style={{ color: colors.mutedFg }}>
                {total} registered
              </NxText>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const badgeColor = BADGE_COLORS[item.badge_type];
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/admin/user/${item.user_id}`)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.avatarWrap}>
                <Avatar
                  uri={item.profile_picture}
                  name={item.display_name}
                  size={46}
                  online={item.online}
                />
              </View>

              {badgeColor ? <View style={[styles.badgeStrip, { backgroundColor: badgeColor }]} /> : null}

              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <NxText variant="titleSm" style={{ flexShrink: 1, fontSize: 15 }} numberOfLines={1}>
                    {item.display_name}
                  </NxText>
                  {item.badge_type ? <VerifiedBadge badgeType={item.badge_type} badgeIcon={item.badge_icon} badgeExpiresAt={item.badge_expires_at} size={14} /> : null}
                  {item.online ? (
                    <View style={styles.onlineTag}>
                      <View style={styles.onlineDot} />
                      <NxText style={styles.onlineTagText}>online</NxText>
                    </View>
                  ) : null}
                </View>
                <NxText variant="bodySm" style={{ color: colors.mutedFg }} numberOfLines={1}>
                  @{item.username}
                </NxText>
                <NxText variant="caption" style={{ color: colors.mutedFg }} numberOfLines={1}>
                  {item.email}
                  {item.created_at
                    ? ` · ${new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : ""}
                </NxText>
              </View>

              <View style={styles.rowChevron}>
                <Feather name="chevron-right" size={18} color={colors.mutedFg} />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Feather name="search" size={28} color={colors.mutedFg} style={{ marginBottom: 8, opacity: 0.6 }} />
              <NxText variant="body" style={{ color: colors.mutedFg }}>
                No users found.
              </NxText>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: string;
  label: string;
  value: string;
  tint: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: tint + "1e" }]}>
        <Feather name={icon as any} size={15} color={tint} />
      </View>
      <NxText style={[styles.statValue, { color: colors.foreground }]}>{value}</NxText>
      <NxText style={[styles.statLabel, { color: colors.mutedFg }]} numberOfLines={1}>
        {label}
      </NxText>
    </View>
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
  statsWrap: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    marginTop: 6,
    fontFamily: fonts.bodySemi,
    fontSize: 17,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    paddingHorizontal: 14,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: 10,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  avatarWrap: {
    padding: 2,
    borderRadius: 26,
    backgroundColor: "transparent",
  },
  badgeStrip: {
    width: 3,
    alignSelf: "stretch",
    marginLeft: 4,
    borderRadius: 2,
  },
  onlineTag: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(35,165,90,0.15)",
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#23A55A",
    marginRight: 4,
  },
  onlineTagText: {
    fontSize: 10,
    color: "#23A55A",
    fontFamily: fonts.bodySemi,
  },
  rowChevron: {
    marginLeft: 8,
  },
  reportsCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  reportsIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
