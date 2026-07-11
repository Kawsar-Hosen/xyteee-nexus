import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

type Tab = "friends" | "requests";

let friendsCache: {
  friends: any[];
  incoming: any[];
  outgoing: any[];
} | null = null;

export default function Friends() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<any[]>(() => friendsCache?.friends || []);
  const [incoming, setIncoming] = useState<any[]>(() => friendsCache?.incoming || []);
  const [outgoing, setOutgoing] = useState<any[]>(() => friendsCache?.outgoing || []);
  const [loading, setLoading] = useState(() => friendsCache === null);
  const [refreshing, setRefreshing] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [f, r] = await Promise.all([
        api<{ friends: any[] }>("/friends", { token }),
        api<{ incoming: any[]; outgoing: any[] }>("/friends/requests", { token }),
      ]);

      const nextFriends = f.friends || [];
      const nextIncoming = r.incoming || [];
      const nextOutgoing = r.outgoing || [];

      setFriends(nextFriends);
      setIncoming(nextIncoming);
      setOutgoing(nextOutgoing);
      setNetworkError(false);

      friendsCache = {
        friends: nextFriends,
        incoming: nextIncoming,
        outgoing: nextOutgoing,
      };
    } catch {
      setTimeout(() => {
        load();
      }, 20000);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "notification" || e.type === "presence") load();
    });
  }, [subscribe, load]);

  const accept = async (uid: string) => { await api("/friends/accept", { method: "POST", body: { user_id: uid }, token: token! }); load(); };
  const reject = async (uid: string) => { await api("/friends/reject", { method: "POST", body: { user_id: uid }, token: token! }); load(); };
  const cancel = async (uid: string) => { await api("/friends/cancel", { method: "POST", body: { user_id: uid }, token: token! }); load(); };

  const openChat = async (uid: string) => {
    const r = await api<{ conversation: any }>("/chats/open", { method: "POST", body: { user_id: uid }, token: token! });
    router.push(`/chat/${r.conversation.conversation_id}`);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <NxText variant="displaySm">Bonds</NxText>
          <TouchableOpacity
            testID="friends-search-btn"
            onPress={() => router.push("/(app)/search")}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Feather name="user-plus" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TabPill active={tab === "friends"} onPress={() => setTab("friends")} label={`Friends · ${friends.length}`} testID="tab-friends" />
          <TabPill active={tab === "requests"} onPress={() => setTab("requests")} label={`Requests · ${incoming.length}`} testID="tab-requests" />
        </View>
      </View>

      {networkError ? (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Feather name="wifi-off" size={15} color={colors.mutedFg} />
          <NxText variant="caption" style={{ marginLeft: 8 }}>
            No connection · Showing saved data
          </NxText>
        </View>
      ) : null}

      {loading ? (
        <BondsSkeleton />
      ) : tab === "friends" ? (
        <FlatList
          data={friends}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ paddingBottom: DOCK_PAD, paddingTop: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", flex: 1 }} onPress={() => router.push(`/user/${item.user_id}`)}>
                <Avatar
                  uri={item.profile_picture}
                  name={item.display_name}
                  size={44}
                  online={item.online}
                  onlineStatus={item.online_status || "online"}
                />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                <NxText variant="titleSm">{item.display_name}</NxText>
                <VerifiedBadge badgeType={item.badge_type} size={16} />
              </View>
                  <NxText variant="bodySm">@{item.username}</NxText>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`friend-open-chat-${item.username}`}
                onPress={() => openChat(item.user_id)}
                style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Feather name="message-circle" size={18} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <NxText variant="body" style={{ color: colors.mutedFg }}>No bonds yet. Head to Find to discover people.</NxText>
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: DOCK_PAD, paddingTop: spacing.md }}>
          <NxText variant="label" style={{ paddingHorizontal: spacing.lg }}>Incoming</NxText>
          {incoming.length === 0 ? <NxText variant="bodySm" style={{ padding: spacing.lg }}>No incoming requests.</NxText> : null}
          {incoming.map((r) => (
            <View key={r.request_id} style={styles.row}>
              <Avatar uri={r.user?.profile_picture} name={r.user?.display_name} size={44} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <NxText variant="titleSm">{r.user?.display_name}</NxText>
                  <VerifiedBadge badgeType={r.user?.badge_type} size={16} />
                </View>
                <NxText variant="bodySm">@{r.user?.username}</NxText>
              </View>
              <TouchableOpacity testID={`req-accept-${r.user?.username}`} onPress={() => accept(r.from_user)} style={[styles.smallBtn, { backgroundColor: colors.primary }]}>
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 13 }}>Accept</NxText>
              </TouchableOpacity>
              <TouchableOpacity testID={`req-reject-${r.user?.username}`} onPress={() => reject(r.from_user)} style={[styles.smallBtn, { borderColor: colors.border, borderWidth: 1, marginLeft: 8 }]}>
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, fontSize: 13 }}>Reject</NxText>
              </TouchableOpacity>
            </View>
          ))}
          <NxText variant="label" style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>Outgoing</NxText>
          {outgoing.length === 0 ? <NxText variant="bodySm" style={{ padding: spacing.lg }}>No outgoing requests.</NxText> : null}
          {outgoing.map((r) => (
            <View key={r.request_id} style={styles.row}>
              <Avatar uri={r.user?.profile_picture} name={r.user?.display_name} size={44} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <NxText variant="titleSm">{r.user?.display_name}</NxText>
                <NxText variant="bodySm">@{r.user?.username}</NxText>
              </View>
              <TouchableOpacity testID={`req-cancel-${r.user?.username}`} onPress={() => cancel(r.to_user)} style={[styles.smallBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, fontSize: 13 }}>Cancel</NxText>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function BondsSkeleton() {
  const { colors } = useTheme();
  const skeletonColor = colors.surfaceHigh;

  return (
    <View style={{ flex: 1, paddingTop: spacing.md }}>
      {[0, 1, 2, 3, 4, 5, 6].map((item) => (
        <View key={item} style={styles.row}>
          <View
            style={[
              styles.skeletonCircle,
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: skeletonColor,
              },
            ]}
          />

          <View style={{ flex: 1, marginLeft: 14 }}>
            <View
              style={[
                styles.skeletonLine,
                {
                  width: item % 2 === 0 ? "52%" : "40%",
                  height: 14,
                  backgroundColor: skeletonColor,
                },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                {
                  width: item % 2 === 0 ? "36%" : "48%",
                  height: 10,
                  marginTop: 9,
                  backgroundColor: skeletonColor,
                },
              ]}
            />
          </View>

          <View
            style={[
              styles.skeletonCircle,
              {
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: skeletonColor,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function TabPill({ active, onPress, label, testID }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.tabPill, { backgroundColor: active ? colors.primary : "transparent" }]}
    >
      <NxText style={{ color: active ? colors.onPrimary : colors.mutedFg, fontFamily: fonts.bodySemi, fontSize: 13 }}>{label}</NxText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tabs: { flexDirection: "row", borderRadius: radii.pill, borderWidth: 1, padding: 4, marginTop: spacing.lg },
  tabPill: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radii.pill },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 12 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill },
  skeletonLine: {
    borderRadius: 999,
  },
  skeletonCircle: {
    flexShrink: 0,
  },
  empty: { padding: spacing.xxl, alignItems: "center" },
});
