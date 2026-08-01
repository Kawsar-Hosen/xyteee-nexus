import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, spacing, radii } from "@/src/theme";

dayjs.extend(relativeTime);

/* ── Notification type metadata ─────────────────────────────────────────── */

type KindMeta = { icon: any; color: string };

const KIND_META: Record<string, KindMeta> = {
  // core Xyteee kinds
  friend_request: { icon: "user-plus", color: "#F0B232" },
  friend_accepted: { icon: "user-check", color: "#2E9B67" },
  message: { icon: "message-circle", color: "#4A90E2" },
  circle_message: { icon: "message-square", color: "#4A90E2" },
  story: { icon: "aperture", color: "#8B5CF6" },
  circle_invite: { icon: "users", color: "#7C3AED" },
  circle_invite_accepted: { icon: "user-check", color: "#2E9B67" },
  circle_invite_rejected: { icon: "user-x", color: "#D97706" },
  circle_member_removed: { icon: "user-minus", color: "#DC4C4C" },
  circle_message_reaction: { icon: "smile", color: "#F472B6" },
  message_reaction: { icon: "thumbs-up", color: "#4A90E2" },
  story_reaction: { icon: "smile", color: "#F472B6" },
  account_moderated: { icon: "shield", color: "#F23F43" },
  account_restored: { icon: "shield", color: "#2E9B67" },
  voice_call: { icon: "phone", color: "#2E9B67" },
  video_call: { icon: "video", color: "#2E9B67" },
  // social / system kinds
  like: { icon: "heart", color: "#F23F43" },
  reaction: { icon: "thumbs-up", color: "#4A90E2" },
  follow: { icon: "user-plus", color: "#4A90E2" },
  story_view: { icon: "eye", color: "#4A90E2" },
  mention: { icon: "at-sign", color: "#A78BFA" },
  security: { icon: "shield", color: "#F23F43" },
  gift: { icon: "gift", color: "#F0B232" },
  system: { icon: "megaphone", color: "#8B8D98" },
};

function kindMeta(kind: string): KindMeta {
  return KIND_META[kind] || { icon: "bell", color: "#CFA876" };
}

function getName(n: any): string {
  return (
    n.sender?.display_name ||
    n.data?.from_name ||
    n.sender?.username ||
    "Someone"
  );
}

function buildDescription(n: any): string {
  const kind = n.kind;
  switch (kind) {
    case "friend_request":
      return "sent you a bond request";
    case "friend_accepted":
      return "accepted your bond";
    case "message":
    case "circle_message":
      return n.data?.preview || "Sent you a message";
    case "story":
      return "shared a reverie";
    case "story_view":
      return "viewed your story";
    case "story_reaction":
      return `reacted ${n.data?.emoji || "❤️"} to your story`;
    case "message_reaction":
      return `reacted ${n.data?.emoji || "❤️"} to your message`;
    case "circle_message_reaction":
      return `reacted ${n.data?.emoji || "❤️"} to your Circle message`;
    case "mention":
      return "mentioned you in a post";
    case "follow":
      return "started following you";
    case "gift":
      return "sent you a gift";
    case "security":
      return n.data?.reason || "New login detected";
    case "system":
      return n.data?.message || "App updates or announcements";
    case "circle_invite_accepted":
      return `accepted your invitation to ${n.data?.circle_name || "the Circle"}`;
    case "circle_invite_rejected":
      return `declined your invitation to ${n.data?.circle_name || "the Circle"}`;
    case "circle_member_removed":
      return `removed you from ${n.data?.circle_name || "a Circle"}`;
    case "account_moderated":
      return n.data?.reason || "Your account status has been updated";
    case "account_restored":
      return "Your account has been restored";
    case "voice_call":
      return "is calling you";
    case "video_call":
      return "is video calling you";
    default:
      return "Activity";
  }
}

/* ── Time grouping ──────────────────────────────────────────────────────── */

const GROUP_ORDER = ["NEW", "TODAY", "EARLIER", "THIS WEEK", "OLDER"] as const;
const GROUP_TITLES: Record<string, string> = {
  NEW: "New",
  TODAY: "Today",
  EARLIER: "Earlier",
  "THIS WEEK": "This week",
  OLDER: "Older",
};

function timeBucket(dateStr?: string): string {
  if (!dateStr) return "OLDER";
  const t = dayjs(dateStr);
  const now = dayjs();
  if (now.diff(t, "minute") < 60) return "NEW";
  if (t.isSame(now, "day")) return "TODAY";
  if (t.isSame(now.subtract(1, "day"), "day")) return "EARLIER";
  if (now.diff(t, "day") < 7) return "THIS WEEK";
  return "OLDER";
}

function groupNotifications(items: any[]) {
  const buckets: Record<string, any[]> = {};
  for (const it of items) {
    const key = timeBucket(it.created_at);
    (buckets[key] = buckets[key] || []).push(it);
  }
  return GROUP_ORDER.filter((k) => buckets[k]?.length).map((key) => ({
    title: GROUP_TITLES[key],
    key,
    data: buckets[key],
  }));
}

/* ── Main screen ────────────────────────────────────────────────────────── */

export default function Notifications() {
  const { colors, mode } = useTheme();
  const { token } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [sheetItem, setSheetItem] = useState<any | null>(null);

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
    }, [load])
  );

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "notification") {
        load();
      }
    });
  }, [subscribe, load]);

  const removeItem = useCallback((id: string) => {
    setItems((cur) => cur.filter((n) => n.notif_id !== id));
  }, []);

  const markRead = useCallback(
    (item: any) => {
      if (item.read) return;
      setItems((cur) =>
        cur.map((n) =>
          n.notif_id === item.notif_id ? { ...n, read: true } : n
        )
      );
      if (token) {
        api(`/notifications/${item.notif_id}/read`, {
          method: "POST",
          token,
        }).catch(() => {});
      }
    },
    [token]
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      await api("/notifications/read", { method: "POST", token });
    } catch {
      /* keep local state */
    }
  }, [token]);

  const handlePressCard = useCallback(
    (item: any) => {
      markRead(item);
      if (item.kind === "message" && item.data?.conversation_id) {
        router.push(`/chat/${item.data.conversation_id}`);
      } else if (
        item.kind === "friend_request" ||
        item.kind === "friend_accepted"
      ) {
        router.push("/(app)/friends");
      } else if (
        (item.kind === "story" ||
          item.kind === "story_view" ||
          item.kind === "story_reaction") &&
        item.data?.from
      ) {
        router.push(`/story/${item.data.from}`);
      } else if (
        (item.kind === "circle_invite_accepted" ||
          item.kind === "circle_invite_rejected") &&
        item.data?.circle_id
      ) {
        router.push(`/circles/${item.data.circle_id}`);
      } else if (item.kind === "circle_invite") {
        router.push("/circles");
      } else if (
        (item.kind === "follow" ||
          item.kind === "gift" ||
          item.kind === "mention") &&
        (item.data?.from || item.sender?.user_id)
      ) {
        router.push(`/user/${item.data?.from || item.sender?.user_id}`);
      }
    },
    [markRead, router]
  );

  const handleAcceptRequest = useCallback(
    async (item: any) => {
      if (!token || actionBusyId) return;
      const fromId = item.data?.from || item.sender?.user_id;
      if (!fromId) return;
      setActionBusyId(item.notif_id);
      try {
        await api("/friends/accept", {
          method: "POST",
          token,
          body: { user_id: fromId },
        });
        removeItem(item.notif_id);
      } catch (e: any) {
        Alert.alert("Could not accept request", e?.message || "Please try again");
      } finally {
        setActionBusyId(null);
      }
    },
    [token, actionBusyId, removeItem]
  );

  const handleDeclineRequest = useCallback(
    async (item: any) => {
      if (!token || actionBusyId) return;
      const fromId = item.data?.from || item.sender?.user_id;
      if (!fromId) return;
      setActionBusyId(item.notif_id);
      try {
        await api("/friends/reject", {
          method: "POST",
          token,
          body: { user_id: fromId },
        });
        removeItem(item.notif_id);
      } catch (e: any) {
        Alert.alert("Could not decline request", e?.message || "Please try again");
      } finally {
        setActionBusyId(null);
      }
    },
    [token, actionBusyId, removeItem]
  );

  const handleCircleInvite = useCallback(
    async (item: any, action: "accept" | "reject") => {
      if (!token || actionBusyId) return;
      setActionBusyId(item.notif_id);
      try {
        const result = await api<{ circle_id?: string }>(
          `/circles/invites/${item.notif_id}/${action}`,
          { method: "POST", token }
        );
        removeItem(item.notif_id);
        if (action === "accept" && result.circle_id) {
          router.push({
            pathname: "/circles/[id]",
            params: { id: result.circle_id },
          });
        }
      } catch (e: any) {
        Alert.alert(
          action === "accept" ? "Could not join Circle" : "Could not reject invite",
          e?.message || e?.detail || "Please try again"
        );
      } finally {
        setActionBusyId(null);
      }
    },
    [token, actionBusyId, removeItem, router]
  );

  const handleLongPress = useCallback((item: any) => setSheetItem(item), []);

  const handleSheetAction = useCallback(
    (action: "read" | "unread" | "delete" | "mute" | "profile") => {
      if (!sheetItem) return;
      const item = sheetItem;
      setSheetItem(null);

      if (action === "read") {
        setItems((cur) =>
          cur.map((n) =>
            n.notif_id === item.notif_id ? { ...n, read: true } : n
          )
        );
        if (token) {
          api(`/notifications/${item.notif_id}/read`, {
            method: "POST",
            token,
          }).catch(() => {});
        }
      } else if (action === "unread") {
        setItems((cur) =>
          cur.map((n) =>
            n.notif_id === item.notif_id ? { ...n, read: false } : n
          )
        );
      } else if (action === "delete") {
        removeItem(item.notif_id);
      } else if (action === "mute") {
        Alert.alert(
          "Muted",
          `You won't see notifications from @${item.sender?.username || getName(item)} anymore.`
        );
      } else if (action === "profile") {
        const uid = item.data?.from || item.sender?.user_id;
        if (uid) router.push(`/user/${uid}`);
      }
    },
    [sheetItem, removeItem, router, token]
  );

  const sections = useMemo(() => {
    const base = filter === "unread" ? items.filter((n) => !n.read) : items;
    return groupNotifications(base);
  }, [items, filter]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <NotificationCard
        item={item}
        busyId={actionBusyId}
        onPress={handlePressCard}
        onLongPress={handleLongPress}
        onDelete={removeItem}
        onAcceptRequest={handleAcceptRequest}
        onDeclineRequest={handleDeclineRequest}
        onCircleInvite={handleCircleInvite}
      />
    ),
    [
      actionBusyId,
      handlePressCard,
      handleLongPress,
      removeItem,
      handleAcceptRequest,
      handleDeclineRequest,
      handleCircleInvite,
    ]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: any }) => (
      <SectionHeader title={section.title} />
    ),
    []
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* ═══════════ Header ═══════════ */}
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
        <View style={styles.mobileWrapper}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              testID="notif-back"
              onPress={() => router.back()}
              style={styles.headerBtn}
            >
              <Feather name="chevron-left" size={26} color={colors.foreground} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 4 }}>
              <NxText variant="titleSm">Notifications</NxText>
              <NxText variant="caption" style={{ marginTop: 1 }}>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </NxText>
            </View>

            <TouchableOpacity
              testID="notif-mark-all-read"
              disabled={unreadCount === 0}
              onPress={markAllRead}
              activeOpacity={0.7}
              style={[styles.markAllBtn, { opacity: unreadCount === 0 ? 0.35 : 1 }]}
            >
              <NxText
                style={{ color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 13 }}
              >
                Mark all read
              </NxText>
            </TouchableOpacity>
          </View>

          {/* Filter chips */}
          <View style={styles.chipsRow}>
            <FilterChip
              label="All"
              active={filter === "all"}
              onPress={() => setFilter("all")}
              testID="notif-filter-all"
            />
            <FilterChip
              label="Unread"
              active={filter === "unread"}
              onPress={() => setFilter("unread")}
              testID="notif-filter-unread"
            />
          </View>
        </View>
      </View>

      {/* ═══════════ Body ═══════════ */}
      {loading ? (
        <NotificationsSkeleton />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.notif_id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 44 },
            sections.length === 0 && { flexGrow: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== "web"}
          ListEmptyComponent={
            <EmptyState
              filtered={filter === "unread"}
              mode={mode}
            />
          }
        />
      )}

      {/* ═══════════ Long-press action sheet ═══════════ */}
      <Modal
        visible={!!sheetItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetItem(null)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setSheetItem(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.mutedFg }]} />
            {sheetItem ? (
              <>
                <View style={styles.sheetHead}>
                  <Avatar
                    uri={sheetItem.sender?.profile_picture}
                    name={getName(sheetItem)}
                    size={46}
                    frame={sheetItem.sender?.profile_frame}
                    achievement={sheetItem.sender?.achievement_level}
                    animation={sheetItem.sender?.profile_animation}
                    animationSpeed={sheetItem.sender?.profile_animation_speed}
                    animationIntensity={sheetItem.sender?.profile_animation_intensity}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <NxText
                      numberOfLines={1}
                      style={{ fontFamily: fonts.bodySemi, fontSize: 15 }}
                    >
                      {getName(sheetItem)}
                    </NxText>
                    <NxText variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>
                      @{sheetItem.sender?.username || "unknown"}
                    </NxText>
                  </View>
                </View>

                <SheetAction
                  icon="mail"
                  label={sheetItem.read ? "Mark as unread" : "Mark as read"}
                  tint={colors.primary}
                  onPress={() => handleSheetAction(sheetItem.read ? "unread" : "read")}
                />
                <SheetAction
                  icon="bell-off"
                  label="Mute notifications"
                  tint="#F0B232"
                  onPress={() => handleSheetAction("mute")}
                />
                <SheetAction
                  icon="user"
                  label="View profile"
                  tint={colors.primary}
                  onPress={() => handleSheetAction("profile")}
                />
                <SheetAction
                  icon="trash-2"
                  label="Delete"
                  tint={colors.danger}
                  last
                  onPress={() => handleSheetAction("delete")}
                />

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSheetItem(null)}
                  style={[
                    styles.sheetCancel,
                    { backgroundColor: colors.surfaceHigh },
                  ]}
                >
                  <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, fontSize: 15 }}>
                    Cancel
                  </NxText>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function FilterChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <NxText
        style={{
          color: active ? colors.onPrimary : colors.mutedFg,
          fontFamily: fonts.bodySemi,
          fontSize: 13,
        }}
      >
        {label}
      </NxText>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
      <NxText
        style={{
          color: colors.mutedFg,
          fontFamily: fonts.bodySemi,
          fontSize: 12,
          letterSpacing: 1.2,
        }}
      >
        {title.toUpperCase()}
      </NxText>
    </View>
  );
}

function DeleteAction({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.danger, colors.danger + "CC"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.deleteAction}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.deleteActionInner}
      >
        <Feather name="trash-2" size={20} color="#fff" />
        <NxText
          style={{ color: "#fff", fontFamily: fonts.bodySemi, fontSize: 12, marginTop: 4 }}
        >
          Delete
        </NxText>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const NotificationCard = React.memo(function NotificationCard({
  item,
  busyId,
  onPress,
  onLongPress,
  onDelete,
  onAcceptRequest,
  onDeclineRequest,
  onCircleInvite,
}: {
  item: any;
  busyId: string | null;
  onPress: (item: any) => void;
  onLongPress: (item: any) => void;
  onDelete: (id: string) => void;
  onAcceptRequest: (item: any) => void;
  onDeclineRequest: (item: any) => void;
  onCircleInvite: (item: any, action: "accept" | "reject") => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const unread = !item.read;
  const meta = kindMeta(item.kind);
  const name = getName(item);
  const isMessage = item.kind === "message" || item.kind === "circle_message";
  const busy = busyId === item.notif_id;

  const pressIn = () => {
    scale.value = withSpring(0.98, { damping: 22, stiffness: 300 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 260 });
  };

  return (
    <View style={styles.cardWrap}>
      <Swipeable
        renderRightActions={() => (
          <DeleteAction onPress={() => onDelete(item.notif_id)} />
        )}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <Animated.View entering={FadeInDown.duration(260)} style={animatedStyle}>
          <TouchableOpacity
            testID={`notif-${item.notif_id}`}
            activeOpacity={0.85}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={() => onPress(item)}
            onLongPress={() => onLongPress(item)}
            style={[
              styles.card,
              {
                backgroundColor: unread ? colors.surfaceHigh : colors.surface,
                borderColor: unread ? colors.primary + "44" : colors.border,
              },
            ]}
          >
            {unread ? (
              <View
                style={[
                  styles.unreadBar,
                  { backgroundColor: colors.primary },
                ]}
              />
            ) : null}

            <View style={styles.cardRow}>
              {/* Avatar + type badge */}
              <View style={styles.avatarArea}>
                <Avatar
                  uri={item.sender?.profile_picture}
                  name={name}
                  size={52}
                  frame={item.sender?.profile_frame}
                  achievement={item.sender?.achievement_level}
                  animation={item.sender?.profile_animation}
                  animationSpeed={item.sender?.profile_animation_speed}
                  animationIntensity={item.sender?.profile_animation_intensity}
                />
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: meta.color,
                      borderColor: unread ? colors.surfaceHigh : colors.surface,
                    },
                  ]}
                >
                  <Feather name={meta.icon} size={13} color="#fff" />
                </View>
              </View>

              {/* Content */}
              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <NxText
                    numberOfLines={1}
                    style={[styles.userName, { color: colors.foreground }]}
                  >
                    {name}
                  </NxText>
                  <VerifiedBadge
                    badgeType={item.sender?.badge_type}
                    badgeIcon={item.sender?.badge_icon}
                    badgeExpiresAt={item.sender?.badge_expires_at}
                    size={14}
                  />
                </View>

                <NxText
                  numberOfLines={2}
                  style={[
                    styles.desc,
                    {
                      color: isMessage ? colors.foreground : colors.mutedFg,
                      fontFamily: isMessage ? fonts.bodyMedium : fonts.body,
                    },
                  ]}
                >
                  {buildDescription(item)}
                </NxText>

                <NxText
                  style={[
                    styles.time,
                    { color: unread ? colors.primary : colors.mutedFg },
                  ]}
                >
                  {dayjs(item.created_at).fromNow()}
                </NxText>
              </View>

              {/* Unread indicator */}
              {unread ? (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
              ) : null}
            </View>

            {/* Friend request actions */}
            {item.kind === "friend_request" ? (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onAcceptRequest(item)}
                  activeOpacity={0.8}
                  style={[
                    styles.actionPrimary,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <Feather name="user-check" size={15} color={colors.onPrimary} />
                      <NxText style={[styles.actionLabel, { color: colors.onPrimary }]}>
                        Accept
                      </NxText>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onDeclineRequest(item)}
                  activeOpacity={0.8}
                  style={[
                    styles.actionSecondary,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Feather name="x" size={15} color={colors.mutedFg} />
                  <NxText style={[styles.actionLabel, { color: colors.mutedFg }]}>
                    Decline
                  </NxText>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Circle invite card */}
            {item.kind === "circle_invite" ? (
              <>
                <View
                  style={[
                    styles.circleCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.circleIcon,
                      { backgroundColor: colors.surfaceHigh },
                    ]}
                  >
                    <Feather name="users" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <NxText
                      numberOfLines={1}
                      style={[styles.circleName, { color: colors.foreground }]}
                    >
                      {item.data?.circle_name || "Circle"}
                    </NxText>
                    <NxText style={[styles.circleSub, { color: colors.mutedFg }]}>
                      Circle invitation
                    </NxText>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => onCircleInvite(item, "accept")}
                    activeOpacity={0.8}
                    style={[
                      styles.actionPrimary,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <>
                        <Feather name="check" size={15} color={colors.onPrimary} />
                        <NxText style={[styles.actionLabel, { color: colors.onPrimary }]}>
                          Accept
                        </NxText>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => onCircleInvite(item, "reject")}
                    activeOpacity={0.8}
                    style={[
                      styles.actionSecondary,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Feather name="x" size={15} color={colors.mutedFg} />
                    <NxText style={[styles.actionLabel, { color: colors.mutedFg }]}>
                      Reject
                    </NxText>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </TouchableOpacity>
        </Animated.View>
      </Swipeable>
    </View>
  );
});

function SheetAction({
  icon,
  label,
  tint,
  onPress,
  last,
}: {
  icon: any;
  label: string;
  tint: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.sheetAction,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.sheetActionIcon, { backgroundColor: `${tint}1F` }]}>
        <Feather name={icon} size={17} color={tint} />
      </View>
      <NxText style={{ flex: 1, marginLeft: 12, fontFamily: fonts.bodyMedium, fontSize: 15 }}>
        {label}
      </NxText>
    </TouchableOpacity>
  );
}

function EmptyState({ filtered, mode }: { filtered: boolean; mode: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <LinearGradient
        colors={
          mode === "dark"
            ? [colors.surfaceHigh, colors.surface]
            : [colors.surface, colors.surfaceHigh]
        }
        style={styles.emptyIcon}
      >
        <Feather name="bell" size={34} color={colors.primary} />
      </LinearGradient>
      <NxText variant="titleSm" style={{ marginTop: 18 }}>
        {filtered ? "All caught up" : "No notifications yet"}
      </NxText>
      <NxText
        variant="bodySm"
        style={{ textAlign: "center", marginTop: 6, maxWidth: 260 }}
      >
        {filtered
          ? "You've read everything. New activity will show up here."
          : "When someone interacts with you, you'll see it here."}
      </NxText>
    </View>
  );
}

function NotificationsSkeleton() {
  const { colors } = useTheme();
  const c = colors.surfaceHigh;
  return (
    <View style={{ flex: 1 }}>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <View style={styles.skeletonCard}>
            <View
              style={[
                styles.skeletonCircle,
                {
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: c,
                },
              ]}
            />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View
                style={[
                  styles.skeletonLine,
                  { width: item % 2 === 0 ? "58%" : "42%", height: 14, backgroundColor: c },
                ]}
              />
              <View
                style={[
                  styles.skeletonLine,
                  { width: "86%", height: 11, marginTop: 9, backgroundColor: c },
                ]}
              />
              <View
                style={[
                  styles.skeletonLine,
                  { width: 54, height: 9, marginTop: 9, backgroundColor: c },
                ]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  mobileWrapper: { width: "100%", maxWidth: 480, alignSelf: "center" },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  markAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },

  listContent: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  separator: { height: 10 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 10,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },

  cardWrap: { paddingHorizontal: spacing.lg },
  card: {
    position: "relative",
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 18,
    bottom: 18,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarArea: { position: "relative" },
  typeBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1, marginLeft: 12, marginTop: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12,
  },
  userName: { fontFamily: fonts.bodySemi, fontSize: 15, flexShrink: 1 },
  desc: { fontSize: 13, lineHeight: 18, marginTop: 3, paddingRight: 14 },
  time: { fontSize: 11, marginTop: 6, fontFamily: fonts.bodyMedium },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 7,
    marginRight: 2,
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionPrimary: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionSecondary: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionLabel: { fontSize: 13, fontFamily: fonts.bodySemi },

  circleCard: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  circleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  circleName: { fontFamily: fonts.bodySemi, fontSize: 14 },
  circleSub: { fontSize: 11, marginTop: 2 },

  deleteAction: {
    width: 84,
    marginRight: spacing.lg,
    marginLeft: spacing.sm,
    borderRadius: 22,
    overflow: "hidden",
  },
  deleteActionInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 34,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    opacity: 0.4,
    marginBottom: 18,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  sheetActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancel: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
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

  skeletonRow: { paddingHorizontal: spacing.lg, paddingBottom: 10 },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  skeletonLine: { borderRadius: 999 },
  skeletonCircle: { flexShrink: 0 },
});
