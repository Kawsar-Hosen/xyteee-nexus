import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, spacing } from "@/src/theme";

export default function Notifications() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [circleActionId, setCircleActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const r = await api<{ notifications: any[] }>("/notifications", { token });
      setItems(r.notifications || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
      if (token) {
        api("/notifications/read", {
          method: "POST",
          token,
        }).catch(() => {});
      }
    }, [load, token])
  );

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "notification") {
        load();

        if (token) {
          api("/notifications/read", {
            method: "POST",
            token,
          }).catch(() => {});
        }
      }
    });
  }, [subscribe, load, token]);

  const icon = (kind: string) =>
    ({
      friend_request: "user-plus",
      friend_accepted: "user-check",
      message: "message-circle",
      story: "aperture",
      circle_invite: "users",
      circle_invite_accepted: "user-check",
      circle_invite_rejected: "user-x",
      circle_member_removed: "user-minus",
    }[kind] || "bell");

  const accent = (kind: string) => {
    switch (kind) {
      case "message":
        return "#4A90E2";
      case "friend_request":
        return "#A56A2A";
      case "friend_accepted":
        return "#2E9B67";
      case "story":
        return "#8B5CF6";
      case "circle_invite":
        return "#7C3AED";
      case "circle_invite_accepted":
        return "#2E9B67";
      case "circle_invite_rejected":
        return "#D97706";
      case "circle_member_removed":
        return "#DC4C4C";
      default:
        return colors.primary;
    }
  };

  const handlePress = (n: any) => {
    if (n.kind === "message" && n.data?.conversation_id) {
      router.push(`/chat/${n.data.conversation_id}`);
    } else if (
      n.kind === "friend_request" ||
      n.kind === "friend_accepted"
    ) {
      router.push("/(app)/friends");
    } else if (n.kind === "story" && n.data?.from) {
      router.push(`/story/${n.data.from}`);
    } else if (
      (
        n.kind === "circle_invite_accepted" ||
        n.kind === "circle_invite_rejected"
      ) &&
      n.data?.circle_id
    ) {
      router.push(`/circles/${n.data.circle_id}`);
    }
  };

  const handleCircleInvite = async (
    item: any,
    action: "accept" | "reject"
  ) => {
    if (!token || circleActionId) return;

    setCircleActionId(item.notif_id);

    try {
      const result = await api<{ circle_id?: string }>(
        `/circles/invites/${item.notif_id}/${action}`,
        {
          method: "POST",
          token,
        }
      );

      setItems((current) =>
        current.filter((notification) => notification.notif_id !== item.notif_id)
      );

      if (action === "accept" && result.circle_id) {
        router.push({
          pathname: "/circles/[id]",
          params: { id: result.circle_id },
        });
      }
    } catch (error: any) {
      Alert.alert(
        action === "accept" ? "Could not join Circle" : "Could not reject invite",
        error?.message || error?.detail || "Please try again"
      );
    } finally {
      setCircleActionId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const photo = item.sender?.profile_picture;
    const name =
      item.sender?.display_name ||
      item.data?.from_name ||
      item.sender?.username ||
      "?";

    return (
      <TouchableOpacity
        testID={`notif-${item.notif_id}`}
        activeOpacity={0.78}
        onPress={() => handlePress(item)}
        style={[
          styles.row,
          !item.read && {
            backgroundColor: colors.surfaceHigh,
          },
        ]}
      >
        <View style={styles.avatarArea}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                { backgroundColor: colors.surfaceHigh },
              ]}
            >
              <NxText
                style={{
                  fontSize: 20,
                  fontFamily: fonts.bodySemi,
                  color: colors.primary,
                }}
              >
                {name.charAt(0).toUpperCase()}
              </NxText>
            </View>
          )}

          <View
            style={[
              styles.typeIcon,
              {
                backgroundColor: accent(item.kind),
                borderColor: colors.background,
              },
            ]}
          >
            <Feather
              name={icon(item.kind) as any}
              size={12}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.content}>
          {item.kind === "circle_invite" ? (
            <>
              <View style={styles.notificationLine}>
                <NxText
                  style={{
                    color: colors.foreground,
                    fontFamily: fonts.bodySemi,
                    fontSize: 15,
                    lineHeight: 21,
                  }}
                >
                  {item.sender?.display_name ||
                    item.data?.from_name ||
                    "Someone"}
                </NxText>

                <VerifiedBadge
                  badgeType={item.sender?.badge_type}
                  size={15}
                />

                <NxText
                  style={{
                    color: colors.foreground,
                    fontFamily: fonts.bodyMedium,
                    fontSize: 15,
                    lineHeight: 21,
                    flexShrink: 1,
                  }}
                >
                  {" invited you to a Circle"}
                </NxText>
              </View>

              <View
                style={[
                  styles.circleInviteCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.circleInviteIcon,
                    { backgroundColor: colors.surfaceHigh },
                  ]}
                >
                  <Feather
                    name="users"
                    size={19}
                    color={colors.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <NxText
                    numberOfLines={1}
                    style={{
                      color: colors.foreground,
                      fontFamily: fonts.bodySemi,
                      fontSize: 14,
                    }}
                  >
                    {item.data?.circle_name || "Circle"}
                  </NxText>

                  <NxText
                    style={{
                      color: colors.mutedFg,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    Circle invitation
                  </NxText>
                </View>
              </View>

              <View style={styles.circleActions}>
                <TouchableOpacity
                  disabled={circleActionId === item.notif_id}
                  onPress={() => handleCircleInvite(item, "accept")}
                  style={[
                    styles.circleAcceptBtn,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  {circleActionId === item.notif_id ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.onPrimary}
                    />
                  ) : (
                    <>
                      <Feather
                        name="check"
                        size={15}
                        color={colors.onPrimary}
                      />
                      <NxText
                        style={{
                          marginLeft: 6,
                          color: colors.onPrimary,
                          fontFamily: fonts.bodySemi,
                          fontSize: 12,
                        }}
                      >
                        Accept
                      </NxText>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={circleActionId === item.notif_id}
                  onPress={() => handleCircleInvite(item, "reject")}
                  style={[
                    styles.circleRejectBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="x"
                    size={15}
                    color={colors.mutedFg}
                  />
                  <NxText
                    style={{
                      marginLeft: 6,
                      color: colors.mutedFg,
                      fontFamily: fonts.bodySemi,
                      fontSize: 12,
                    }}
                  >
                    Reject
                  </NxText>
                </TouchableOpacity>
              </View>
            </>
          ) : item.kind === "circle_member_removed" ? (
            <View style={styles.notificationLine}>
              <NxText
                style={{
                  color: colors.foreground,
                  fontFamily: item.read ? fonts.bodyMedium : fonts.bodySemi,
                  fontSize: 15,
                  lineHeight: 21,
                  flexShrink: 1,
                }}
              >
                {`You were removed from ${item.data?.circle_name || "a Circle"}`}
              </NxText>
            </View>
          ) : (
            <View style={styles.notificationLine}>
              <NxText
                style={{
                  color: colors.foreground,
                  fontFamily: item.read ? fonts.bodyMedium : fonts.bodySemi,
                  fontSize: 15,
                  lineHeight: 21,
                }}
              >
                {item.data?.from_name || "Someone"}
              </NxText>

              <VerifiedBadge
                badgeType={item.sender?.badge_type}
                size={15}
              />

              <NxText
                style={{
                  color: colors.foreground,
                  fontFamily: item.read ? fonts.bodyMedium : fonts.bodySemi,
                  fontSize: 15,
                  lineHeight: 21,
                  flexShrink: 1,
                }}
              >
                {item.kind === "friend_request"
                  ? " sent you a bond request"
                  : item.kind === "friend_accepted"
                  ? " accepted your bond"
                  : item.kind === "message"
                  ? `: ${item.data?.preview || ""}`
                  : item.kind === "story"
                  ? " shared a reverie"
                  : item.kind === "circle_invite_accepted"
                  ? ` accepted your invitation to ${item.data?.circle_name || "the Circle"}`
                  : item.kind === "circle_invite_rejected"
                  ? ` declined your invitation to ${item.data?.circle_name || "the Circle"}`
                  : " Activity"}
              </NxText>
            </View>
          )}

          <NxText
            variant="caption"
            style={{
              marginTop: 5,
              color: !item.read ? colors.primary : colors.mutedFg,
            }}
          >
            {dayjs(item.created_at).fromNow()}
          </NxText>
        </View>

        {!item.read ? (
          <View
            style={[styles.unreadDot, { backgroundColor: colors.primary }]}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          testID="notif-back"
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Feather
            name="chevron-left"
            size={28}
            color={colors.foreground}
          />
        </TouchableOpacity>

        <NxText variant="titleSm">Notifications</NxText>

        <View style={styles.headerBtn}>
          <Feather
            name="bell"
            size={21}
            color={colors.primary}
          />
        </View>
      </View>

      {loading ? (
        <NotificationsSkeleton />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.notif_id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingBottom: 30,
            flexGrow: items.length === 0 ? 1 : undefined,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => (
            <View
              style={[
                styles.separator,
                { backgroundColor: colors.border },
              ]}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Feather
                  name="bell"
                  size={30}
                  color={colors.mutedFg}
                />
              </View>

              <NxText variant="titleSm" style={{ marginTop: 16 }}>
                Quiet for now
              </NxText>

              <NxText
                variant="bodySm"
                style={{
                  textAlign: "center",
                  marginTop: 6,
                  color: colors.mutedFg,
                }}
              >
                New messages, bonds and reveries will appear here.
              </NxText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function NotificationsSkeleton() {
  const { colors } = useTheme();
  const skeletonColor = colors.surfaceHigh;

  return (
    <View style={{ flex: 1 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((item) => (
        <View key={item}>
          <View style={styles.row}>
            <View style={styles.avatarArea}>
              <View
                style={[
                  styles.skeletonCircle,
                  {
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: skeletonColor,
                  },
                ]}
              />

              <View
                style={[
                  styles.skeletonCircle,
                  {
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 25,
                    height: 25,
                    borderRadius: 13,
                    backgroundColor: colors.surface,
                    borderWidth: 2.5,
                    borderColor: colors.background,
                  },
                ]}
              />
            </View>

            <View style={{ flex: 1, marginLeft: 14, paddingRight: 10 }}>
              <View
                style={[
                  styles.skeletonLine,
                  {
                    width: item % 2 === 0 ? "72%" : "58%",
                    height: 13,
                    backgroundColor: skeletonColor,
                  },
                ]}
              />

              <View
                style={[
                  styles.skeletonLine,
                  {
                    width: item % 2 === 0 ? "88%" : "76%",
                    height: 11,
                    marginTop: 9,
                    backgroundColor: skeletonColor,
                  },
                ]}
              />

              <View
                style={[
                  styles.skeletonLine,
                  {
                    width: 52,
                    height: 9,
                    marginTop: 9,
                    backgroundColor: skeletonColor,
                  },
                ]}
              />
            </View>
          </View>

          {item < 6 ? (
            <View
              style={[
                styles.separator,
                { backgroundColor: colors.border },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonLine: {
    borderRadius: 999,
  },
  skeletonCircle: {
    flexShrink: 0,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    minHeight: 94,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
  },
  avatarArea: {
    width: 58,
    height: 58,
    position: "relative",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 10,
  },
  notificationLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginLeft: 5,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 92,
  },
  circleInviteCard: {
    marginTop: 10,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  circleInviteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  circleActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  circleAcceptBtn: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  circleRejectBtn: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
});
