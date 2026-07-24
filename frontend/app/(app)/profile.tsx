import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Image,
  Modal, Pressable, Share, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { AnimatedStatusText } from "@/src/components/AnimatedStatusText";
import { fonts, radii, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

const ADMIN_EMAIL = "smdkawsar2@gmail.com";
const APP_VERSION = "1.0.0";
const COVER_H = 230;
const AVATAR_SIZE = 92;

function getProfileCompletion(user: any) {
  const checks = [
    { key: "profile_picture", label: "Profile photo" },
    { key: "cover_picture", label: "Cover photo" },
    { key: "bio", label: "Bio" },
    { key: "birthday", label: "Birthday" },
    { key: "status_text", label: "Status" },
  ];
  const total = checks.length;
  const done = checks.filter((c) => !!user[c.key]).length;
  const missing = checks.filter((c) => !user[c.key]).map((c) => c.label);
  return { percent: Math.round((done / total) * 100), done, total, missing };
}

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();

  const [hasStory, setHasStory] = useState(false);
  const [storyImages, setStoryImages] = useState<string[]>([]);
  const [bondsCount, setBondsCount] = useState(0);
  const [reveriesCount, setReveriesCount] = useState(0);
  const [onlineSheetOpen, setOnlineSheetOpen] = useState(false);
  const [onlineStatusBusy, setOnlineStatusBusy] = useState(false);

  const storyRingRotation = useSharedValue(0);
  const completionWidth = useSharedValue(0);

  useEffect(() => {
    if (hasStory) {
      storyRingRotation.value = withRepeat(withTiming(360, { duration: 3000 }), -1, false);
    } else {
      storyRingRotation.value = 0;
    }
  }, [hasStory]);

  const storyRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${storyRingRotation.value}deg` }],
  }));

  const loadData = useCallback(async () => {
    if (!token || !user) return;
    try {
      const [storyResult, friendsResult] = await Promise.all([
        api<{ feed: any[] }>("/stories/feed", { token }),
        api<{ friends: any[] }>("/friends", { token }),
      ]);
      const myStoryGroup = (storyResult.feed || []).find(
        (g: any) => g.user?.user_id === user.user_id
      );
      const myStories = myStoryGroup?.stories || [];
      setHasStory(myStories.length > 0);
      setReveriesCount(myStories.length);
      setBondsCount((friendsResult.friends || []).length);
      const imgs = myStories
        .filter((s: any) => s.media_url || s.image_url)
        .map((s: any) => s.media_url || s.image_url)
        .slice(0, 6);
      setStoryImages(imgs);
    } catch {
      setHasStory(false);
      setReveriesCount(0);
      setBondsCount(0);
    }
  }, [token, user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!user) return;
    const { percent } = getProfileCompletion(user);
    completionWidth.value = withTiming(percent, { duration: 900 });
  }, [user]);

  const completionBarStyle = useAnimatedStyle(() => ({
    width: `${completionWidth.value}%`,
  }));

  if (!user) return null;

  const { percent: completionPct, missing: missingFields } = getProfileCompletion(user);

  const sinceValue = (() => {
    if (!user.created_at) return "New";
    const created = new Date(user.created_at);
    const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
    if (days <= 30) return "New";
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.max(1, Math.floor(days / 365))}y`;
  })();

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out @${user.username} on Xyteee!\nhttps://xyteee.app/user/${user.user_id}`,
        title: user.display_name,
      });
    } catch { /* cancelled */ }
  };

  const completionColor =
    completionPct >= 80 ? "#23A55A" :
    completionPct >= 50 ? "#F0B232" : colors.primary;

  const onlineStatusColor: Record<string, string> = {
    online: "#23A55A", idle: "#F0B232", dnd: "#F23F43", invisible: "#80848E",
  };
  const currentStatusColor = onlineStatusColor[user.online_status || "online"];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: DOCK_PAD + 16 }}>

        {/* ═══════════════ COVER ═══════════════ */}
        <View style={[styles.coverWrap, { height: COVER_H }]}>
          {user.cover_picture ? (
            <Image source={{ uri: user.cover_picture }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[colors.primaryDeep, colors.primary, `${colors.primary}55`]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          {/* Multi-layer overlay */}
          <LinearGradient
            colors={["rgba(0,0,0,0.18)", "transparent", "rgba(0,0,0,0.55)"]}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Bottom fade into background */}
          <LinearGradient
            colors={["transparent", colors.background]}
            start={{ x: 0, y: 0.6 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Header action buttons — settings only; share & theme are below */}
          <View style={styles.coverActions}>
            <View />
            <TouchableOpacity onPress={() => router.push("/settings")} style={[styles.glassBtn, { backgroundColor: "rgba(0,0,0,0.38)" }]}>
              <Feather name="settings" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══════════════ AVATAR + IDENTITY ═══════════════ */}
        <Animated.View entering={FadeInUp.duration(500).springify()} style={styles.identitySection}>

          {/* Avatar centred, overlapping cover */}
          <View style={styles.avatarRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => hasStory ? router.push(`/story/${user.user_id}`) : setOnlineSheetOpen(true)}
              onLongPress={() => setOnlineSheetOpen(true)}
              delayLongPress={400}
              style={styles.avatarWrap}
            >
              {/* Rotating story ring */}
              {hasStory && (
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, storyRingStyle]}>
                  <LinearGradient
                    colors={["#ff004c", "#ffea00", "#00ff85", "#00c8ff", "#7a00ff", "#ff00c8", "#ff004c"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ flex: 1, borderRadius: AVATAR_SIZE / 2 + 6 }}
                  />
                </Animated.View>
              )}
              {/* Gold ring always present */}
              {!hasStory && (
                <View style={[styles.avatarGoldRing, { borderColor: colors.primary }]} />
              )}
              <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                <Avatar
                  uri={user.profile_picture}
                  name={user.display_name}
                  size={AVATAR_SIZE}
                  online
                  onlineStatus={user.online_status || "online"}
                />
              </View>
              {/* Edit overlay badge */}
              <TouchableOpacity
                onPress={() => router.push("/settings/edit-profile")}
                style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}
              >
                <Feather name="camera" size={11} color={colors.onPrimary} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* Name + badge */}
          <View style={styles.nameRow}>
            <NxText style={[styles.displayName, { color: colors.foreground }]}>{user.display_name}</NxText>
            <VerifiedBadge badgeType={user.badge_type} verifiedSince={user.verified_since} showInfo size={18} />
          </View>
          <NxText style={[styles.username, { color: colors.mutedFg }]}>@{user.username}</NxText>

          {/* Online status pill */}
          <TouchableOpacity
            onPress={() => setOnlineSheetOpen(true)}
            activeOpacity={0.8}
            style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.statusDot, { backgroundColor: currentStatusColor }]} />
            <NxText style={[styles.statusPillText, { color: colors.foreground }]}>
              {user.online_status === "dnd" ? "Do Not Disturb"
                : user.online_status === "invisible" ? "Invisible"
                : user.online_status === "idle" ? "Idle"
                : "Online"}
            </NxText>
            <Feather name="chevron-down" size={13} color={colors.mutedFg} />
          </TouchableOpacity>
        </Animated.View>

        {/* ═══════════════ STATS ═══════════════ */}
        <Animated.View entering={FadeIn.delay(80).duration(500)} style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StatCol value={String(bondsCount)} label="Bonds" accent={colors.primary} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol value={String(reveriesCount)} label="Reveries" accent="#a78bfa" />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCol value={sinceValue} label="Since" accent={colors.mutedFg} />
        </Animated.View>

        {/* ═══════════════ ACTION ROW ═══════════════ */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.actionRow}>
          {/* Primary: Edit Profile — full width */}
          <TouchableOpacity
            onPress={() => router.push("/settings/edit-profile")}
            activeOpacity={0.82}
            style={[styles.actionPrimary, { backgroundColor: colors.primary }]}
          >
            <Feather name="edit-2" size={15} color={colors.onPrimary} />
            <NxText style={[styles.actionPrimaryLabel, { color: colors.onPrimary }]}>Edit Profile</NxText>
          </TouchableOpacity>

          {/* Secondary row: Alerts + Share */}
          <View style={styles.actionSecondaryRow}>
            <TouchableOpacity
              onPress={() => router.push("/notifications")}
              activeOpacity={0.82}
              style={[styles.actionSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Feather name="bell" size={15} color={colors.foreground} />
              <NxText style={[styles.actionSecondaryLabel, { color: colors.foreground }]}>Alerts</NxText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.82}
              style={[styles.actionSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Feather name="share-2" size={15} color={colors.foreground} />
              <NxText style={[styles.actionSecondaryLabel, { color: colors.foreground }]}>Share</NxText>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={[styles.bodyPad]}>

          {/* ═══════════════ BIO / DETAILS ═══════════════ */}
          <Animated.View entering={FadeInDown.delay(120).duration(450)} style={[styles.bioCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {user.bio ? (
              <NxText style={[styles.bioText, { color: colors.foreground }]}>{user.bio}</NxText>
            ) : (
              <TouchableOpacity onPress={() => router.push("/settings/edit-profile")} activeOpacity={0.7}>
                <NxText style={[styles.bioPlaceholder, { color: colors.mutedFg }]}>
                  + Add a bio to tell people about yourself
                </NxText>
              </TouchableOpacity>
            )}

            {/* Status thought bubble */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/settings/status")}
              style={[styles.statusBubbleRow, { borderColor: colors.border }]}
            >
              <View style={[styles.statusBubbleIcon, { backgroundColor: `${colors.primary}22` }]}>
                <Feather name="message-circle" size={13} color={colors.primary} />
              </View>
              <AnimatedStatusText color={user.status_text ? colors.foreground : colors.mutedFg} style={{ flex: 1, fontSize: 13, fontFamily: fonts.body }}>
                {user.status_text || "Set a status…"}
              </AnimatedStatusText>
              <Feather name="edit-2" size={12} color={colors.mutedFg} />
            </TouchableOpacity>

            {/* Meta row */}
            <View style={styles.metaRow}>
              {user.website ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(user.website.startsWith("http") ? user.website : `https://${user.website}`)}
                  style={styles.metaItem}
                >
                  <Feather name="link" size={13} color={colors.primary} />
                  <NxText style={[styles.metaText, { color: colors.primary }]}>
                    {user.website.replace(/^https?:\/\//, "")}
                  </NxText>
                </TouchableOpacity>
              ) : null}
              {user.birthday ? (
                <View style={styles.metaItem}>
                  <BirthdayGift color={colors.primary} />
                  <NxText style={[styles.metaText, { color: colors.mutedFg }]}>
                    {new Date(`${user.birthday}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </NxText>
                </View>
              ) : null}
              {joinedDate && (
                <View style={styles.metaItem}>
                  <Feather name="calendar" size={13} color={colors.mutedFg} />
                  <NxText style={[styles.metaText, { color: colors.mutedFg }]}>Joined {joinedDate}</NxText>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ═══════════════ PROFILE COMPLETION ═══════════════ */}
          {completionPct < 100 && (
            <Animated.View entering={FadeInDown.delay(150).duration(450)} style={[styles.completionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.completionTop}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <View style={[styles.completionDot, { backgroundColor: completionColor }]} />
                    <NxText style={[styles.completionTitle, { color: colors.foreground }]}>
                      Profile {completionPct}% complete
                    </NxText>
                  </View>
                  {missingFields.length > 0 && (
                    <NxText style={[styles.completionSub, { color: colors.mutedFg }]}>
                      Missing: {missingFields.join(" · ")}
                    </NxText>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/settings/edit-profile")}
                  style={[styles.completionBtn, { backgroundColor: completionColor }]}
                >
                  <NxText style={{ color: "#fff", fontSize: 12, fontFamily: fonts.bodySemi }}>
                    Complete
                  </NxText>
                </TouchableOpacity>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceHigh }]}>
                <Animated.View style={[styles.progressFill, completionBarStyle, { backgroundColor: completionColor }]} />
              </View>
            </Animated.View>
          )}

          {/* ═══════════════ STORY GALLERY ═══════════════ */}
          {storyImages.length > 0 && (
            <Animated.View entering={FadeIn.delay(180).duration(450)}>
              <SectionLabel icon="image" label="My Reveries" colors={colors}>
                <TouchableOpacity onPress={() => router.push(`/story/${user.user_id}`)}>
                  <NxText style={{ fontSize: 12, color: colors.primary, fontFamily: fonts.bodySemi }}>View all</NxText>
                </TouchableOpacity>
              </SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }}>
                <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", gap: 10 }}>
                  {storyImages.map((uri, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => router.push(`/story/${user.user_id}`)}
                      style={[styles.galleryThumb, { borderColor: colors.border }]}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.4)"]}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          )}

          {/* ═══════════════ MENU GROUPS ═══════════════ */}
          <Animated.View entering={FadeInDown.delay(200).duration(450)}>

            {/* Social group */}
            <SectionLabel icon="heart" label="Social" colors={colors} />
            <MenuCard colors={colors}>
              <MenuItem icon="bell" label="Notifications" onPress={() => router.push("/notifications")} colors={colors} />
              <MenuItem icon="users" label="My Bonds" badge={bondsCount > 0 ? String(bondsCount) : undefined} onPress={() => router.push("/(app)/friends")} colors={colors} last={user.email !== ADMIN_EMAIL} />
              {user.email === ADMIN_EMAIL && (
                <MenuItem icon="shield" label="Admin Panel" tint={colors.primary} onPress={() => router.push("/admin")} colors={colors} last />
              )}
            </MenuCard>

            {/* Account group */}
            <SectionLabel icon="user" label="Account" colors={colors} />
            <MenuCard colors={colors}>
              <MenuItem icon="lock" label="Change Password" onPress={() => router.push("/settings/change-password")} colors={colors} />
              <MenuItem icon="slash" label="Blocked Users" onPress={() => router.push("/settings/blocked")} colors={colors} />
              <MenuItem icon="user-x" label="Delete Account" tint={colors.danger} onPress={() => router.push("/settings/delete-account")} colors={colors} last />
            </MenuCard>

            {/* App group */}
            <SectionLabel icon="grid" label="App" colors={colors} />
            <MenuCard colors={colors}>
              <MenuItem
                icon={mode === "dark" ? "sun" : "moon"}
                label={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                onPress={toggle}
                colors={colors}
              />
              <MenuItem icon="file-text" label="Privacy Policy" onPress={() => router.push("/settings/privacy-policy")} colors={colors} last />
            </MenuCard>

            {/* Sign out */}
            <View style={{ height: spacing.md }} />
            <MenuCard colors={colors}>
              <MenuItem
                icon="log-out"
                label="Sign out"
                tint={colors.danger}
                last
                onPress={async () => {
                  Alert.alert("Sign out", "Are you sure you want to sign out?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } },
                  ]);
                }}
                colors={colors}
              />
            </MenuCard>
          </Animated.View>

          {/* App Version */}
          <View style={{ alignItems: "center", marginTop: spacing.xl }}>
            <NxText style={{ color: colors.mutedFg, fontSize: 11, letterSpacing: 0.5 }}>
              XYTEEE NEXUS  ·  v{APP_VERSION}
            </NxText>
          </View>

        </View>
      </ScrollView>

      {/* ═══════════════ ONLINE STATUS SHEET ═══════════════ */}
      <Modal visible={onlineSheetOpen} transparent animationType="fade" onRequestClose={() => setOnlineSheetOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setOnlineSheetOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.mutedFg }]} />
            <NxText style={[styles.sheetTitle, { color: colors.foreground }]}>Online Status</NxText>
            {([
              { key: "online",    label: "Online",         desc: "Active and available",       color: "#23A55A" },
              { key: "idle",      label: "Idle",           desc: "Away for a while",            color: "#F0B232" },
              { key: "dnd",       label: "Do Not Disturb", desc: "Notifications silenced",      color: "#F23F43" },
              { key: "invisible", label: "Invisible",      desc: "Appear offline to everyone",  color: "#80848E" },
            ] as const).map((opt) => {
              const selected = (user.online_status || "online") === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.75}
                  disabled={onlineStatusBusy}
                  onPress={async () => {
                    setOnlineStatusBusy(true);
                    try {
                      await updateUser({ online_status: opt.key as any });
                      setOnlineSheetOpen(false);
                    } finally { setOnlineStatusBusy(false); }
                  }}
                  style={[styles.sheetOption, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.sheetStatusDot, { backgroundColor: opt.color }]}>
                    {opt.key === "dnd" ? <View style={styles.dndBar} /> :
                     opt.key === "invisible" ? <View style={[styles.invisibleInner, { backgroundColor: colors.surface }]} /> : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <NxText style={[styles.sheetOptLabel, { color: colors.foreground }]}>{opt.label}</NxText>
                    <NxText style={[styles.sheetOptDesc, { color: colors.mutedFg }]}>{opt.desc}</NxText>
                  </View>
                  {selected
                    ? <View style={[styles.sheetCheck, { backgroundColor: colors.primary }]}>
                        <Feather name="check" size={13} color={colors.onPrimary} />
                      </View>
                    : <View style={styles.sheetCheck} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function StatCol({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View style={styles.statCol}>
      <NxText style={[styles.statValue, { color: accent }]}>{value}</NxText>
      <NxText style={styles.statLabel}>{label}</NxText>
    </View>
  );
}


function SectionLabel({ icon, label, colors, children }: any) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
      <NxText style={[styles.sectionLabelText, { color: colors.mutedFg }]}>{label.toUpperCase()}</NxText>
      {children && <View style={{ marginLeft: "auto" }}>{children}</View>}
    </View>
  );
}

function MenuCard({ children, colors }: { children: React.ReactNode; colors: any }) {
  return (
    <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function MenuItem({ icon, label, onPress, tint, badge, last, colors }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.menuItem, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: tint ? `${tint}18` : colors.surfaceHigh }]}>
        <Feather name={icon} size={15} color={tint || colors.foreground} />
      </View>
      <NxText style={[styles.menuLabel, { color: tint || colors.foreground }]}>{label}</NxText>
      {badge ? (
        <View style={[styles.menuBadge, { backgroundColor: colors.primary }]}>
          <NxText style={{ color: "#fff", fontSize: 11, fontFamily: fonts.bodySemi }}>{badge}</NxText>
        </View>
      ) : null}
      <Feather name="chevron-right" size={16} color={colors.mutedFg} style={{ opacity: 0.5 }} />
    </TouchableOpacity>
  );
}

function BirthdayGift({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.2, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true);
  }, []);
  return (
    <Animated.View style={useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))}>
      <Feather name="gift" size={13} color={color} />
    </Animated.View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  // Cover
  coverWrap: { position: "relative", overflow: "hidden" },
  coverActions: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  glassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(12px)" as any,
  },

  // Identity
  identitySection: { alignItems: "center", marginTop: -AVATAR_SIZE / 2 - 4, paddingBottom: spacing.md },
  avatarRow: { marginBottom: spacing.sm },
  avatarWrap: {
    width: AVATAR_SIZE + 16,
    height: AVATAR_SIZE + 16,
    borderRadius: (AVATAR_SIZE + 16) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGoldRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: (AVATAR_SIZE + 16) / 2,
    borderWidth: 2.5,
  },
  avatarInner: {
    padding: 3,
    borderRadius: AVATAR_SIZE / 2 + 3,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  displayName: {
    fontFamily: fonts.bodySemi,
    fontSize: 22,
    letterSpacing: 0.2,
  },
  username: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontFamily: fonts.bodyMedium, fontSize: 13 },

  // Stats
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingVertical: spacing.lg,
  },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: fonts.bodySemi, fontSize: 22, letterSpacing: 0.5 },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: "#888", marginTop: 3 },
  statDivider: { width: 1, height: 38 },

  // Action row
  actionRow: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: 10,
  },
  actionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: radii.xl,
  },
  actionPrimaryLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
  actionSecondaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  actionSecondaryLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },

  // Body pad
  bodyPad: { paddingHorizontal: spacing.lg, marginTop: spacing.md },

  // Bio card
  bioCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: 12,
  },
  bioText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  bioPlaceholder: { fontFamily: fonts.body, fontSize: 14, fontStyle: "italic" },
  statusBubbleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statusBubbleIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.body, fontSize: 13 },

  // Profile completion
  completionCard: {
    marginTop: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  completionTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  completionDot: { width: 8, height: 8, borderRadius: 4 },
  completionTitle: { fontFamily: fonts.bodySemi, fontSize: 14 },
  completionSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  completionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },

  // Gallery
  galleryThumb: {
    width: 96,
    height: 128,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#111",
  },

  // Section label
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: spacing.xl,
    marginBottom: 10,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionLabelText: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    letterSpacing: 1.2,
  },

  // Menu card
  menuCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    marginLeft: 12,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  menuBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },

  // Online status sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 32,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", opacity: 0.4, marginBottom: 18 },
  sheetTitle: { fontFamily: fonts.bodySemi, fontSize: 19, marginBottom: 8 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetStatusDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dndBar: { width: 10, height: 3, borderRadius: 2, backgroundColor: "#fff" },
  invisibleInner: { width: 9, height: 9, borderRadius: 5 },
  sheetOptLabel: { fontFamily: fonts.bodySemi, fontSize: 15 },
  sheetOptDesc: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  sheetCheck: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
