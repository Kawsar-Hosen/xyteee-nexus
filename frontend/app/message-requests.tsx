import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, spacing } from "@/src/theme";

dayjs.extend(relativeTime);

type RequestChat = {
  conversation_id: string;
  last_message?: string | null;
  last_message_at?: string;
  unread: number;
  is_request?: boolean;
  other_user: {
    user_id: string;
    display_name: string;
    username: string;
    profile_picture?: string;
    badge_type?: string | null;
    badge_icon?: string | null;
    badge_expires_at?: string | null;
    profile_frame?: string | null;
    achievement_level?: string | null;
    profile_animation?: string | null;
    profile_animation_speed?: string | null;
    profile_animation_intensity?: string | null;
    online?: boolean;
    online_status?: "online" | "idle" | "dnd" | "invisible";
    last_seen?: string;
  };
};

function getCompactTime(date?: string) {
  if (!date) return "";
  const value = dayjs(date);
  const now = dayjs();
  const minutes = now.diff(value, "minute");
  const hours = now.diff(value, "hour");
  const days = now.diff(value, "day");

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return value.format("MMM D");
}

function getPreview(last?: string | null) {
  if (!last) return "New message";
  return last.length > 80 ? last.slice(0, 80) + "…" : last;
}

export default function MessageRequests() {
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();

  const [requests, setRequests] = useState<RequestChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api<{ chats: RequestChat[] }>("/chats", { token });
      const mine = (r.chats || []).filter((c) => c.is_request === true);
      setRequests(mine);
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
    }, [load])
  );

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "message") {
        const conversationId = e.message?.conversation_id;
        if (!conversationId) return;
        setRequests((current) => {
          const existing = current.find(
            (c) => c.conversation_id === conversationId
          );
          if (existing) {
            if (e.message.sender_id === user?.user_id) {
              return current.filter(
                (c) => c.conversation_id !== conversationId
              );
            }
            const preview =
              e.message.kind === "text"
                ? (e.message.content || "").slice(0, 80)
                : `[${e.message.kind || "message"}]`;
            const updated: RequestChat = {
              ...existing,
              last_message: preview,
              last_message_at: e.message.created_at,
              unread:
                e.message.sender_id !== user?.user_id
                  ? existing.unread + 1
                  : existing.unread,
            };
            return [
              updated,
              ...current.filter((c) => c.conversation_id !== conversationId),
            ];
          }
          load();
          return current;
        });
        return;
      }

      if (
        e.type === "message_read" ||
        e.type === "message_edit" ||
        e.type === "message_delete" ||
        e.type === "conversation_deleted" ||
        e.type === "chat_cleared"
      ) {
        load();
      }
    });
  }, [subscribe, load, user?.user_id]);

  const requestCount = useMemo(() => requests.length, [requests]);
  const totalUnread = useMemo(
    () => requests.reduce((sum, c) => sum + c.unread, 0),
    [requests]
  );

  const openRequest = useCallback(
    (chat: RequestChat) => {
      setRequests((current) =>
        current.map((c) =>
          c.conversation_id === chat.conversation_id ? { ...c, unread: 0 } : c
        )
      );
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: chat.conversation_id,
          userId: chat.other_user?.user_id || "",
          displayName: chat.other_user?.display_name || "",
          profilePicture: chat.other_user?.profile_picture || "",
          badgeType: chat.other_user?.badge_type || "",
          online: chat.other_user?.online ? "1" : "0",
          onlineStatus: chat.other_user?.online_status || "online",
          lastSeen: chat.other_user?.last_seen || "",
        },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: RequestChat }) => (
      <RequestRow chat={item} onPress={() => openRequest(item)} />
    ),
    [openRequest]
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.glass,
            borderBottomColor: colors.border,
            ...(Platform.OS === "web"
              ? {
                  backdropFilter: "blur(20px)" as any,
                  WebkitBackdropFilter: "blur(20px)" as any,
                }
              : {}),
          },
        ]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity
            testID="msgreq-back"
            onPress={() => router.back()}
            style={styles.headerBtn}
          >
            <Feather name="chevron-left" size={26} color={colors.foreground} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 4 }}>
            <NxText variant="titleSm">Message Requests</NxText>
            <NxText variant="caption" style={{ marginTop: 1 }}>
              {requestCount > 0
                ? `You have ${requestCount} request${requestCount > 1 ? "s" : ""}${totalUnread > 0 ? `, ${totalUnread} unread` : ""}`
                : "No message requests"}
            </NxText>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(c) => c.conversation_id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 44 },
            requests.length === 0 && { flexGrow: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={<EmptyState />}
        />
      )}
    </SafeAreaView>
  );
}

function RequestRow({
  chat,
  onPress,
}: {
  chat: RequestChat;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const hasUnread = chat.unread > 0;
  const time = getCompactTime(chat.last_message_at);
  const preview = getPreview(chat.last_message);

  return (
    <TouchableOpacity
      testID={`msgreq-row-${chat.conversation_id}`}
      onPress={onPress}
      activeOpacity={0.72}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <View
        style={[
          styles.avatarWrap,
          {
            borderColor: hasUnread ? colors.primary : colors.border,
          },
        ]}
      >
        <Avatar
          uri={chat.other_user?.profile_picture}
          name={chat.other_user?.display_name}
          size={52}
          frame={chat.other_user?.profile_frame}
          achievement={chat.other_user?.achievement_level}
        />
        <View
          style={[
            styles.lockBadge,
            { backgroundColor: colors.primary },
          ]}
        >
          <Feather name="lock" size={11} color={colors.onPrimary} />
        </View>
      </View>

      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={styles.rowTopLine}>
          <View style={styles.rowNameLine}>
            <NxText
              variant="titleSm"
              numberOfLines={1}
              style={
                hasUnread
                  ? { fontFamily: fonts.bodySemi }
                  : { color: colors.mutedFg }
              }
            >
              Someone
            </NxText>
            <View
              style={[
                styles.hiddenChip,
                { backgroundColor: colors.surfaceHigh },
              ]}
            >
              <NxText
                style={{ color: colors.mutedFg, fontSize: 10, fontFamily: fonts.bodySemi }}
              >
                hidden
              </NxText>
            </View>
          </View>

          <NxText
            variant="caption"
            style={{
              marginLeft: 10,
              color: hasUnread ? colors.primary : colors.mutedFg,
              fontFamily: hasUnread ? fonts.bodySemi : undefined,
            }}
          >
            {time}
          </NxText>
        </View>

        <View style={styles.rowBottomLine}>
          <NxText
            variant="bodySm"
            numberOfLines={1}
            style={{
              flex: 1,
              color: hasUnread ? colors.foreground : colors.mutedFg,
              fontFamily: hasUnread ? fonts.bodySemi : undefined,
            }}
          >
            {preview}
          </NxText>

          {hasUnread ? (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <NxText
                style={{
                  color: colors.onPrimary,
                  fontSize: 10,
                  fontFamily: fonts.bodySemi,
                }}
              >
                {chat.unread > 99 ? "99+" : chat.unread}
              </NxText>
            </View>
          ) : null}
        </View>
      </View>

      <Feather
        name="chevron-right"
        size={18}
        color={colors.mutedFg}
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
  );
}

function EmptyState() {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.surfaceHigh },
        ]}
      >
        <Feather name="inbox" size={34} color={colors.primary} />
      </View>
      <NxText variant="titleSm" style={{ marginTop: 18 }}>
        No message requests
      </NxText>
      <NxText
        variant="bodySm"
        style={{ textAlign: "center", marginTop: 6, maxWidth: 260 }}
      >
        When someone who isn't bonded with you sends a message, it will show up
        here.
      </NxText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingTop: spacing.md,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: {
    position: "relative",
    borderRadius: 27,
    borderWidth: 1.5,
  },
  lockBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowNameLine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hiddenChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rowBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
});
