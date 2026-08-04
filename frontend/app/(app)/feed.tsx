import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { useAIChat } from "@/src/context/AIChatContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { NexusMark } from "@/src/components/NexusMark";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";
import { loadCache, saveCache } from "@/src/utils/screenCache";
import { setFeedStories } from "@/src/utils/feedStore";
dayjs.extend(relativeTime);

type StoryGroup = {
  user: {
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
  };
  stories: any[];
};

type Chat = {
  conversation_id: string;
  last_message?: string | null;
  last_message_at?: string;
  unread: number;
  is_bonded?: boolean;
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
  const { openChat } = useAIChat();

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
  const [showRequests, setShowRequests] = useState(false);
  const [loading, setLoading] = useState(() => feedCache === null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);

  // Seed from the last saved session so a returning user sees content
  // immediately (like profile) while the background refresh runs.
  useEffect(() => {
    let cancelled = false;
    loadCache<{ stories: StoryGroup[]; chats: Chat[]; notifCount: number }>("feed").then((c) => {
      if (cancelled || !c) return;
      feedCache = c;
      setStories(c.stories || []);
      setChats(c.chats || []);
      setNotifCount(c.notifCount || 0);
      setFeedStories(c.stories || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
            setTimeout(resolve, 350 * (attempt + 1))
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
      setFeedStories(nextStories);

      feedCache = {
        stories: nextStories,
        chats: nextChats,
        notifCount: feedCache?.notifCount || 0,
      };
      saveCache("feed", feedCache);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
        e.type === "notification" ||
        e.type === "conversation_deleted" ||
        e.type === "chat_cleared" ||
        e.type === "blocked"
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
      <View style={[styles.header, { backgroundColor: colors.glass, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <NexusMark size={30} />
          <View style={{ width: 10 }} />
          <View>
            <NxText variant="title" style={{ letterSpacing: 2.5, fontSize: 24 }}>XYTEEE</NxText>
            <NxText variant="caption" style={{ color: colors.primary, letterSpacing: 4, marginTop: -2 }}>NEXUS</NxText>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={openChat}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="robot-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
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
      </View>

      {loading && chats.length === 0 && stories.length === 0 ? (
        <FeedSkeleton />
      ) : (
        <FlatList
          data={chats.filter((c) => c.is_bonded !== false)}
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
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionAccent, { backgroundColor: colors.primary }]} />
                  <NxText style={[styles.sectionTitle, { color: colors.foreground }]}>Reveries</NxText>
                  <View style={[styles.sectionChip, { backgroundColor: colors.surfaceHigh }]}>
                    <NxText style={[styles.sectionChipText, { color: colors.mutedFg }]}>24h stories</NxText>
                  </View>
                </View>
              </View>
              <StoriesRow
                stories={stories}
                meId={user?.user_id}
                me={user}
                onCreate={() => router.push("/story/create")}
                onOpen={(uid) => router.push(`/story/${uid}`)}
              />
              {(() => {
                const requestChats = chats.filter((c) => c.is_bonded === false);
                const totalUnread = requestChats.reduce((sum, c) => sum + c.unread, 0);
                if (requestChats.length === 0) return null;
                return (
                  <View style={[styles.sectionHead, { marginTop: spacing.xl }]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowRequests((s) => !s)}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: colors.surface,
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: colors.primary + "18",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <Feather name="user-plus" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <NxText variant="body" style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>
                          Message Requests
                        </NxText>
                        <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 1 }}>
                          You have {requestChats.length} request{requestChats.length > 1 ? "s" : ""}{totalUnread > 0 ? `, ${totalUnread} unread` : ""}
                        </NxText>
                      </View>
                      <Feather name={showRequests ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedFg} />
                    </TouchableOpacity>
                  </View>
                );
              })()}
              {showRequests && chats.filter((c) => c.is_bonded === false).map((chat) => (
                <RequestChatRow
                  key={chat.conversation_id}
                  chat={chat}
                  isTyping={!!typingChats[chat.conversation_id]}
                  onPress={() => {
                    setChats((current) => {
                      const nextChats = current.map((c) =>
                        c.conversation_id === chat.conversation_id
                          ? { ...c, unread: 0 }
                          : c
                      );
                      if (feedCache) feedCache.chats = nextChats;
                      return nextChats;
                    });
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
                  }}
                />
              ))}
              <View style={[styles.sectionHead, { marginTop: spacing.xl }]}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionAccent, { backgroundColor: colors.primary }]} />
                  <NxText style={[styles.sectionTitle, { color: colors.foreground }]}>Conversations</NxText>
                </View>
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
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 16 }}
        style={{ marginTop: 4, flexGrow: 0 }}
      >
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.storyItem}>
            <View
              style={{
                width: STORY_SIZE + 8,
                height: STORY_SIZE + 8,
                borderRadius: (STORY_SIZE + 8) / 2,
                borderWidth: 2,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={[
                  styles.skeletonCircle,
                  {
                    width: STORY_SIZE,
                    height: STORY_SIZE,
                    borderRadius: STORY_SIZE / 2,
                    backgroundColor: skeletonColor,
                  },
                ]}
              />
            </View>
            <View
              style={[
                styles.skeletonLine,
                {
                  width: 62,
                  height: 10,
                  marginTop: 7,
                  backgroundColor: skeletonColor,
                },
              ]}
            />
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

const STORY_SIZE = 62;

function StoriesRow({
  stories,
  meId,
  me,
  onCreate,
  onOpen,
}: {
  stories: StoryGroup[];
  meId?: string;
  me?: { profile_picture?: string; display_name?: string } | null;
  onCreate: () => void;
  onOpen: (userId: string) => void;
}) {
  const { colors } = useTheme();
  const myStories = stories.find((s) => s.user?.user_id === meId);
  const others = stories.filter((s) => s.user?.user_id !== meId);
  const myThumb = myStories?.stories?.[0];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 16 }}
      style={{ marginTop: 4 }}
    >
      {/* ── Add story (always visible, uses my profile photo) ── */}
      <TouchableOpacity
        testID="stories-create-card"
        activeOpacity={0.8}
        onPress={onCreate}
        style={styles.storyItem}
      >
        <View
          style={[
            styles.storyAddRing,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Avatar uri={me?.profile_picture} name="You" size={STORY_SIZE} />
          <View
            style={[
              styles.storyPlusBadge,
              { backgroundColor: colors.primary, borderColor: colors.background },
            ]}
          >
            <Feather name="plus" size={16} color="#fff" strokeWidth={3} />
          </View>
        </View>
        <NxText
          variant="caption"
          numberOfLines={1}
          style={[styles.storyLabel, { color: colors.foreground }]}
        >
          Add story
        </NxText>
      </TouchableOpacity>

      {/* ── My story (appears right after Add story) ── */}
      {myStories ? (
        <TouchableOpacity
          testID="story-my-reveries"
          activeOpacity={0.8}
          onPress={() => meId && onOpen(meId)}
          style={styles.storyItem}
        >
          <StoryRing size={STORY_SIZE}>
            <StoryThumb
              uri={myThumb?.media}
              kind={myThumb?.kind}
              size={STORY_SIZE}
              fallbackUri={myStories.user.profile_picture}
              fallbackName="Your story"
            />
          </StoryRing>
          <NxText
            variant="caption"
            numberOfLines={1}
            style={[styles.storyLabel, { color: colors.foreground }]}
          >
            Your story
          </NxText>
        </TouchableOpacity>
      ) : null}

      {/* ── Friends' stories ─────────────────────────── */}
      {others.map((g) => {
        const thumb = g.stories?.[0];
        const unviewed = (g.stories || []).some(
          (s: any) =>
            !(s.viewers || []).some((v: any) => v?.user_id === meId)
        );
        return (
          <TouchableOpacity
            key={g.user.user_id}
            testID={`story-${g.user.user_id}`}
            activeOpacity={0.8}
            onPress={() => onOpen(g.user.user_id)}
            style={styles.storyItem}
          >
            <View>
              <StoryRing size={STORY_SIZE} highlighted={unviewed}>
                <StoryThumb
                  uri={thumb?.media}
                  kind={thumb?.kind}
                  size={STORY_SIZE}
                  fallbackUri={g.user.profile_picture}
                  fallbackName={g.user.display_name}
                />
              </StoryRing>
              {g.user.online ? (
                <View
                  style={[
                    styles.storyOnlineDot,
                    { borderColor: colors.background, backgroundColor: "#23A55A" },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.storyNameLine}>
              <NxText
                variant="caption"
                numberOfLines={1}
                style={[
                  styles.storyLabel,
                  { color: colors.foreground },
                  { flexShrink: 1 },
                ]}
              >
                {g.user.display_name.split(" ")[0]}
              </NxText>
              <VerifiedBadge
                badgeType={g.user.badge_type}
                badgeIcon={g.user.badge_icon}
                badgeExpiresAt={g.user.badge_expires_at}
                size={12}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function StoryRing({
  size,
  children,
  highlighted,
}: {
  size: number;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  const { colors } = useTheme();
  const outer = size + 8;

  const inner = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      {children}
    </View>
  );

  if (highlighted) {
    return (
      <View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          padding: 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "#23A55A",
        }}
      >
        {inner}
      </View>
    );
  }

  return (
    <View
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        padding: 3,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
      }}
    >
      {inner}
    </View>
  );
}

function StoryThumb({
  uri,
  kind,
  size,
  fallbackUri,
  fallbackName,
}: {
  uri?: string;
  kind?: string;
  size: number;
  fallbackUri?: string;
  fallbackName?: string;
}) {
  if (kind === "video" && uri) {
    return <VideoStoryThumb uri={uri} size={size} />;
  }

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    );
  }

  return <Avatar uri={fallbackUri} name={fallbackName} size={size} />;
}

function VideoStoryThumb({ uri, size }: { uri: string; size: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.pause();
  });
  return (
    <VideoView
      player={player}
      style={{ width: size, height: size }}
      contentFit="cover"
      nativeControls={false}
    />
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
        frame={chat.other_user?.profile_frame}
        achievement={chat.other_user?.achievement_level}
        animation={chat.other_user?.profile_animation}
        animationSpeed={chat.other_user?.profile_animation_speed}
        animationIntensity={chat.other_user?.profile_animation_intensity}
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
              badgeIcon={chat.other_user?.badge_icon}
              badgeExpiresAt={chat.other_user?.badge_expires_at}
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

function RequestChatRow({
  chat,
  isTyping,
  onPress,
}: {
  chat: Chat;
  isTyping: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const preview = isTyping ? "Typing…" : getSmartPreview(chat.last_message);
  const time = getCompactTime(chat.last_message_at);
  const hasUnread = chat.unread > 0;

  return (
    <TouchableOpacity
      testID={`request-chat-row-${chat.conversation_id}`}
      onPress={() => {
        if (!revealed) {
          setRevealed(true);
          return;
        }
        onPress();
      }}
      activeOpacity={0.72}
      style={[styles.chatRow, { backgroundColor: colors.surface, borderRadius: 14, marginHorizontal: spacing.lg, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}
    >
      <Avatar
        uri={revealed ? chat.other_user?.profile_picture : undefined}
        name={revealed ? chat.other_user?.display_name : "?"}
        size={48}
        online={false}
        onlineStatus="offline"
      />

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.chatTopLine}>
          <NxText
            variant="titleSm"
            numberOfLines={1}
            style={hasUnread ? { fontFamily: fonts.bodySemi } : { color: colors.mutedFg }}
          >
            {revealed ? (chat.other_user?.display_name || "Unknown") : "Someone"}
          </NxText>

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
              color: hasUnread ? colors.foreground : colors.mutedFg,
              fontFamily: hasUnread ? fonts.bodySemi : undefined,
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
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === "web"
      ? { backdropFilter: "blur(20px)" as any, WebkitBackdropFilter: "blur(20px)" as any }
      : {}),
  },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  badge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  sectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 2,
  },
  sectionChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  storyItem: {
    alignItems: "center",
    width: 76,
  },
  storyAddRing: {
    width: STORY_SIZE + 8,
    height: STORY_SIZE + 8,
    borderRadius: (STORY_SIZE + 8) / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  storyPlusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  storyOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  storyNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 7,
    maxWidth: 76,
  },
  storyLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
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
