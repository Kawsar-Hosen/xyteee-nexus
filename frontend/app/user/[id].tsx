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
  const relationMeta = (() => {
    switch (u.relation) {
      case "friend":
        return { label: "Bonded", icon: "heart", color: colors.primary };
      case "requested":
        return { label: "Request sent", icon: "clock", color: "#F0B232" };
      case "incoming":
        return { label: "Wants to bond", icon: "user-plus", color: colors.primary };
      case "blocked":
        return { label: "Blocked", icon: "slash", color: colors.danger };
      default:
        return { label: u.private_locked ? "Private profile" : "Open profile", icon: u.private_locked ? "lock" : "globe", color: u.private_locked ? colors.mutedFg : colors.primary };
    }
  })();

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
          <View style={[styles.coverOrbLg, { backgroundColor: `${colors.primary}30` }]} />
          <View style={[styles.coverOrbSm, { backgroundColor: `${colors.primaryDeep}40` }]} />
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
          <View style={[styles.coverMetaCard, { backgroundColor: colors.glass, borderColor: "rgba(255,255,255,0.16)" }]}> 
            <View style={{ flex: 1 }}>
              <NxText style={styles.coverMetaKicker}>PROFILE</NxText>
              <NxText style={styles.coverMetaName} numberOfLines={1}>@{u.username}</NxText>
            </View>
            <View style={[styles.coverMetaStatus, { backgroundColor: u.private_locked ? "rgba(255,255,255,0.12)" : "rgba(35,165,90,0.18)" }]}> 
              {!u.private_locked && u.online ? (
                <View style={styles.coverMetaDot} />
              ) : (
                <Feather name={u.private_locked ? "lock" : "user"} size={11} color="#fff" />
              )}
              <NxText style={styles.coverMetaStatusText}>
                {u.private_locked ? "Private" : u.online ? "Online" : "Profile"}
              </NxText>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>

          <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            {/* Avatar — plain, no RGB gradient ring */}
            <View style={styles.profileTopRow}>
              <TouchableOpacity
                activeOpacity={hasStory ? 0.85 : 1}
                disabled={!hasStory}
                onPress={() => router.push(`/story/${id}`)}
                style={styles.avatarWrap}
              >
                <View style={{ padding: 3, borderRadius: 54, backgroundColor: colors.background }}>
                  <Avatar uri={u.profile_picture} name={u.display_name} size={100} frame={u.profile_frame} achievement={u.achievement_level} animation={u.profile_animation} animationSpeed={u.profile_animation_speed} animationIntensity={u.profile_animation_intensity} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.relationBadge, { backgroundColor: `${relationMeta.color}18`, borderColor: `${relationMeta.color}2E` }]}> 
              <Feather name={relationMeta.icon as any} size={12} color={relationMeta.color} />
              <NxText style={{ marginLeft: 6, color: relationMeta.color, fontFamily: fonts.bodySemi, fontSize: 12 }}>
                {relationMeta.label}
              </NxText>
            </View>

            {/* Name + username + bio */}
            <View style={styles.identityBlock}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <NxText variant="title" style={{ flexShrink: 1, textAlign: "center" }}>{u.display_name}</NxText>
                <VerifiedBadge badgeType={u.badge_type} badgeIcon={u.badge_icon} badgeExpiresAt={u.badge_expires_at} verifiedSince={u.verified_since} showInfo size={18} />
              </View>
              <NxText variant="bodySm" style={{ color: colors.mutedFg, textAlign: "center" }}>@{u.username}</NxText>

              {!u.private_locked && u.bio ? (
                <NxText style={{ fontSize: 14, lineHeight: 21, textAlign: "center", color: colors.foreground, marginTop: 8, paddingHorizontal: 8 }}>
                  {u.bio}
                </NxText>
              ) : null}

              {!u.private_locked && u.status_text ? (
                <View style={[styles.notePill, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}> 
                  <View style={[styles.notePillIcon, { backgroundColor: colors.primary }]}> 
                    <Feather name="edit-3" size={11} color={colors.onPrimary} />
                  </View>
                  <AnimatedStatusText color={colors.foreground} style={{ flexShrink: 1, fontSize: 13, lineHeight: 18 }}>
                    {u.status_text}
                  </AnimatedStatusText>
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" }}>
              <View style={[styles.chip, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}> 
                <Feather name="at-sign" size={11} color={colors.mutedFg} />
                <NxText style={{ fontSize: 12, color: colors.mutedFg, marginLeft: 4 }}>Public profile</NxText>
              </View>
              {joinedDate && (
                <View style={[styles.chip, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}> 
                  <Feather name="calendar" size={11} color={colors.mutedFg} />
                  <NxText style={{ fontSize: 12, color: colors.mutedFg, marginLeft: 4 }}>Joined {joinedDate}</NxText>
                </View>
              )}
              {u.online && (
                <View style={[styles.chip, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}> 
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#23A55A", marginRight: 4 }} />
                  <NxText style={{ fontSize: 12, color: "#23A55A" }}>Active now</NxText>
                </View>
              )}
            </View>

            {!u.private_locked && u.website ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(u.website.startsWith("http") ? u.website : `https://${u.website}`)}
                style={[styles.linkRow, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}
              >
                <Feather name="link" size={13} color={colors.primary} />
                <NxText style={{ marginLeft: 6, color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 13 }}>
                  {u.website.replace(/^https?:\/\//, "")}
                </NxText>
              </TouchableOpacity>
            ) : null}

            {!u.private_locked && u.birthday ? (
              <Animated.View entering={FadeInDown.duration(650).springify()} style={styles.metaLine}>
                <BirthdayGift color={colors.primary} />
                <NxText variant="bodySm" style={{ marginLeft: 8, color: colors.mutedFg, fontFamily: fonts.bodyMedium }}>
                  {new Date(`${u.birthday}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </NxText>
              </Animated.View>
            ) : null}

            {!u.private_locked && (u.mutual_bonds_count ?? 0) > 0 ? (
              <View style={styles.mutualRow}>
                <View style={styles.mutualAvatars}>
                  {(u.mutual_bonds_preview || []).slice(0, 3).map((person: any, index: number) => (
                    <View
                      key={person.user_id}
                      style={[styles.mutualAvatarWrap, { marginLeft: index === 0 ? 0 : -7, zIndex: 3 - index, borderColor: colors.surface }]}
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
          </Animated.View>

          {/* Stats or Private */}
          {!u.private_locked ? (
            <Animated.View entering={FadeIn.delay(100).duration(400)} style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <StatItem icon="users" label="Bonds" value={u.friend_count ?? 0} color={colors.primary} />
              <View style={{ width: 1, height: 36, backgroundColor: colors.border }} />
              <StatItem icon="image" label="Reveries" value={u.story_count ?? 0} color="#7a00ff" />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(500).springify()}>
              <View style={[styles.privateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <LinearGradient
                  colors={[colors.surface, colors.surfaceHigh, `${colors.primary}10`]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={[styles.privateBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}2C` }]}> 
                  <Feather name="shield" size={12} color={colors.primary} />
                  <NxText style={{ marginLeft: 6, color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 12 }}>
                    Protected Space
                  </NxText>
                </View>
                <View style={styles.privateIcon}>
                  <LinearGradient
                    colors={[colors.primary, colors.primaryDeep]}
                    style={styles.privateIconGrad}
                  >
                    <Feather name="lock" size={26} color={colors.onPrimary} />
                  </LinearGradient>
                </View>
                <NxText variant="title" style={{ marginTop: 16 }}>This account is private</NxText>
                <NxText variant="bodySm" style={{ marginTop: 8, color: colors.mutedFg, textAlign: "center", maxWidth: 290, lineHeight: 20 }}>
                  @{u.username} keeps their profile locked. Only approved Bonds can see their reveries, info and activity.
                </NxText>
                <View style={[styles.privateHint, { backgroundColor: colors.surfaceHigh }]}> 
                  <Feather name="user-plus" size={13} color={colors.primary} />
                  <NxText style={{ marginLeft: 7, color: colors.foreground, fontFamily: fonts.bodyMedium, fontSize: 13 }}>
                    Send a bond request to follow
                  </NxText>
                </View>
              </View>
            </Animated.View>
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
            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <PrimaryActionButton
                colors={colors}
                icon="message-circle"
                label="Message"
                onPress={openChat}
              />
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
            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <TouchableOpacity disabled={busy} onPress={() => act("/friends/cancel")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}> 
                <Feather name="clock" size={16} color={colors.foreground} style={{ marginRight: 8 }} />
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Request sent · Cancel</NxText>
              </TouchableOpacity>
            </View>
          ) : u.relation === "incoming" ? (
            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <PrimaryActionButton
                colors={colors}
                icon="user-check"
                label="Accept Bond Request"
                onPress={() => act("/friends/accept")}
                disabled={busy}
              />
              <TouchableOpacity disabled={busy} onPress={() => act("/friends/reject")} style={[styles.secondaryBtn, { borderColor: colors.border }]}> 
                <Feather name="x" size={16} color={colors.foreground} style={{ marginRight: 6 }} />
                <NxText style={{ fontFamily: fonts.bodyMedium, color: colors.foreground }}>Decline</NxText>
              </TouchableOpacity>
            </View>
          ) : u.relation === "blocked" ? (
            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <TouchableOpacity disabled={busy} onPress={() => act("/friends/unblock")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}> 
                <Feather name="slash" size={16} color={colors.foreground} style={{ marginRight: 8 }} />
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Unblock</NxText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.actionPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <PrimaryActionButton
                colors={colors}
                icon="user-plus"
                label="Send Bond Request"
                onPress={() => act("/friends/request")}
                disabled={busy}
              />
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

function PrimaryActionButton({
  colors,
  icon,
  label,
  onPress,
  disabled,
}: {
  colors: any;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value ? 0.97 : 1, { duration: 120 }) }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { pressed.value = 1; }}
      onPressOut={() => { pressed.value = 0; }}
      style={styles.primaryBtnWrap}
    >
      <Animated.View style={[styles.primaryBtn, animatedStyle]}>
        <LinearGradient
          colors={disabled ? [colors.surfaceHigh, colors.surfaceHigh] : [colors.primary, colors.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.primaryBtnInnerGlow, { backgroundColor: disabled ? "transparent" : "rgba(255,255,255,0.12)" }]} />
        <Feather name={icon} size={16} color={disabled ? colors.mutedFg : colors.onPrimary} style={{ marginRight: 8 }} />
        <NxText style={{ color: disabled ? colors.mutedFg : colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 15 }}>
          {label}
        </NxText>
      </Animated.View>
    </Pressable>
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
  coverOrbLg: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 999,
    top: -36,
    right: -30,
    opacity: 0.6,
  },
  coverOrbSm: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 999,
    bottom: 40,
    left: -18,
    opacity: 0.45,
  },
  coverMetaCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 14,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  coverMetaKicker: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 3,
  },
  coverMetaName: {
    color: "#fff",
    fontFamily: fonts.display,
    fontSize: 18,
  },
  coverMetaStatus: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  coverMetaDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#23A55A",
  },
  coverMetaStatusText: {
    color: "#fff",
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  moreMenu: { position: "absolute", borderRadius: radii.md, borderWidth: 1, minWidth: 160, zIndex: 100, overflow: "hidden" },
  moreItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  heroCard: {
    marginTop: -48,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  profileTopRow: { alignItems: "center", marginTop: -54 },
  avatarWrap: { width: 116, height: 116, borderRadius: 58, alignItems: "center", justifyContent: "center" },
  relationBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  identityBlock: { alignItems: "center", marginTop: 12, paddingHorizontal: 16 },
  notePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    marginTop: 10,
    maxWidth: "88%",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  notePillIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  linkRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaLine: { marginTop: 10, flexDirection: "row", alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1 },
  mutualRow: { flexDirection: "row", alignItems: "center", marginTop: 12, alignSelf: "flex-start" },
  mutualAvatars: { flexDirection: "row", alignItems: "center" },
  mutualAvatarWrap: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  statsRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg },
  privateCard: { marginTop: spacing.xl, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: 30, alignItems: "center", overflow: "hidden" },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  privateIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  privateIconGrad: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  privateHint: { flexDirection: "row", alignItems: "center", marginTop: 18, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill },
  galleryThumb: { width: 100, height: 130, borderRadius: radii.md, overflow: "hidden", borderWidth: 1, backgroundColor: "#111" },
  actionPanel: { gap: 10, borderWidth: 1, borderRadius: radii.xl, padding: 14 },
  primaryBtnWrap: { borderRadius: radii.pill },
  primaryBtn: {
    height: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryBtnInnerGlow: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    height: "52%",
    borderRadius: 999,
  },
  secondaryBtn: { height: 48, borderRadius: radii.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 16 },
});
