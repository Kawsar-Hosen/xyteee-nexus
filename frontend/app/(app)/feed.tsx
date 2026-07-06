import React, { useCallback, useEffect, useState } from "react";
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
import { fonts, radii, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

dayjs.extend(relativeTime);

type StoryGroup = {
  user: { user_id: string; display_name: string; username: string; profile_picture?: string; online?: boolean };
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
    online?: boolean;
    last_seen?: string;
  };
};

export default function Feed() {
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();

  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [f, c, n] = await Promise.all([
        api<{ feed: StoryGroup[] }>("/stories/feed", { token }),
        api<{ chats: Chat[] }>("/chats", { token }),
        api<{ notifications: any[] }>("/notifications", { token }),
      ]);
      setStories(f.feed || []);
      setChats(c.chats || []);
      setNotifCount((n.notifications || []).filter((x) => !x.read).length);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "message" || e.type === "message_edit" || e.type === "message_delete" || e.type === "story_new" || e.type === "notification") {
        load();
      }
    });
  }, [subscribe, load]);

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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.conversation_id}
          renderItem={({ item }) => <ChatRow chat={item} onPress={() => router.push(`/chat/${item.conversation_id}`)} />}
          contentContainerStyle={{ paddingBottom: DOCK_PAD }}
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
                <TouchableOpacity testID="feed-new-chat" onPress={() => router.push("/(app)/friends")}>
                  <NxText variant="caption" style={{ color: colors.primary }}>New</NxText>
                </TouchableOpacity>
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
          {myStories ? "Add more" : "Your reverie"}
        </NxText>
      </TouchableOpacity>
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
              <Avatar uri={g.user.profile_picture} name={g.user.display_name} size={28} ring online={g.user.online} />
              <NxText variant="caption" style={{ color: "#FFF", marginTop: 6, fontFamily: fonts.bodySemi }}>
                {g.user.display_name.split(" ")[0]}
              </NxText>
            </View>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
}

function ChatRow({ chat, onPress }: { chat: Chat; onPress: () => void }) {
  const { colors } = useTheme();
  const preview = chat.last_message || "Say something first…";
  const time = chat.last_message_at ? dayjs(chat.last_message_at).fromNow(true) : "";
  return (
    <TouchableOpacity testID={`chat-row-${chat.conversation_id}`} onPress={onPress} activeOpacity={0.8} style={styles.chatRow}>
      <Avatar uri={chat.other_user?.profile_picture} name={chat.other_user?.display_name} size={52} online={chat.other_user?.online} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <NxText variant="titleSm" numberOfLines={1} style={{ flex: 1 }}>
            {chat.other_user?.display_name || "Unknown"}
          </NxText>
          <NxText variant="caption">{time}</NxText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          <NxText variant="bodySm" numberOfLines={1} style={{ flex: 1, color: colors.mutedFg }}>
            {preview}
          </NxText>
          {chat.unread > 0 ? (
            <View style={[styles.unread, { backgroundColor: colors.primary }]}>
              <NxText style={{ color: colors.onPrimary, fontSize: 10, fontFamily: fonts.bodySemi }}>{chat.unread}</NxText>
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
  chatRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 12 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  empty: { padding: spacing.xxl, alignItems: "center" },
});
