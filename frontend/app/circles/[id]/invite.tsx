import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, spacing } from "@/src/theme";

type Member = {
  user_id: string;
};

export default function CircleInvitePage() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [friends, setFriends] = useState<any[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
   const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const visibleUsers = query.trim() ? searchResults : friends;

  const load = useCallback(async () => {
    if (!token || !id) return;

    try {
      const [friendsResult, membersResult] = await Promise.all([
        api<{ friends: any[] }>("/friends", { token }),
        api<{ members: Member[] }>(`/circles/${id}/members`, { token }),
      ]);

      setFriends(friendsResult.friends || []);
      setMemberIds(
        new Set((membersResult.members || []).map((member) => member.user_id))
      );
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();

    if (!q || !token) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const result = await api<{ users: any[] }>(
          `/users/search?q=${encodeURIComponent(q)}`,
          { token }
        );
        setSearchResults(result.users || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, token]);

  const invite = async (userId: string) => {
    if (!token || !id || invitingId) return;

    setInvitingId(userId);

    try {
      await api(`/circles/${id}/invite`, {
        method: "POST",
        token,
        body: { user_id: userId },
      });

      setMemberIds((current) => {
        const next = new Set(current);
        next.add(userId);
        return next;
      });
    } catch (error: any) {
      Alert.alert(
        "Invite failed",
        error?.message || error?.detail || JSON.stringify(error)
      );
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.headerBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <NxText
            style={{
              color: colors.foreground,
              fontSize: 21,
              fontFamily: fonts.bodySemi,
            }}
          >
            Invite to Circle
          </NxText>

          <NxText
            style={{
              color: colors.mutedFg,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            Bring your Bonds together
          </NxText>
        </View>
      </View>



      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Feather name="search" size={21} color={colors.mutedFg} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search worldwide"
          placeholderTextColor={colors.mutedFg}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {searching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Feather name="x" size={20} color={colors.mutedFg} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleUsers}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isMember = memberIds.has(item.user_id);
            const isInviting = invitingId === item.user_id;

            return (
              <View
                style={[
                  styles.personRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Avatar
                  uri={item.profile_picture || undefined}
                  name={item.display_name}
                  size={48}
                  online={item.online}
                  onlineStatus={item.online_status || "online"}
                />

                <View style={styles.personInfo}>
                  <View style={styles.nameRow}>
                    <NxText
                      numberOfLines={1}
                      style={{
                        color: colors.foreground,
                        fontSize: 16,
                        fontFamily: fonts.bodySemi,
                      }}
                    >
                      {item.display_name}
                    </NxText>

                    <VerifiedBadge
                      badgeType={item.badge_type}
                      size={15}
                    />
                  </View>

                  <NxText
                    numberOfLines={1}
                    style={{
                      color: colors.mutedFg,
                      fontSize: 12,
                      marginTop: 3,
                    }}
                  >
                    @{item.username}
                  </NxText>
                </View>

                <TouchableOpacity
                  disabled={isMember || !!invitingId}
                  onPress={() => invite(item.user_id)}
                  activeOpacity={0.75}
                  style={[
                    styles.inviteBtn,
                    {
                      backgroundColor: isMember
                        ? colors.backgroundElevated
                        : colors.primary,
                      borderColor: isMember
                        ? colors.border
                        : colors.primary,
                    },
                  ]}
                >
                  {isInviting ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <Feather
                        name={isMember ? "check" : "user-plus"}
                        size={14}
                        color={isMember ? colors.mutedFg : colors.onPrimary}
                      />
                      <NxText
                        style={{
                          marginLeft: 6,
                          fontSize: 12,
                          fontFamily: fonts.bodySemi,
                          color: isMember ? colors.mutedFg : colors.onPrimary,
                        }}
                      >
                        {isMember ? "Joined" : "Invite"}
                      </NxText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={34} color={colors.mutedFg} />
              <NxText
                style={{
                  color: colors.mutedFg,
                  marginTop: 12,
                }}
              >
                {query.trim() ? "No users found" : "No Bonds found"}
              </NxText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    height: 48,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 46,
    marginLeft: 10,
    fontSize: 15,
    padding: 0,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  personRow: {
    minHeight: 72,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  personInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  inviteBtn: {
    minWidth: 86,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
  },
});
