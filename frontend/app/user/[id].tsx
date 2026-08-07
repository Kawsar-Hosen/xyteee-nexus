import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Image, Share, Alert, Linking,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn, FadeInDown,
  useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { CoverWatermark } from "@/src/components/CoverWatermark";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { AnimatedStatusText } from "@/src/components/AnimatedStatusText";
import { fonts, radii, spacing } from "@/src/theme";

const COVER_H = 200;
const AVATAR_SIZE = 88;

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [u, setU] = useState<any>(null);
  const [resolvedId, setResolvedId] = useState<string>(id);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasStory, setHasStory] = useState(false);
  const [storyImages, setStoryImages] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [optimisticRelation, setOptimisticRelation] = useState<string | null>(null);

  const effectiveRelation = optimisticRelation ?? u?.relation;

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setNotFound(false);
      const r = await api<any>(`/users/${id}`, { token });
      setU(r);
      const uid = r?.user_id || id;
      setResolvedId(uid);
      try {
        const storyResult = await api<{ feed: any[] }>("/stories/feed", { token });
        const group = (storyResult.feed || []).find(
          (g: any) => g.user?.user_id === uid && (g.stories || []).length > 0
        );
        setHasStory(!!group);
        const imgs = (group?.stories || [])
          .filter((s: any) => s.media_url || s.image_url)
          .map((s: any) => s.media_url || s.image_url)
          .slice(0, 6);
        setStoryImages(imgs);
      } catch {
        setHasStory(false);
        setStoryImages([]);
      }
    } catch (e: any) {
      if (e?.status === 404) { setU(null); setNotFound(true); }
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const act = async (path: string) => {
    setBusy(true);
    if (path === "/friends/request") setOptimisticRelation("requested");
    else if (path === "/friends/cancel") setOptimisticRelation("open");
    else if (path === "/friends/accept") setOptimisticRelation("friend");
    else if (path === "/friends/reject" || path === "/friends/unfriend" || path === "/friends/unblock") setOptimisticRelation("open");
    else if (path === "/friends/block") setOptimisticRelation("blocked");
    try {
      await api(path, { method: "POST", body: { user_id: resolvedId }, token: token! });
      // Keep the optimistic relation visible until the fresh profile data
      // arrives, otherwise the button flickers back to "Accept Bond".
      await load();
      setOptimisticRelation(null);
    } catch {
      setOptimisticRelation(null);
    } finally { setBusy(false); }
  };

  const openChat = async () => {
    const r = await api<{ conversation: any }>("/chats/open", { method: "POST", body: { user_id: resolvedId }, token: token! });
    router.push(`/chat/${r.conversation.conversation_id}`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out @${u?.username} on Xyteee!\nhttps://xyteee.com/user/${u?.username}`,
        title: u?.display_name,
      });
    } catch { /* cancelled */ }
  };

  const handleReport = () => {
    Alert.alert(
      "Report User",
      `Why are you reporting @${u?.username}?`,
      [
        { text: "Spam", onPress: () => Alert.alert("Reported", "Thank you for your report.") },
        { text: "Harassment", onPress: () => Alert.alert("Reported", "Thank you for your report.") },
        { text: "Fake account", onPress: () => Alert.alert("Reported", "Thank you for your report.") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  /* ── Not found ── */
  if (notFound) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <NxText style={[styles.headerTitle, { color: colors.foreground }]}>Profile</NxText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.notFoundBody}>
          <View style={[styles.notFoundIcon, { backgroundColor: colors.surfaceHigh }]}>
            <Feather name="user" size={36} color={colors.mutedFg} />
          </View>
          <NxText style={[styles.notFoundTitle, { color: colors.foreground }]}>User Not Found</NxText>
          <NxText style={[styles.notFoundSub, { color: colors.mutedFg }]}>
            This profile doesn't exist or has been removed.
          </NxText>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Loading ── */
  if (!u) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const joinedDate = u.created_at
    ? new Date(u.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  const relationMeta = (() => {
    switch (u.relation) {
      case "friend":
        return { label: "Bonded", icon: "heart" as const, color: colors.primary, bg: `${colors.primary}15` };
      case "requested":
        return { label: "Request Sent", icon: "clock" as const, color: "#F0B232", bg: "#F0B23215" };
      case "incoming":
        return { label: "Wants to Bond", icon: "user-plus" as const, color: colors.primary, bg: `${colors.primary}15` };
      case "blocked":
        return { label: "Blocked", icon: "slash" as const, color: colors.danger, bg: `${colors.danger}15` };
      default:
        return { label: u.private_locked ? "Private" : "Open", icon: u.private_locked ? ("lock" as const) : ("globe" as const), color: u.private_locked ? colors.mutedFg : colors.primary, bg: u.private_locked ? `${colors.mutedFg}15` : `${colors.primary}15` };
    }
  })();

  /* ── Main profile ── */
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ═══════════════ COVER ═══════════════ */}
        <View style={[styles.cover, { height: COVER_H, backgroundColor: colors.surfaceHigh }]}>
          {u.cover_picture ? (
            <Image source={{ uri: u.cover_picture }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <CoverWatermark />
          )}

          {/* Top bar */}
          <View style={styles.coverTopBar}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.coverBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.coverTopRight}>
              <TouchableOpacity onPress={() => setMoreOpen(v => !v)} style={[styles.coverBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="more-horizontal" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* More dropdown */}
          {moreOpen && (
            <Animated.View
              entering={FadeIn.duration(120)}
              style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMoreOpen(false); handleShare(); }}>
                <Feather name="share-2" size={14} color={colors.foreground} />
                <NxText style={[styles.dropdownText, { color: colors.foreground }]}>Share</NxText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dropdownItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]} onPress={() => { setMoreOpen(false); handleReport(); }}>
                <Feather name="flag" size={14} color={colors.danger} />
                <NxText style={[styles.dropdownText, { color: colors.danger }]}>Report</NxText>
              </TouchableOpacity>
              {u.relation !== "blocked" && (
                <TouchableOpacity
                  style={[styles.dropdownItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  onPress={() => { setMoreOpen(false); act("/friends/block"); }}
                >
                  <Feather name="slash" size={14} color={colors.danger} />
                  <NxText style={[styles.dropdownText, { color: colors.danger }]}>Block</NxText>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
        </View>

        {/* ═══════════════ IDENTITY CARD ═══════════════ */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Animated.View entering={FadeInDown.duration(400)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                activeOpacity={hasStory ? 0.85 : 1}
                disabled={!hasStory}
                onPress={() => router.push(`/story/${resolvedId}`)}
              >
                <View style={[styles.avatarRing, { borderColor: colors.background }]}>
                  <Avatar
                    uri={u.profile_picture}
                    name={u.display_name}
                    size={AVATAR_SIZE}
                    frame={u.profile_frame}
                    achievement={u.achievement_level}
                    animation={u.profile_animation}
                    animationSpeed={u.profile_animation_speed}
                    animationIntensity={u.profile_animation_intensity}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Name + badge */}
            <View style={styles.nameRow}>
              <NxText style={[styles.displayName, { color: colors.foreground }]}>{u.display_name}</NxText>
              <VerifiedBadge badgeType={u.badge_type} badgeIcon={u.badge_icon} badgeExpiresAt={u.badge_expires_at} verifiedSince={u.verified_since} showInfo size={16} />
            </View>
            <NxText style={[styles.username, { color: colors.mutedFg }]}>@{u.username}</NxText>

            {/* Bio */}
            {!u.private_locked && u.bio ? (
              <NxText style={[styles.bio, { color: colors.foreground }]}>{u.bio}</NxText>
            ) : null}

            {/* Status */}
            {!u.private_locked && u.status_text ? (
              <View style={[styles.statusPill, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                <View style={[styles.statusDot, { backgroundColor: colors.primary }]}>
                  <Feather name="edit-3" size={9} color={colors.onPrimary} />
                </View>
                <AnimatedStatusText color={colors.foreground} style={{ flexShrink: 1, fontSize: 12, lineHeight: 16 }}>
                  {u.status_text}
                </AnimatedStatusText>
              </View>
            ) : null}

            {/* Joined + Birthday inline */}
            {(!u.private_locked && (joinedDate || u.birthday)) ? (
              <View style={styles.infoRow}>
                {joinedDate && (
                  <View style={styles.infoItem}>
                    <Feather name="calendar" size={11} color={colors.mutedFg} />
                    <NxText style={[styles.infoText, { color: colors.mutedFg }]}>Joined {joinedDate}</NxText>
                  </View>
                )}
                {u.birthday && (
                  <View style={styles.infoItem}>
                    <BirthdayGift color={colors.primary} />
                    <NxText style={[styles.infoText, { color: colors.mutedFg }]}>
                      {new Date(`${u.birthday}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </NxText>
                  </View>
                )}
              </View>
            ) : null}

            {/* Online */}
            {u.online ? (
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <NxText style={[styles.onlineText, { color: "#23A55A" }]}>Online now</NxText>
              </View>
            ) : null}

            {/* Website */}
            {!u.private_locked && u.website ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(u.website.startsWith("http") ? u.website : `https://${u.website}`)}
                style={[styles.linkPill, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
              >
                <Feather name="link" size={11} color={colors.primary} />
                <NxText style={[styles.linkText, { color: colors.primary }]}>
                  {u.website.replace(/^https?:\/\//, "")}
                </NxText>
              </TouchableOpacity>
            ) : null}

            {/* Mutual bonds */}
            {!u.private_locked && (u.mutual_bonds_count ?? 0) > 0 ? (
              <View style={styles.mutualRow}>
                <View style={styles.mutualAvatars}>
                  {(u.mutual_bonds_preview || []).slice(0, 3).map((person: any, index: number) => (
                    <View
                      key={person.user_id}
                      style={[styles.mutualAvatar, { marginLeft: index === 0 ? 0 : -6, zIndex: 3 - index, borderColor: colors.surface }]}
                    >
                      <Avatar uri={person.profile_picture} name={person.display_name} size={20} />
                    </View>
                  ))}
                </View>
                <NxText style={[styles.mutualText, { color: colors.mutedFg }]}>
                  {u.mutual_bonds_count} mutual {u.mutual_bonds_count === 1 ? "bond" : "bonds"}
                </NxText>
              </View>
            ) : null}
          </Animated.View>

          {/* ═══════════════ STATS ═══════════════ */}
          {!u.private_locked ? (
            <Animated.View entering={FadeIn.delay(80).duration(400)} style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <StatItem value={u.friend_count ?? 0} label="Bonds" color={colors.primary} muted={colors.mutedFg} />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <StatItem value={u.story_count ?? 0} label="Reveries" color="#7a00ff" muted={colors.mutedFg} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(80).duration(400)}>
              <View style={[styles.privateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.privateIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="lock" size={22} color={colors.primary} />
                </View>
                <NxText style={[styles.privateTitle, { color: colors.foreground }]}>Private Account</NxText>
                <NxText style={[styles.privateDesc, { color: colors.mutedFg }]}>
                  Only approved bonds can see this profile's content.
                </NxText>
                <View style={[styles.privateHint, { backgroundColor: colors.surfaceHigh }]}>
                  <Feather name="user-plus" size={13} color={colors.primary} />
                  <NxText style={[styles.privateHintText, { color: colors.foreground }]}>
                    Send a bond request to follow
                  </NxText>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ═══════════════ STORY GALLERY ═══════════════ */}
          {storyImages.length > 0 && (
            <Animated.View entering={FadeIn.delay(120).duration(400)}>
              <View style={styles.sectionHeader}>
                <Feather name="image" size={12} color={colors.mutedFg} />
                <NxText style={[styles.sectionTitle, { color: colors.mutedFg }]}>RECENT REVERIES</NxText>
                <TouchableOpacity onPress={() => router.push(`/story/${resolvedId}`)} style={{ marginLeft: "auto" }}>
                  <NxText style={[styles.viewAll, { color: colors.primary }]}>View all</NxText>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.galleryRow}>
                  {storyImages.map((uri, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => router.push(`/story/${resolvedId}`)}
                      style={[styles.galleryThumb, { borderColor: colors.border, backgroundColor: colors.surfaceHigh }]}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          )}

          {/* ═══════════════ ACTIONS ═══════════════ */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            {effectiveRelation === "friend" ? (
              <View style={[styles.actionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <PrimaryButton colors={colors} icon="message-circle" label="Message" onPress={openChat} />
                <View style={styles.secondaryRow}>
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => {
                      Alert.alert(
                        "Unfriend?",
                        `Unfriend @${u.username}? They'll no longer be your bond and you can send a new request later.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Unfriend", style: "destructive", onPress: () => act("/friends/unfriend") },
                        ]
                      );
                    }}
                    style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  >
                    {busy ? <ActivityIndicator size="small" color={colors.foreground} /> : <Feather name="user-minus" size={14} color={colors.foreground} />}
                    <NxText style={[styles.secondaryText, { color: colors.foreground }]}>{busy ? "Unfriending…" : "Unfriend"}</NxText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : effectiveRelation === "requested" ? (
              <View style={[styles.actionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity disabled={busy} onPress={() => act("/friends/cancel")} style={[styles.secondaryBtn, { borderColor: "#F0B232" + "33" }]}>
                  {busy ? <ActivityIndicator size="small" color="#F0B232" /> : <Feather name="clock" size={14} color="#F0B232" />}
                  <NxText style={[styles.secondaryText, { color: "#F0B232" }]}>{busy ? "Cancelling…" : "Cancel Request"}</NxText>
                </TouchableOpacity>
              </View>
            ) : effectiveRelation === "incoming" ? (
              <View style={[styles.actionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <PrimaryButton colors={colors} icon="user-check" label={busy ? "Accepting…" : "Accept Bond"} onPress={() => act("/friends/accept")} disabled={busy} loading={busy} />
                <TouchableOpacity disabled={busy} onPress={() => act("/friends/reject")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                  {busy ? <ActivityIndicator size="small" color={colors.foreground} /> : <Feather name="x" size={14} color={colors.foreground} />}
                  <NxText style={[styles.secondaryText, { color: colors.foreground }]}>{busy ? "Declining…" : "Decline"}</NxText>
                </TouchableOpacity>
              </View>
            ) : effectiveRelation === "blocked" ? (
              <View style={[styles.actionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity disabled={busy} onPress={() => act("/friends/unblock")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                  {busy ? <ActivityIndicator size="small" color={colors.foreground} /> : <Feather name="slash" size={14} color={colors.foreground} />}
                  <NxText style={[styles.secondaryText, { color: colors.foreground }]}>{busy ? "Unblocking…" : "Unblock"}</NxText>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.actionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <PrimaryButton colors={colors} icon="user-plus" label={busy ? "Sending…" : "Send Bond Request"} onPress={() => act("/friends/request")} disabled={busy} loading={busy} />
                {!u.private_locked && (
                  <PrimaryButton colors={colors} icon="message-circle" label="Message" onPress={openChat} />
                )}
              </View>
            )}
          </Animated.View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function StatItem({ value, label, color, muted }: { value: any; label: string; color: string; muted: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <NxText style={[styles.statValue, { color }]}>{String(value)}</NxText>
      <NxText style={[styles.statLabel, { color: muted }]}>{label}</NxText>
    </View>
  );
}

function PrimaryButton({
  colors, icon, label, onPress, disabled, loading,
}: {
  colors: any;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const pressed = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value ? 0.97 : 1, { duration: 120 }) }],
  }));

  return (
    <Pressable disabled={disabled} onPress={onPress} onPressIn={() => { pressed.value = 1; }} onPressOut={() => { pressed.value = 0; }}>
      <Animated.View style={[styles.primaryBtn, animStyle]}>
        <LinearGradient
          colors={disabled ? [colors.surfaceHigh, colors.surfaceHigh] : [colors.primary, colors.primaryDeep]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {loading ? (
          <ActivityIndicator size="small" color={disabled ? colors.mutedFg : colors.onPrimary} />
        ) : (
          <Feather name={icon} size={15} color={disabled ? colors.mutedFg : colors.onPrimary} />
        )}
        <NxText style={[styles.primaryText, { color: disabled ? colors.mutedFg : colors.onPrimary }]}>
          {label}
        </NxText>
      </Animated.View>
    </Pressable>
  );
}

function BirthdayGift({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.15, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true);
  }, []);
  return (
    <Animated.View style={useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))}>
      <Feather name="gift" size={13} color={color} />
    </Animated.View>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  // Header
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.bodySemi, fontSize: 16 },

  // Not found
  notFoundBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: 80 },
  notFoundIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  notFoundTitle: { fontFamily: fonts.display, fontSize: 20, marginTop: 16 },
  notFoundSub: { fontFamily: fonts.body, fontSize: 13, marginTop: 8, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  // Cover
  cover: { position: "relative", overflow: "hidden" },
  coverTopBar: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  coverTopRight: { flexDirection: "row", gap: 8 },
  coverBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Dropdown
  dropdown: {
    position: "absolute",
    top: 56,
    right: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 140,
    zIndex: 100,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: { fontFamily: fonts.bodyMedium, fontSize: 13 },

  // Card
  card: {
    marginTop: -40,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: "center",
  },

  // Avatar
  avatarContainer: { alignItems: "center", marginTop: -AVATAR_SIZE / 2 + 8 },
  avatarRing: {
    padding: 3,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    backgroundColor: "transparent",
  },

  // Identity
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  displayName: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 0.3,
  },
  username: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  // Bio
  bio: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },

  // Status
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Info row (joined + birthday inline)
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoText: { fontFamily: fonts.bodyMedium, fontSize: 12 },

  // Online
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#23A55A" },
  onlineText: { fontFamily: fonts.bodyMedium, fontSize: 12 },

  // Link
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 11 },

  // Mutual
  mutualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  mutualAvatars: { flexDirection: "row", alignItems: "center" },
  mutualAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mutualText: { fontFamily: fonts.bodySemi, fontSize: 11 },

  // Stats
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing.lg,
  },
  statValue: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.5 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, marginTop: 3, letterSpacing: 0.6, textTransform: "uppercase" },
  statDivider: { width: 1, height: 34 },

  // Private
  privateCard: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 28,
    alignItems: "center",
    overflow: "hidden",
  },
  privateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  privateTitle: { fontFamily: fonts.display, fontSize: 17, marginTop: 14 },
  privateDesc: { fontFamily: fonts.body, fontSize: 12, marginTop: 6, textAlign: "center", maxWidth: 260, lineHeight: 18 },
  privateHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  privateHintText: { fontFamily: fonts.bodyMedium, fontSize: 12 },

  // Gallery
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xl,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 10, fontFamily: fonts.bodySemi, letterSpacing: 1, textTransform: "uppercase" },
  viewAll: { fontSize: 12, fontFamily: fonts.bodySemi },
  galleryRow: { flexDirection: "row", gap: 8 },
  galleryThumb: {
    width: 88,
    height: 118,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
  },

  // Actions
  actionsCard: {
    marginTop: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  secondaryRow: { flexDirection: "row", gap: 8 },
  primaryBtn: {
    height: 46,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
});
