import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
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
import { DOCK_PAD } from "@/src/theme/layout";

export default function Search() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (query: string) => {
    if (!query.trim() || !token) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const r = await api<{ users: any[] }>("/users/search", { token, query: { q: query.trim() } });
      setResults(r.users || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const h = setTimeout(() => run(q), 250);
    return () => clearTimeout(h);
  }, [q, run]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <NxText variant="displaySm">Find your circle.</NxText>
        <NxText variant="bodySm" style={{ marginTop: 4 }}>
          Search by username or display name.
        </NxText>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedFg} />
          <TextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search Nexus…"
            placeholderTextColor={colors.mutedFg}
            style={{ flex: 1, marginLeft: 10, color: colors.foreground, fontFamily: "Outfit", fontSize: 15 }}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {q ? (
            <TouchableOpacity testID="search-clear" onPress={() => setQ("")}>
              <Feather name="x" size={16} color={colors.mutedFg} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(u) => u.user_id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: DOCK_PAD }}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`search-result-${item.username}`}
            activeOpacity={0.8}
            onPress={() => router.push(`/user/${item.user_id}`)}
            style={styles.row}
          >
            <Avatar uri={item.profile_picture} name={item.display_name} size={44} online={item.online} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <NxText variant="titleSm" style={{ flexShrink: 1 }}>{item.display_name}</NxText>
                <VerifiedBadge badgeType={item.badge_type} size={13} />
              </View>
              <NxText variant="bodySm">@{item.username}</NxText>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedFg} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <NxText variant="body" style={{ color: colors.mutedFg }}>
                {q ? "No one found." : "Start typing to discover people."}
              </NxText>
            </View>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 16,
    marginTop: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 12 },
  empty: { padding: spacing.xxl, alignItems: "center" },
  loading: { position: "absolute", top: 180, alignSelf: "center" },
});
