import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { NexusMark } from "@/src/components/NexusMark";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

dayjs.extend(relativeTime);

type StoryGroup = {
  user: {
    user_id: string;
    display_name: string;
    username: string;
    profile_picture?: string;
    badge_type?: string | null;
    online?: boolean;
    online_status?: "online" | "idle" | "dnd" | "invisible";
  };
  stories: any[];
};

type Chat = {
  conversation_id: string;
  last_message?: string | null;
  last_message_at?: string;
  unread: number;
  other_user: {
    user_id: string;
    display_name: string;
    username: string;
    profile_picture?: string;
    badge_type?: string | null;
    online?: boolean;
    online_status?: "online" | "idle" | "dnd" | "invisible";
    last_seen?: string;
  };
};

let feedCache: {
  stories: StoryGroup[];
  chats: Chat[];
  notifCount: number;
} | null = null;

export default function Feed() {
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();

  const [stories, setStories] = useState<StoryGroup[]>(
    () => feedCache?.stories || []
  );
  const [chats, setChats] = useState<Chat[]>(
    () => feedCache?.chats || []
  );
  const [notifCount, setNotifCount] = useState(
    () => feedCache?.notifCount || 0
  );
  const [typingChats, setTypingChats] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(() => feedCache === null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!token || loadingRef.current) return;

    loadingRef.current = true;

    try {
      let finalStories: StoryGroup[] | null = null;
      let finalChats: Chat[] | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const [f, c] = await Promise.allSettled([
          api<{ feed: StoryGroup[] }>("/stories/feed", { token }),
          api<{ chats: Chat[] }>("/chats", { token }),
        ]);

        const gotStories =
          f.status === "fulfilled" ? (f.value.feed || []) : null;

        const gotChats =
          c.status === "fulfilled" ? (c.value.chats || []) : null;

        if (gotStories !== null) finalStories = gotStories;
        if (gotChats !== null) finalChats = gotChats;

        const suspiciousEmpty =
          gotStories !== null &&
          gotChats !== null &&
          gotStories.length === 0 &&
          gotChats.length === 0;

        if (!suspiciousEmpty) break;

        if (attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 700 * (attempt + 1))
          );
        }
      }

      const nextStories =
        finalStories !== null
          ? finalStories
          : (feedCache?.stories || []);

      const nextChats =
        finalChats !== null
          ? finalChats
          : (feedCache?.chats || []);

      setStories(nextStories);
      setChats(nextChats);

      feedCache = {
        stories: nextStories,
        chats: nextChats,
        notifCount: feedCache?.notifCount || 0,
      };

      api<{ notifications: any[] }>("/notifications", { token })
        .then((n) => {
          const count = (n.notifications || []).filter((x) => !x.read).length;
          setNotifCount(count);

          if (feedCache) {
            feedCache.notifCount = count;
          }
        })
        .catch(() => {});
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "typing" && e.user_id !== user?.user_id) {
        setTypingChats((current) => ({
          ...current,
          [e.conversation_id]: e.is_typing,
        }));
        return;
      }

      if (e.type === "message") {
        const message = e.message;
        const conversationId = message?.conversation_id;

        if (!conversationId) return;

        const preview =
          message.kind === "text"
            ? (message.content || "").slice(0, 80)
            : `[${message.kind || "message"}]`;

        setChats((current) => {
          const existing = current.find(
            (chat) => chat.conversation_id === conversationId
          );

          if (!existing) {
            load();
            return current;
          }

          const updated: Chat = {
            ...existing,
            last_message: preview,
            last_message_at: message.created_at,
            unread:
              message.sender_id !== user?.user_id
                ? existing.unread + 1
                : existing.unread,
          };

          const nextChats = [
            updated,
            ...current.filter(
              (chat) => chat.conversation_id !== conversationId
            ),
          ];

          if (feedCache) {
            feedCache.chats = nextChats;
          }

          return nextChats;
        });

        return;
      }

      if (
        e.type === "message_read" &&
        e.read_by_user_id === user?.user_id
      ) {
        setChats((current) => {
          const nextChats = current.map((chat) =>
            chat.conversation_id === e.conversation_id
              ? { ...chat, unread: 0 }
              : chat
          );

          if (feedCache) {
            feedCache.chats = nextChats;
          }

          return nextChats;
        });

        return;
      }

      if (
        e.type === "message_edit" ||
        e.type === "message_delete" ||
        e.type === "story_new" ||
        e.type === "notification"
      ) {
        load();
      }
    });
  }, [subscribe, load, user?.user_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <NexusMark size={28} />
          <View style={{ width: 10 }} />
          <View>
            <NxText variant="title" style={{ letterSpacing: 2 }}>XYTEEE</NxText>
            <NxText variant="caption" style={{ color: colors.primary, letterSpacing: 3, marginTop: -2 }}>NEXUS</NxText>
          </View>
        </View>
        <TouchableOpacity
          testID="feed-open-notifications"
          onPress={() => router.push("/notifications")}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Feather name="bell" size={18} color={colors.foreground} />
          {notifCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <NxText style={{ color: colors.onPrimary, fontSize: 10, fontFamily: fonts.bodySemi }}>
                {notifCount > 9 ? "9+" : notifCount}
              </NxText>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {loading ? (
        <FeedSkeleton />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.conversation_id}
          renderItem={({ item }) => (
            <ChatRow
              chat={item}
              isTyping={!!typingChats[item.conversation_id]}
              onPress={() => {
                setChats((current) => {
                  const nextChats = current.map((chat) =>
                    chat.conversation_id === item.conversation_id
                      ? { ...chat, unread: 0 }
                      : chat
                  );

                  if (feedCache) {
                    feedCache.chats = nextChats;
                  }

                  return nextChats;
                });

                router.push({
                  pathname: "/chat/[id]",
                  params: {
                    id: item.conversation_id,
                    userId: item.other_user?.user_id || "",
                    displayName: item.other_user?.display_name || "",
                    profilePicture: item.other_user?.profile_picture || "",
                    badgeType: item.other_user?.badge_type || "",
                    online: item.other_user?.online ? "1" : "0",
                    onlineStatus: item.other_user?.online_status || "online",
                    lastSeen: item.other_user?.last_seen || "",
                  },
                });
              }}
            />
          )}
          contentContainerStyle={{ paddingBottom: DOCK_PAD + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View>
              <View style={styles.sectionHead}>
                <NxText variant="label">Reveries</NxText>
                <NxText variant="caption">24h stories</NxText>
              </View>
              <StoriesRow
                stories={stories}
                meId={user?.user_id}
                onCreate={() => router.push("/story/create")}
                onOpen={(uid) => router.push(`/story/${uid}`)}
              />
              <View style={[styles.sectionHead, { marginTop: spacing.xl }]}>
                <NxText variant="label">Conversations</NxText>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <TouchableOpacity
                    testID="feed-circles"
                    activeOpacity={0.7}
                    onPress={() => router.push("/circles")}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.surface,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                    }}
                  >
                    <Feather name="users" size={18} color={colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity testID="feed-new-chat" onPress={() => router.push("/(app)/friends")}>
                    <NxText variant="caption" style={{ color: colors.primary }}>New</NxText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="wind" size={40} color={colors.mutedFg} />
              <NxText variant="titleSm" style={{ marginTop: 16, color: colors.mutedFg }}>Nothing echoing yet</NxText>
              <NxText variant="bodySm" style={{ textAlign: "center", marginTop: 6 }}>
                Find your people in the Bonds tab and start a conversation.
              </NxText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function FeedSkeleton() {
  const { colors } = useTheme();
  const skeletonColor = colors.surfaceHigh;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.sectionHead}>
        <View style={[styles.skeletonLine, { width: 72, height: 12, backgroundColor: skeletonColor }]} />
        <View style={[styles.skeletonLine, { width: 58, height: 10, backgroundColor: skeletonColor }]} />
      </View>

      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}
        style={{ marginTop: 6, flexGrow: 0 }}
      >
        {[0, 1, 2, 3].map((item) => (
          <View
            key={item}
            style={[
              styles.storyCard,
              {
                backgroundColor: skeletonColor,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.skeletonCircle, { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface }]} />
            <View style={[styles.skeletonLine, { width: 62, height: 10, marginTop: 10, backgroundColor: colors.surface }]} />
          </View>
        ))}
      </ScrollView>

      <View style={[styles.sectionHead, { marginTop: spacing.xl }]}>
        <View style={[styles.skeletonLine, { width: 100, height: 12, backgroundColor: skeletonColor }]} />
        <View style={[styles.skeletonLine, { width: 32, height: 10, backgroundColor: skeletonColor }]} />
      </View>

      {[0, 1, 2, 3, 4].map((item) => (
        <View key={item} style={styles.chatRow}>
          <View style={[styles.skeletonCircle, { width: 52, height: 52, borderRadius: 26, backgroundColor: skeletonColor }]} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={[styles.skeletonLine, { width: item % 2 === 0 ? "55%" : "42%", height: 14, backgroundColor: skeletonColor }]} />
            <View style={[styles.skeletonLine, { width: item % 2 === 0 ? "82%" : "68%", height: 11, marginTop: 10, backgroundColor: skeletonColor }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function StoriesRow({
  stories,
  meId,
  onCreate,
  onOpen,
}: {
  stories: StoryGroup[];
  meId?: string;
  onCreate: () => void;
  onOpen: (userId: string) => void;
}) {
  const { colors } = useTheme();
  const myStories = stories.find((s) => s.user?.user_id === meId);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}
      style={{ marginTop: 6 }}
    >
      <TouchableOpacity
        testID="stories-create-card"
        activeOpacity={0.85}
        onPress={onCreate}
        style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.storyPlus, { backgroundColor: colors.primary }]}>
          <Feather name="plus" size={22} color={colors.onPrimary} />
        </View>
        <NxText variant="caption" style={{ color: colors.foreground, marginTop: 8, fontFamily: fonts.bodySemi }}>
          Add more
        </NxText>
      </TouchableOpacity>

      {myStories ? (
        <TouchableOpacity
          testID="story-my-reveries"
          activeOpacity={0.85}
          onPress={() => meId && onOpen(meId)}
          style={[styles.storyCard, { borderColor: colors.primary }]}
        >
          {myStories.stories[0]?.kind === "image" && myStories.stories[0]?.media ? (
            <View style={{ ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: radii.lg }}>
              <Avatar
                uri={myStories.stories[0].media}
                size={110}
                name="Your Reveries"
              />
            </View>
          ) : null}
          <View style={styles.storyOverlay} />
          <View style={styles.storyBottom}>
            <Avatar
              uri={myStories.user.profile_picture}
              name={myStories.user.display_name}
              size={28}
              ring
              online={myStories.user.online}
              onlineStatus={myStories.user.online_status || "online"}
            />
            <NxText variant="caption" style={{ color: "#FFF", marginTop: 6, fontFamily: fonts.bodySemi }}>
              Your Reveries
            </NxText>
          </View>
        </TouchableOpacity>
      ) : null}

      {stories
        .filter((s) => s.user?.user_id !== meId)
        .map((g) => (
          <TouchableOpacity
            key={g.user.user_id}
            testID={`story-${g.user.user_id}`}
            activeOpacity={0.85}
            onPress={() => onOpen(g.user.user_id)}
            style={[styles.storyCard, { borderColor: colors.primary }]}
          >
            {g.stories[0]?.kind === "image" && g.stories[0]?.media ? (
              <View style={{ ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: radii.lg }}>
                {/* eslint-disable-next-line react/style-prop-object */}
                <Avatar uri={g.stories[0].media} size={110} name={g.user.display_name} />
              </View>
            ) : null}
            <View style={styles.storyOverlay} />
            <View style={styles.storyBottom}>
              <Avatar
                uri={g.user.profile_picture}
                name={g.user.display_name}
                size={28}
                ring
                online={g.user.online}
                onlineStatus={g.user.online_status || "online"}
              />
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <NxText variant="caption" style={{ color: "#FFF", fontFamily: fonts.bodySemi }}>
                  {g.user.display_name.split(" ")[0]}
                </NxText>
                <VerifiedBadge badgeType={g.user.badge_type} size={14} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
}

function getSmartPreview(message?: string | null) {
  if (!message) return "Say something first…";

  const text = message.trim();
  const lower = text.toLowerCase();

  if (
    lower === "[image]" ||
    lower === "image" ||
    lower === "photo" ||
    lower.includes("sent a photo")
  ) {
    return "📷 Photo";
  }

  if (
    lower === "[voice]" ||
    lower === "voice" ||
    lower.includes("voice message")
  ) {
    return "🎤 Voice message";
  }

  return text;
}

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

function ChatRow({
  chat,
  isTyping,
  onPress,
}: {
  chat: Chat;
  isTyping: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const preview = isTyping ? "Typing…" : getSmartPreview(chat.last_message);
  const time = getCompactTime(chat.last_message_at);
  const hasUnread = chat.unread > 0;

  return (
    <TouchableOpacity
      testID={`chat-row-${chat.conversation_id}`}
      onPress={onPress}
      activeOpacity={0.72}
      style={styles.chatRow}
    >
      <Avatar
        uri={chat.other_user?.profile_picture}
        name={chat.other_user?.display_name}
        size={52}
        online={chat.other_user?.online}
        onlineStatus={chat.other_user?.online_status || "online"}
      />

      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={styles.chatTopLine}>
          <View style={styles.chatNameLine}>
            <NxText
              variant="titleSm"
              numberOfLines={1}
              style={hasUnread ? { fontFamily: fonts.bodySemi } : undefined}
            >
              {chat.other_user?.display_name || "Unknown"}
            </NxText>

            <VerifiedBadge
              badgeType={chat.other_user?.badge_type}
              size={16}
            />
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

        <View style={styles.chatPreviewLine}>
          <NxText
            variant="bodySm"
            numberOfLines={1}
            style={{
              flex: 1,
              color: isTyping
                ? colors.primary
                : hasUnread
                  ? colors.foreground
                  : colors.mutedFg,
              fontFamily: isTyping || hasUnread ? fonts.bodySemi : undefined,
            }}
          >
            {preview}
          </NxText>

          {hasUnread ? (
            <View style={[styles.unread, { backgroundColor: colors.primary }]}>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  badge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  storyCard: {
    width: 110,
    height: 160,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 10,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  storyPlus: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", position: "absolute", top: 10, right: 10 },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: radii.lg },
  storyBottom: { alignItems: "flex-start" },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  chatTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatNameLine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  chatPreviewLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    minHeight: 22,
  },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  skeletonLine: {
    borderRadius: 999,
  },
  skeletonCircle: {
    overflow: "hidden",
  },
  empty: { padding: spacing.xxl, alignItems: "center" },
});
