/**
 * Admin Panel — user management dashboard.
 * Only reachable by smdkawsar2@gmail.com (enforced by _layout.tsx + backend).
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

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";

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

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <NxText variant="title">Admin Panel</NxText>
            <NxText variant="caption" style={{ color: colors.mutedFg }}>
              {total} registered users
            </NxText>
          </View>
          <View style={[styles.adminBadge, { backgroundColor: colors.primary + "22", borderColor: colors.primary }]}>
            <Feather name="shield" size={12} color={colors.primary} />
            <NxText style={{ color: colors.primary, fontSize: 11, marginLeft: 4, fontFamily: fonts.bodySemi }}>
              ADMIN
            </NxText>
          </View>
        </View>

        {/* Search */}
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
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/admin/user/${item.user_id}`)}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Avatar uri={item.profile_picture} name={item.display_name} size={44} online={item.online} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <NxText variant="titleSm" style={{ flexShrink: 1 }}>{item.display_name}</NxText>
                  <VerifiedBadge badgeType={item.badge_type} size={14} />
                </View>
                <NxText variant="bodySm" style={{ color: colors.mutedFg }}>@{item.username} · {item.email}</NxText>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedFg} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <NxText variant="body" style={{ color: colors.mutedFg }}>No users found.</NxText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
