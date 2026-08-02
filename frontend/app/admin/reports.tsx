/**
 * Admin Panel — user reports queue.
 * Lists reported conversations with reporter + reported user, and lets the
 * admin resolve or dismiss each one. From here you can jump into the
 * reported user's detail page for suspend/ban.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
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
import { fonts, radii, spacing } from "@/src/theme";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#C9A227", bg: "rgba(201,162,39,0.15)" },
  actioned: { label: "Resolved", color: "#23A55A", bg: "rgba(35,165,90,0.15)" },
  dismissed: { label: "Dismissed", color: "#829AAB", bg: "rgba(130,154,171,0.15)" },
};

export default function AdminReports() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [filter, setFilter] = useState<"all" | "pending" | "actioned" | "dismissed">("all");
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await api<{ reports: any[] }>("/admin/reports", {
        token,
        query: filter === "all" ? {} : { status: filter },
      });
      setReports(r.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (reportId: string, status: "actioned" | "dismissed") => {
    if (!token) return;
    setUpdatingId(reportId);
    try {
      await api(`/admin/reports/${reportId}`, { method: "PUT", token, body: { status } });
      await load();
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={reports}
        keyExtractor={(r) => r.report_id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
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
                  <Feather name="flag" size={12} color={colors.onPrimary} />
                  <NxText style={styles.heroBadgeText}>ADMIN</NxText>
                </View>
              </View>
              <View style={styles.heroIcon}>
                <Feather name="flag" size={26} color={colors.primaryDeep} />
              </View>
              <NxText variant="title" style={[styles.heroTitle, { color: colors.onPrimary }]}>
                Reports
              </NxText>
              <NxText style={[styles.heroSub, { color: colors.onPrimary }]}>
                Community reports queue
              </NxText>
            </LinearGradient>

            <View style={styles.filters}>
              {(["all", "pending", "actioned", "dismissed"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  activeOpacity={0.8}
                  onPress={() => setFilter(f)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filter === f ? colors.primary : colors.surface,
                      borderColor: filter === f ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <NxText
                    style={{
                      fontSize: 12.5,
                      fontFamily: filter === f ? fonts.bodySemi : fonts.body,
                      color: filter === f ? "#fff" : colors.mutedFg,
                    }}
                  >
                    {f === "all" ? `All (${reports.length})` : f === "pending" ? `Pending (${pendingCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
                  </NxText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] || STATUS_META.pending;
          const cat = item.category || "other";
          const reported = item.reported || {};
          const reporter = item.reporter || {};
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                      <NxText style={[styles.statusText, { color: meta.color }]}>{meta.label}</NxText>
                    </View>
                    <NxText variant="caption" style={{ color: colors.mutedFg }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                    </NxText>
                  </View>
                  <NxText style={[styles.catText, { color: colors.foreground }]}>
                    <Feather name="flag" size={12} color={colors.mutedFg} /> {cat}
                  </NxText>
                  {item.description ? (
                    <NxText variant="bodySm" style={{ color: colors.mutedFg, marginTop: 6 }} numberOfLines={3}>
                      "{item.description}"
                    </NxText>
                  ) : null}
                </View>
              </View>

              <View style={styles.people}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push(`/admin/user/${item.reported_id}`)}
                  style={[styles.personCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={styles.personRow}>
                    <Avatar uri={reported.profile_picture} name={reported.display_name} size={34} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <NxText variant="titleSm" style={{ fontSize: 13 }} numberOfLines={1}>
                        {reported.display_name || "Unknown"}
                      </NxText>
                      <NxText variant="caption" style={{ color: colors.mutedFg }}>
                        @{reported.username || "?"} · reported
                      </NxText>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedFg} />
                  </View>
                </TouchableOpacity>

                <View style={styles.repBy}>
                  <Avatar uri={reporter.profile_picture} name={reporter.display_name} size={22} />
                  <NxText variant="caption" style={{ color: colors.mutedFg, marginLeft: 8, flex: 1 }} numberOfLines={1}>
                    Reported by @{reporter.username || "?"}
                  </NxText>
                </View>
              </View>

              {item.status === "pending" ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/admin/user/${item.reported_id}`)}
                    style={[styles.actionBtn, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "55" }]}
                  >
                    <Feather name="shield" size={14} color={colors.primary} />
                    <NxText style={[styles.actionText, { color: colors.primary }]}>Review user</NxText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setStatus(item.report_id, "dismissed")}
                    disabled={updatingId === item.report_id}
                    style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {updatingId === item.report_id ? (
                      <ActivityIndicator size="small" color={colors.mutedFg} />
                    ) : (
                      <>
                        <Feather name="x" size={14} color={colors.mutedFg} />
                        <NxText style={[styles.actionText, { color: colors.mutedFg }]}>Dismiss</NxText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setStatus(item.report_id, "actioned")}
                    disabled={updatingId === item.report_id}
                    style={[styles.actionBtn, { backgroundColor: "#23A55A1A", borderColor: "#23A55A55" }]}
                  >
                    {updatingId === item.report_id ? (
                      <ActivityIndicator size="small" color="#23A55A" />
                    ) : (
                      <>
                        <Feather name="check" size={14} color="#23A55A" />
                        <NxText style={[styles.actionText, { color: "#23A55A" }]}>Resolved</NxText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.resolvedBy}>
                  <NxText variant="caption" style={{ color: colors.mutedFg }}>
                    {meta.label.toLowerCase()} {item.resolved_at ? `· ${new Date(item.resolved_at).toLocaleString()}` : ""}
                  </NxText>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Feather name="inbox" size={28} color={colors.mutedFg} style={{ marginBottom: 8, opacity: 0.6 }} />
              <NxText variant="body" style={{ color: colors.mutedFg }}>
                No reports here.
              </NxText>
            </View>
          )
        }
      />
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
  filters: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  filterChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
  },
  catText: {
    fontSize: 15,
    fontFamily: fonts.bodySemi,
  },
  people: {
    marginTop: 12,
    gap: 8,
  },
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  repBy: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12.5,
    fontFamily: fonts.bodySemi,
  },
  resolvedBy: {
    marginTop: 12,
  },
});
