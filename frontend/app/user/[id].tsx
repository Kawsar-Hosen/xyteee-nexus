import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Image, Share, Alert, Linking,
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
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { AnimatedStatusText } from "@/src/components/AnimatedStatusText";
import { fonts, radii, spacing } from "@/src/theme";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [u, setU] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasStory, setHasStory] = useState(false);
  const [storyImages, setStoryImages] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);

  const storyRingRotation = useSharedValue(0);

  useEffect(() => {
    storyRingRotation.value = hasStory
      ? withRepeat(withTiming(360, { duration: 3000 }), -1, false)
      : 0;
  }, [hasStory]);

  const storyRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${storyRingRotation.value}deg` }],
  }));

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setNotFound(false);
      const r = await api<any>(`/users/${id}`, { token });
      setU(r);
      try {
        const storyResult = await api<{ feed: any[] }>("/stories/feed", { token });
        const group = (storyResult.feed || []).find(
          (g: any) => g.user?.user_id === id && (g.stories || []).length > 0
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
    try {
      await api(path, { method: "POST", body: { user_id: id }, token: token! });
      load();
    } finally { setBusy(false); }
  };

  const openChat = async () => {
    const r = await api<{ conversation: any }>("/chats/open", { method: "POST", body: { user_id: id }, token: token! });
    router.push(`/chat/${r.conversation.conversation_id}`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out @${u?.username} on Xyteee!\nhttps://xyteee.app/user/${id}`,
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
        <View style={[styles.notFoundHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <NxText variant="titleSm">Profile</NxText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.notFoundBody}>
          <View style={[styles.notFoundAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="user" size={42} color={colors.mutedFg} />
          </View>
          <NxText variant="title" style={{ marginTop: 18 }}>User Not Found</NxText>
          <NxText variant="bodySm" style={{ marginTop: 8, color: colors.mutedFg, textAlign: "center", maxWidth: 280 }}>
            This profile is unavailable or has been removed.
          </NxText>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Loading ── */
  if (!u) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const joinedDate = u.created_at
    ? new Date(u.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  /* ── Main profile ── */
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Cover */}
        <View style={styles.cover}>
          {u.cover_picture ? (
            <Image source={{ uri: u.cover_picture }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={StyleSheet.absoluteFillObject} />
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.4)"]}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: colors.glass, position: "absolute", top: spacing.md, left: spacing.md }]}
          >
            <Feather name="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Share + More */}
          <View style={{ position: "absolute", top: spacing.md, right: spacing.md, flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={handleShare} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
              <Feather name="share-2" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMoreOpen(v => !v)} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
              <Feather name="more-horizontal" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* More dropdown */}
          {moreOpen && (
            <Animated.View
              entering={FadeIn.duration(150)}
              style={[styles.moreMenu, { backgroundColor: colors.surface, borderColor: colors.border, top: spacing.md + 46, right: spacing.md }]}
            >
              <TouchableOpacity
                style={styles.moreItem}
                onPress={() => { setMoreOpen(false); handleReport(); }}
              >
                <Feather name="flag" size={15} color={colors.danger} />
                <NxText style={{ marginLeft: 10, color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 14 }}>
                  Report
                </NxText>
              </TouchableOpacity>
              {u.relation !== "blocked" && (
                <TouchableOpacity
                  style={[styles.moreItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  onPress={() => { setMoreOpen(false); act("/friends/block"); }}
                >
                  <Feather name="slash" size={15} color={colors.danger} />
                  <NxText style={{ marginLeft: 10, color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 14 }}>
                    Block
                  </NxText>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>

          {/* Avatar + Status */}
          <View style={styles.profileTopRow}>
            <TouchableOpacity
              activeOpacity={hasStory ? 0.85 : 1}
              disabled={!hasStory}
              onPress={() => router.push(`/story/${id}`)}
              style={{ marginTop: -50, width: hasStory ? 108 : 100, height: hasStory ? 108 : 100, alignItems: "center", justifyContent: "center" }}
            >
              {hasStory ? (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[{ position: "absolute", width: 108, height: 108, borderRadius: 54, overflow: "hidden" }, storyRingStyle]}
                  >
                    <LinearGradient
                      colors={["#ff004c", "#ffea00", "#00ff85", "#00c8ff", "#7a00ff", "#ff00c8", "#ff004c"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </Animated.View>
                  <View style={{ padding: 2, borderRadius: 52, backgroundColor: colors.background }}>
                    <Avatar uri={u.profile_picture} name={u.display_name} size={100} online={u.online} onlineStatus={u.online_status || "online"} />
                  </View>
                </>
              ) : (
                <Avatar uri={u.profile_picture} name={u.display_name} size={100} online={u.online} onlineStatus={u.online_status || "online"} />
              )}
            </TouchableOpacity>

            {!u.private_locked && u.status_text ? (
              <View style={styles.statusWrap}>
                <View style={[styles.thoughtDotSmall, { backgroundColor: colors.surface }]} />
                <View style={[styles.thoughtDotLarge, { backgroundColor: colors.surface }]} />
                <View style={[styles.statusBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.statusPlus, { backgroundColor: colors.mutedFg }]}>
                    <Feather name="plus" size={12} color={colors.background} />
                  </View>
                  <AnimatedStatusText color={colors.foreground} style={{ flexShrink: 1 }}>
                    {u.status_text}
                  </AnimatedStatusText>
                </View>
              </View>
            ) : null}
          </View>

          {/* Name + username */}
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="title" style={{ flexShrink: 1 }}>{u.display_name}</NxText>
              <VerifiedBadge badgeType={u.badge_type} verifiedSince={u.verified_since} showInfo size={18} />
            </View>
            <NxText variant="bodySm" style={{ color: colors.mutedFg }}>@{u.username}</NxText>
          </Animated.View>

          {/* Info chips */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {joinedDate && (
              <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="calendar" size={11} color={colors.mutedFg} />
                <NxText style={{ fontSize: 12, color: colors.mutedFg, marginLeft: 4 }}>Joined {joinedDate}</NxText>
              </View>
            )}
            {u.online && (
              <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#23A55A", marginRight: 4 }} />
                <NxText style={{ fontSize: 12, color: "#23A55A" }}>Active now</NxText>
              </View>
            )}
          </View>

          {/* Bio */}
          {!u.private_locked && u.bio ? (
            <NxText variant="body" style={{ marginTop: spacing.md, lineHeight: 22 }}>
              {u.bio}
            </NxText>
          ) : null}

          {/* Website */}
          {!u.private_locked && u.website ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(u.website.startsWith("http") ? u.website : `https://${u.website}`)}
              style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}
            >
              <Feather name="link" size={13} color={colors.primary} />
              <NxText style={{ marginLeft: 6, color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 13 }}>
                {u.website.replace(/^https?:\/\//, "")}
              </NxText>
            </TouchableOpacity>
          ) : null}

          {/* Birthday */}
          {!u.private_locked && u.birthday ? (
            <Animated.View entering={FadeInDown.duration(650).springify()} style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
              <BirthdayGift color={colors.primary} />
              <NxText variant="bodySm" style={{ marginLeft: 8, color: colors.mutedFg, fontFamily: fonts.bodyMedium }}>
                {new Date(`${u.birthday}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </NxText>
            </Animated.View>
          ) : null}

          {/* Mutual bonds */}
          {!u.private_locked && (u.mutual_bonds_count ?? 0) > 0 ? (
            <View style={styles.mutualRow}>
              <View style={styles.mutualAvatars}>
                {(u.mutual_bonds_preview || []).slice(0, 3).map((person: any, index: number) => (
                  <View
                    key={person.user_id}
                    style={[styles.mutualAvatarWrap, { marginLeft: index === 0 ? 0 : -7, zIndex: 3 - index, borderColor: colors.background }]}
                  >
                    <Avatar uri={person.profile_picture} name={person.display_name} size={22} />
                  </View>
                ))}
              </View>
              <NxText variant="bodySm" style={{ marginLeft: 7, color: colors.mutedFg, fontFamily: fonts.bodySemi }}>
                {u.mutual_bonds_count} Mutual {u.mutual_bonds_count === 1 ? "Bond" : "Bonds"}
              </NxText>
            </View>
          ) : null}

          {/* Stats or Private */}
          {!u.private_locked ? (
            <Animated.View entering={FadeIn.delay(100).duration(400)} style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <StatItem icon="users" label="Bonds" value={u.friend_count ?? 0} color={colors.primary} />
              <View style={{ width: 1, height: 36, backgroundColor: colors.border }} />
              <StatItem icon="image" label="Reveries" value={u.story_count ?? 0} color="#7a00ff" />
            </Animated.View>
          ) : (
            <View style={[styles.privateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.privateIcon, { backgroundColor: colors.surfaceHigh }]}>
                <Feather name="lock" size={24} color={colors.foreground} />
              </View>
              <NxText variant="titleSm" style={{ marginTop: 14 }}>Private Account</NxText>
              <NxText variant="bodySm" style={{ marginTop: 7, color: colors.mutedFg, textAlign: "center", maxWidth: 280 }}>
                Send a bond request to see their reveries and info.
              </NxText>
            </View>
          )}

          {/* Story gallery strip */}
          {storyImages.length > 0 && (
            <Animated.View entering={FadeIn.delay(200).duration(400)}>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.lg, marginBottom: 10 }}>
                <Feather name="image" size={13} color={colors.mutedFg} />
                <NxText style={{ marginLeft: 6, fontSize: 11, fontFamily: fonts.bodySemi, color: colors.mutedFg, letterSpacing: 0.6, textTransform: "uppercase" }}>
                  Recent Reveries
                </NxText>
                <TouchableOpacity onPress={() => router.push(`/story/${id}`)} style={{ marginLeft: "auto" }}>
                  <NxText style={{ fontSize: 12, color: colors.primary, fontFamily: fonts.bodySemi }}>View all</NxText>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg }}>
                {storyImages.map((uri, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => router.push(`/story/${id}`)}
                    style={[styles.galleryThumb, { borderColor: colors.border, marginRight: 8 }]}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Action buttons */}
          <View style={{ height: spacing.lg }} />

          {u.relation === "friend" ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={openChat}
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="message-circle" size={17} color={colors.onPrimary} style={{ marginRight: 8 }} />
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 15 }}>Message</NxText>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => act("/friends/unfriend")}
                  style={[styles.secondaryBtn, { flex: 1, borderColor: colors.border }]}
                >
                  <Feather name="user-minus" size={15} color={colors.foreground} style={{ marginRight: 6 }} />
                  <NxText style={{ fontFamily: fonts.bodyMedium, color: colors.foreground, fontSize: 14 }}>Unfriend</NxText>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={busy}
                  onPress={handleShare}
                  style={[styles.secondaryBtn, { flex: 1, borderColor: colors.border }]}
                >
                  <Feather name="share-2" size={15} color={colors.foreground} style={{ marginRight: 6 }} />
                  <NxText style={{ fontFamily: fonts.bodyMedium, color: colors.foreground, fontSize: 14 }}>Share</NxText>
                </TouchableOpacity>
              </View>
            </View>
          ) : u.relation === "requested" ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity disabled={busy} onPress={() => act("/friends/cancel")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}>
                <Feather name="clock" size={16} color={colors.foreground} style={{ marginRight: 8 }} />
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Request sent · Cancel</NxText>
              </TouchableOpacity>
            </View>
          ) : u.relation === "incoming" ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity disabled={busy} onPress={() => act("/friends/accept")} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
                <Feather name="user-check" size={16} color={colors.onPrimary} style={{ marginRight: 8 }} />
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Accept Bond Request</NxText>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={() => act("/friends/reject")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="x" size={16} color={colors.foreground} style={{ marginRight: 6 }} />
                <NxText style={{ fontFamily: fonts.bodyMedium, color: colors.foreground }}>Decline</NxText>
              </TouchableOpacity>
            </View>
          ) : u.relation === "blocked" ? (
            <TouchableOpacity disabled={busy} onPress={() => act("/friends/unblock")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}>
              <Feather name="slash" size={16} color={colors.foreground} style={{ marginRight: 8 }} />
              <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Unblock</NxText>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity disabled={busy} onPress={() => act("/friends/request")} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
                <Feather name="user-plus" size={16} color={colors.onPrimary} style={{ marginRight: 8 }} />
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Send Bond Request</NxText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="share-2" size={15} color={colors.foreground} style={{ marginRight: 6 }} />
                <NxText style={{ fontFamily: fonts.bodyMedium, color: colors.foreground }}>Share Profile</NxText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function StatItem({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Feather name={icon as any} size={16} color={color} style={{ marginBottom: 4 }} />
      <NxText variant="titleSm">{String(value)}</NxText>
      <NxText variant="caption" style={{ marginTop: 1 }}>{label}</NxText>
    </View>
  );
}

function BirthdayGift({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.18, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true);
  }, []);
  return (
    <Animated.View style={useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))}>
      <Feather name="gift" size={16} color={color} />
    </Animated.View>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  notFoundHeader: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  notFoundBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: 80 },
  notFoundAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cover: { height: 200, position: "relative" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  moreMenu: { position: "absolute", borderRadius: radii.md, borderWidth: 1, minWidth: 160, zIndex: 100, overflow: "hidden" },
  moreItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  profileTopRow: { height: 86, flexDirection: "row", alignItems: "flex-start" },
  statusWrap: { flex: 1, height: 78, marginLeft: 10, marginTop: -32, position: "relative", justifyContent: "flex-end" },
  statusBubble: { flexDirection: "row", alignItems: "center", width: "100%", minHeight: 58, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  thoughtDotSmall: { position: "absolute", left: -10, top: 7, width: 7, height: 7, borderRadius: 999, zIndex: 3 },
  thoughtDotLarge: { position: "absolute", left: 3, top: 16, width: 11, height: 11, borderRadius: 999, zIndex: 3 },
  statusPlus: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1 },
  mutualRow: { flexDirection: "row", alignItems: "center", marginTop: 10, alignSelf: "flex-start" },
  mutualAvatars: { flexDirection: "row", alignItems: "center" },
  mutualAvatarWrap: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  statsRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg },
  privateCard: { marginTop: spacing.xl, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: 28, alignItems: "center" },
  privateIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  galleryThumb: { width: 100, height: 130, borderRadius: radii.md, overflow: "hidden", borderWidth: 1, backgroundColor: "#111" },
  primaryBtn: { height: 52, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  secondaryBtn: { height: 48, borderRadius: radii.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 16 },
});
