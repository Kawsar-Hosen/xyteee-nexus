import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
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
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, spacing } from "@/src/theme";

type CircleMember = {
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  user?: any;
};

export default function CircleMembersPage() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [members, setMembers] = useState<CircleMember[]>([]);
  const [myRole, setMyRole] = useState<"owner" | "admin" | "member">("member");
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;

    try {
      const result = await api<{
        members: CircleMember[];
        my_role: "owner" | "admin" | "member";
      }>(
        `/circles/${id}/members`,
        { token }
      );

      setMembers(result.members || []);
      setMyRole(result.my_role || "member");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const removeMember = (member: CircleMember) => {
    if (!token || !id || removingId) return;

    const name = member.user?.display_name || "this member";

    Alert.alert(
      "Remove member?",
      `${name} will lose access to this Circle and its group chat.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemovingId(member.user_id);

            try {
              await api(`/circles/${id}/members/${member.user_id}`, {
                method: "DELETE",
                token,
              });

              setMembers((current) =>
                current.filter((item) => item.user_id !== member.user_id)
              );
            } catch (error: any) {
              Alert.alert(
                "Could not remove member",
                error?.message || error?.detail || "Please try again"
              );
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border },
        ]}
      >
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
              fontSize: 21,
              color: colors.foreground,
              fontFamily: fonts.bodySemi,
            }}
          >
            Members
          </NxText>
          <NxText
            style={{
              fontSize: 12,
              color: colors.mutedFg,
              marginTop: 2,
            }}
          >
            {members.length} people in this Circle
          </NxText>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View
              style={[
                styles.memberRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Avatar
                uri={item.user?.profile_picture || undefined}
                name={item.user?.display_name || "Member"}
                size={48}
                online={item.user?.online}
                onlineStatus={item.user?.online_status || "online"}
              />

              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <NxText
                    numberOfLines={1}
                    style={{
                      color: colors.foreground,
                      fontSize: 16,
                      fontFamily: fonts.bodySemi,
                    }}
                  >
                    {item.user?.display_name || "Member"}
                  </NxText>

                  <VerifiedBadge
                    badgeType={item.user?.badge_type}
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
                  @{item.user?.username || "user"}
                </NxText>
              </View>

              {item.role !== "member" ? (
                <View
                  style={[
                    styles.rolePill,
                    {
                      backgroundColor: colors.backgroundElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={item.role === "owner" ? "award" : "shield"}
                    size={12}
                    color={colors.primary}
                  />
                  <NxText
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      marginLeft: 5,
                      fontFamily: fonts.bodySemi,
                    }}
                  >
                    {item.role === "owner" ? "Owner" : "Admin"}
                  </NxText>
                </View>
              ) : (myRole === "owner" || myRole === "admin") ? (
                <TouchableOpacity
                  disabled={removingId === item.user_id}
                  onPress={() => removeMember(item)}
                  activeOpacity={0.7}
                  style={[
                    styles.removeBtn,
                    {
                      backgroundColor: colors.backgroundElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {removingId === item.user_id ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Feather name="user-minus" size={16} color={colors.danger} />
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          )}
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  memberRow: {
    minHeight: 72,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  rolePill: {
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
});
