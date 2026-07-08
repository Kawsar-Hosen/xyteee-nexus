import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
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
import { DOCK_PAD } from "@/src/theme/layout";

let searchCache: {
  recentAccounts: any[];
  discoverMoreAccounts: any[];
} | null = null;

export default function Search() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [recentAccounts, setRecentAccounts] = useState<any[]>(
    () => searchCache?.recentAccounts || []
  );
  const [discoverMoreAccounts, setDiscoverMoreAccounts] = useState<any[]>(
    () => searchCache?.discoverMoreAccounts || []
  );
  const [loading, setLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(() => searchCache === null);

  const run = useCallback(
    async (query: string) => {
      if (!query.trim() || !token) {
        setResults([]);
        return;
      }

      setLoading(true);

      try {
        const r = await api<{ users: any[] }>("/users/search", {
          token,
          query: { q: query.trim() },
        });

        setResults(r.users || []);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const loadRecentAccounts = useCallback(async () => {
    if (!token) return;

    if (searchCache === null) setRecentLoading(true);

    try {
      const r = await api<{ users: any[] }>("/users/recent", { token });

      const uniqueAccounts = Array.from(
        new Map(
          (r.users || []).map((account: any) => [
            account.user_id,
            account,
          ])
        ).values()
      );

      setRecentAccounts(uniqueAccounts);
      searchCache = {
        recentAccounts: uniqueAccounts,
        discoverMoreAccounts: searchCache?.discoverMoreAccounts || [],
      };
    } finally {
      setRecentLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const h = setTimeout(() => run(q), 250);
    return () => clearTimeout(h);
  }, [q, run]);

  const loadDiscoverMoreAccounts = useCallback(async () => {
    if (!token) return;

    try {
      const r = await api<{ users: any[] }>("/users/discover-more", { token });

      const uniqueAccounts = Array.from(
        new Map(
          (r.users || []).map((account: any) => [
            account.user_id,
            account,
          ])
        ).values()
      );

      setDiscoverMoreAccounts(uniqueAccounts);
      searchCache = {
        recentAccounts: searchCache?.recentAccounts || [],
        discoverMoreAccounts: uniqueAccounts,
      };
    } catch (error) {
      console.log("Discover More load failed:", error);
      setDiscoverMoreAccounts([]);
    }
  }, [token]);

  useEffect(() => {
    loadRecentAccounts();
    loadDiscoverMoreAccounts();
  }, [loadRecentAccounts, loadDiscoverMoreAccounts]);

  const openUser = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  const sendBondRequest = async (userId: string) => {
    if (!token) return;

    try {
      await api("/friends/request", {
        method: "POST",
        token,
        body: { user_id: userId },
      });

      setRecentAccounts((current) =>
        current.filter((account) => account.user_id !== userId)
      );
      setDiscoverMoreAccounts((current) =>
        current.filter((account) => account.user_id !== userId)
      );
    } catch (error) {
      console.log("Bond request failed:", error);
    }
  };

  const renderUserRow = (item: any) => (
    <TouchableOpacity
      key={item.user_id}
      activeOpacity={0.8}
      onPress={() => openUser(item.user_id)}
      style={styles.row}
    >
      <Avatar
        uri={item.profile_picture}
        name={item.display_name}
        size={52}
        online={item.online}
        onlineStatus={item.online_status || "online"}
      />

      <View style={styles.rowInfo}>
        <View style={styles.nameLine}>
          <NxText variant="titleSm" style={styles.rowName}>
            {item.display_name}
          </NxText>

          <VerifiedBadge badgeType={item.badge_type} size={14} />
        </View>

        <NxText
          variant="bodySm"
          style={{ color: colors.mutedFg, marginTop: 2 }}
        >
          @{item.username}
        </NxText>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={(e) => {
          e.stopPropagation();
          sendBondRequest(item.user_id);
        }}
        style={[
          styles.smallBondButton,
          { backgroundColor: colors.primary },
        ]}
      >
        <Feather name="user-plus" size={19} color={colors.onPrimary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        }}
      >
        <NxText variant="displaySm">Find your circle.</NxText>

        <NxText variant="bodySm" style={{ marginTop: 4 }}>
          Search by username or display name.
        </NxText>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="search" size={20} color={colors.mutedFg} />

          <TextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search Nexus…"
            placeholderTextColor={colors.mutedFg}
            style={{
              flex: 1,
              marginLeft: 12,
              color: colors.foreground,
              fontFamily: "Outfit",
              fontSize: 16,
            }}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {q ? (
            <TouchableOpacity
              testID="search-clear"
              onPress={() => setQ("")}
            >
              <Feather name="x" size={18} color={colors.mutedFg} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {q.trim() ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{
            paddingTop: 14,
            paddingBottom: DOCK_PAD,
          }}
          renderItem={({ item }) => renderUserRow(item)}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <NxText
                  variant="body"
                  style={{ color: colors.mutedFg }}
                >
                  No one found.
                </NxText>
              </View>
            ) : null
          }
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: DOCK_PAD,
          }}
        >
          {recentLoading ? (
            <View style={styles.recentLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : recentAccounts.length > 0 ? (
            <>
              <View style={styles.suggestionHeader}>
                <View
                  style={[
                    styles.peopleIcon,
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <Feather
                    name="users"
                    size={21}
                    color={colors.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <NxText variant="title">
                    People You May Connect
                  </NxText>

                  <NxText
                    variant="bodySm"
                    style={{
                      color: colors.mutedFg,
                      marginTop: 2,
                    }}
                  >
                    Discover new people in the Nexus community
                  </NxText>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsContainer}
              >
                {recentAccounts.map((item) => (
                  <TouchableOpacity
                    key={item.user_id}
                    activeOpacity={0.85}
                    onPress={() => openUser(item.user_id)}
                    style={[
                      styles.personCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Avatar
                      uri={item.profile_picture}
                      name={item.display_name}
                      size={72}
                      online={item.online}
                      onlineStatus={item.online_status || "online"}
                    />

                    <View style={styles.cardNameLine}>
                      <NxText
                        variant="titleSm"
                        numberOfLines={1}
                        style={styles.cardName}
                      >
                        {item.display_name}
                      </NxText>

                      <VerifiedBadge
                        badgeType={item.badge_type}
                        size={13}
                      />
                    </View>

                    <NxText
                      variant="bodySm"
                      numberOfLines={1}
                      style={{
                        color: colors.mutedFg,
                        marginTop: 3,
                      }}
                    >
                      @{item.username}
                    </NxText>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={(e) => {
                        e.stopPropagation();
                        sendBondRequest(item.user_id);
                      }}
                      style={[
                        styles.bondButton,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Feather
                        name="user-plus"
                        size={17}
                        color={colors.onPrimary}
                      />

                      <NxText
                        style={{
                          color: colors.onPrimary,
                          fontFamily: fonts.bodySemi,
                          marginLeft: 7,
                        }}
                      >
                        Bond
                      </NxText>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {discoverMoreAccounts.length > 0 ? (
                <>
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: colors.border },
                    ]}
                  />

                  <NxText
                    variant="bodySm"
                    style={[
                      styles.moreTitle,
                      { color: colors.mutedFg },
                    ]}
                  >
                    Discover More
                  </NxText>

                  <View>
                    {discoverMoreAccounts.map((item) => renderUserRow(item))}
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <View style={styles.empty}>
              <NxText
                variant="body"
                style={{ color: colors.mutedFg }}
              >
                New connections will appear here.
              </NxText>
            </View>
          )}
        </ScrollView>
      )}

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
    height: 58,
    paddingHorizontal: 18,
    marginTop: spacing.lg,
  },

  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: 28,
    marginBottom: 18,
  },

  peopleIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  cardsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
    gap: 12,
  },

  personCard: {
    width: 160,
    minHeight: 220,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },

  cardNameLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    maxWidth: "100%",
  },

  cardName: {
    flexShrink: 1,
    marginRight: 4,
  },

  bondButton: {
    minWidth: 108,
    height: 42,
    borderRadius: 21,
    marginTop: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
    marginTop: 26,
    marginBottom: 18,
  },

  moreTitle: {
    paddingHorizontal: spacing.lg,
    marginBottom: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },

  rowInfo: {
    flex: 1,
    marginLeft: 14,
  },

  nameLine: {
    flexDirection: "row",
    alignItems: "center",
  },

  rowName: {
    flexShrink: 1,
    marginRight: 4,
  },

  smallBondButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    padding: spacing.xxl,
    alignItems: "center",
  },

  recentLoading: {
    paddingTop: 70,
    alignItems: "center",
  },

  loading: {
    position: "absolute",
    top: 190,
    alignSelf: "center",
  },
});
