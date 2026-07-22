import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Image, Modal,
  Pressable, Share, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn, FadeInDown, FadeInRight,
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

function getProfileCompletion(user: any) {
  const checks = [
    { key: "profile_picture", label: "Profile photo" },
    { key: "cover_picture", label: "Cover photo" },
    { key: "bio", label: "Bio" },
    { key: "birthday", label: "Birthday" },
    { key: "status_text", label: "Status" },
  ];
  const total = checks.length;
  const done = checks.filter(c => !!user[c.key]).length;
  const missing = checks.filter(c => !user[c.key]).map(c => c.label);
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

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: DOCK_PAD }}>

        {/* ── Cover ── */}
        <View style={styles.coverWrap}>
          {user.cover_picture ? (
            <Image source={{ uri: user.cover_picture }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={StyleSheet.absoluteFillObject} />
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.35)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={toggle} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
              <Feather name={mode === "dark" ? "sun" : "moon"} size={18} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={handleShare} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
                <Feather name="share-2" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/settings")} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
                <Feather name="settings" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={styles.body}>

          {/* Avatar + Status bubble */}
          <View style={styles.profileTopRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => hasStory ? router.push(`/story/${user.user_id}`) : setOnlineSheetOpen(true)}
              onLongPress={() => setOnlineSheetOpen(true)}
              delayLongPress={400}
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
                    <Avatar uri={user.profile_picture} name={user.display_name} size={100} online onlineStatus={user.online_status || "online"} />
                  </View>
                </>
              ) : (
                <Avatar uri={user.profile_picture} name={user.display_name} size={100} online onlineStatus={user.online_status || "online"} />
              )}
            </TouchableOpacity>

            <View style={styles.statusWrap}>
              <View style={[styles.thoughtDotSmall, { backgroundColor: colors.surface }]} />
              <View style={[styles.thoughtDotLarge, { backgroundColor: colors.surface }]} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push("/settings/status")}
                style={[styles.statusBubble, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
              >
                <View style={[styles.statusPlus, { backgroundColor: colors.mutedFg }]}>
                  <Feather name="plus" size={12} color={colors.background} />
                </View>
                <AnimatedStatusText color={user.status_text ? colors.foreground : colors.mutedFg}>
                  {user.status_text || "Set a status…"}
                </AnimatedStatusText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name + Edit */}
          <View style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <NxText variant="title" style={{ flexShrink: 1 }}>{user.display_name}</NxText>
                <VerifiedBadge badgeType={user.badge_type} verifiedSince={user.verified_since} showInfo size={18} />
              </View>
              <NxText variant="bodySm" style={{ color: colors.mutedFg }}>@{user.username}</NxText>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/settings/edit-profile")}
              style={[styles.editBtn, { borderColor: colors.primary }]}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <NxText style={{ color: colors.primary, marginLeft: 6, fontFamily: fonts.bodySemi, fontSize: 13 }}>Edit</NxText>
            </TouchableOpacity>
          </View>

          {/* Bio */}
          {user.bio ? (
            <NxText variant="body" style={{ marginTop: spacing.sm, color: colors.foreground, lineHeight: 22 }}>
              {user.bio}
            </NxText>
          ) : (
            <TouchableOpacity onPress={() => router.push("/settings/edit-profile")} activeOpacity={0.7}>
              <NxText variant="bodySm" style={{ marginTop: spacing.sm, fontStyle: "italic", color: colors.mutedFg }}>
                + Add a bio
              </NxText>
            </TouchableOpacity>
          )}

          {/* Website / Link */}
          {user.website ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(user.website.startsWith("http") ? user.website : `https://${user.website}`)}
              style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}
            >
              <Feather name="link" size={13} color={colors.primary} />
              <NxText style={{ marginLeft: 6, color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 13 }}>
                {user.website.replace(/^https?:\/\//, "")}
              </NxText>
            </TouchableOpacity>
          ) : null}

          {/* Birthday */}
          {user.birthday ? (
            <Animated.View entering={FadeInDown.duration(650).springify()} style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
              <BirthdayGift color={colors.primary} />
              <NxText variant="bodySm" style={{ marginLeft: 8, color: colors.mutedFg, fontFamily: fonts.bodyMedium }}>
                {new Date(`${user.birthday}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </NxText>
            </Animated.View>
          ) : null}

          {/* Joined date */}
          {joinedDate && (
            <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center" }}>
              <Feather name="calendar" size={13} color={colors.mutedFg} />
              <NxText variant="bodySm" style={{ marginLeft: 6, color: colors.mutedFg }}>Joined {joinedDate}</NxText>
            </View>
          )}

          {/* ── Stats ── */}
          <Animated.View entering={FadeIn.delay(100).duration(500)} style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <StatItem icon="users" label="Bonds" value={String(bondsCount)} color={colors.primary} />
            <View style={{ width: 1, height: 36, backgroundColor: colors.border }} />
            <StatItem icon="image" label="Reveries" value={String(reveriesCount)} color="#7a00ff" />
            <View style={{ width: 1, height: 36, backgroundColor: colors.border }} />
            <StatItem icon="clock" label="Since" value={sinceValue} color={colors.mutedFg} />
          </Animated.View>

          {/* ── Profile Completion Card ── */}
          {completionPct < 100 && (
            <Animated.View entering={FadeInDown.delay(150).duration(500)} style={[styles.completionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <View>
                  <NxText style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.foreground }}>
                    Profile {completionPct}% complete
                  </NxText>
                  {missingFields.length > 0 && (
                    <NxText style={{ fontSize: 12, color: colors.mutedFg, marginTop: 2 }}>
                      Missing: {missingFields.join(", ")}
                    </NxText>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/settings/edit-profile")}
                  style={[styles.completionBtn, { backgroundColor: colors.primary }]}
                >
                  <NxText style={{ color: colors.onPrimary, fontSize: 12, fontFamily: fonts.bodySemi }}>
                    Complete
                  </NxText>
                </TouchableOpacity>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceHigh }]}>
                <Animated.View
                  style={[styles.progressFill, completionBarStyle, { backgroundColor: completionColor }]}
                />
              </View>
            </Animated.View>
          )}

          {/* ── Story Gallery Strip ── */}
          {storyImages.length > 0 && (
            <Animated.View entering={FadeIn.delay(200).duration(500)}>
              <View style={styles.sectionHeader}>
                <Feather name="image" size={15} color={colors.mutedFg} />
                <NxText style={styles.sectionLabel}>My Reveries</NxText>
                <TouchableOpacity onPress={() => router.push(`/story/${user.user_id}`)} style={{ marginLeft: "auto" }}>
                  <NxText style={{ fontSize: 12, color: colors.primary, fontFamily: fonts.bodySemi }}>View all</NxText>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg }}>
                {storyImages.map((uri, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => router.push(`/story/${user.user_id}`)}
                    style={[styles.galleryThumb, { borderColor: colors.border, marginRight: 8 }]}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* ── Quick Links ── */}
          <View style={{ marginTop: spacing.xl }}>

            {/* Social */}
            <SectionHeader icon="heart" label="Social" colors={colors} />
            <QuickLink icon="bell" label="Notifications" onPress={() => router.push("/notifications")} colors={colors} />
            <QuickLink icon="users" label="My Bonds" badge={bondsCount > 0 ? String(bondsCount) : undefined} onPress={() => router.push("/(app)/friends")} colors={colors} />

            {/* Account */}
            <SectionHeader icon="user" label="Account" colors={colors} />
            <QuickLink icon="lock" label="Change Password" onPress={() => router.push("/settings/change-password")} colors={colors} />
            <QuickLink icon="slash" label="Blocked Users" onPress={() => router.push("/settings/blocked")} colors={colors} />
            <QuickLink icon="user-x" label="Delete Account" tint={colors.danger} onPress={() => router.push("/settings/delete-account")} colors={colors} />

            {/* App */}
            <SectionHeader icon="grid" label="App" colors={colors} />
            <QuickLink
              icon={mode === "dark" ? "sun" : "moon"}
              label={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              onPress={toggle}
              colors={colors}
            />
            <QuickLink icon="file-text" label="Privacy Policy" onPress={() => router.push("/settings/privacy-policy")} colors={colors} />
            <QuickLink icon="share-2" label="Share My Profile" onPress={handleShare} colors={colors} />

            {/* Admin */}
            {user.email === ADMIN_EMAIL && (
              <QuickLink icon="shield" label="Admin Panel" tint={colors.primary} onPress={() => router.push("/admin")} colors={colors} />
            )}

            {/* Sign Out */}
            <View style={{ height: spacing.md }} />
            <QuickLink
              icon="log-out"
              label="Sign out"
              tint={colors.danger}
              onPress={async () => {
                Alert.alert("Sign out", "Are you sure you want to sign out?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } },
                ]);
              }}
              colors={colors}
            />
          </View>

          {/* App Version */}
          <View style={{ alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.md }}>
            <NxText style={{ color: colors.mutedFg, fontSize: 11 }}>Xyteee v{APP_VERSION}</NxText>
          </View>
        </View>
      </ScrollView>

      {/* Online Status Modal */}
      <Modal visible={onlineSheetOpen} transparent animationType="fade" onRequestClose={() => setOnlineSheetOpen(false)}>
        <Pressable style={styles.onlineSheetOverlay} onPress={() => setOnlineSheetOpen(false)}>
          <Pressable onPress={e => e.stopPropagation()} style={[styles.onlineSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.onlineSheetHandle, { backgroundColor: colors.mutedFg }]} />
            <NxText style={[styles.onlineSheetTitle, { color: colors.foreground }]}>Online Status</NxText>
            {[
              { key: "online", label: "Online", description: "You're active and available", color: "#23A55A" },
              { key: "idle", label: "Idle", description: "You may be away for a while", color: "#F0B232" },
              { key: "dnd", label: "Do Not Disturb", description: "Notifications are silenced", color: "#F23F43" },
              { key: "invisible", label: "Invisible", description: "Appear offline to everyone", color: "#80848E" },
            ].map(option => {
              const selected = (user.online_status || "online") === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.75}
                  disabled={onlineStatusBusy}
                  onPress={async () => {
                    setOnlineStatusBusy(true);
                    try {
                      await updateUser({ online_status: option.key as any });
                      setOnlineSheetOpen(false);
                    } finally { setOnlineStatusBusy(false); }
                  }}
                  style={[styles.onlineSheetOption, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.onlineStatusIcon, { backgroundColor: option.color }]}>
                    {option.key === "dnd" ? <View style={styles.dndMinus} /> :
                     option.key === "invisible" ? <View style={[styles.invisibleCenter, { backgroundColor: colors.surface }]} /> : null}
                  </View>
                  <View style={styles.onlineOptionText}>
                    <NxText style={[styles.onlineOptionLabel, { color: colors.foreground }]}>{option.label}</NxText>
                    <NxText style={[styles.onlineOptionDescription, { color: colors.mutedFg }]}>{option.description}</NxText>
                  </View>
                  {selected ? <Feather name="check" size={21} color={colors.primary} /> : <View style={{ width: 21 }} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function SectionHeader({ icon, label, colors }: { icon: string; label: string; colors: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.lg, marginBottom: 8 }}>
      <Feather name={icon as any} size={13} color={colors.mutedFg} />
      <NxText style={{ marginLeft: 6, fontSize: 11, fontFamily: fonts.bodySemi, color: colors.mutedFg, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {label}
      </NxText>
    </View>
  );
}

function StatItem({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Feather name={icon as any} size={16} color={color} style={{ marginBottom: 4 }} />
      <NxText variant="titleSm">{value}</NxText>
      <NxText variant="caption" style={{ marginTop: 1 }}>{label}</NxText>
    </View>
  );
}

function QuickLink({ icon, label, onPress, tint, badge, colors }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.link, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.linkIcon, { backgroundColor: colors.surfaceHigh }]}>
        <Feather name={icon} size={16} color={tint || colors.foreground} />
      </View>
      <NxText style={{ marginLeft: 14, fontFamily: fonts.bodyMedium, color: tint || colors.foreground, fontSize: 14, flex: 1 }}>
        {label}
      </NxText>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <NxText style={{ color: "#fff", fontSize: 11, fontFamily: fonts.bodySemi }}>{badge}</NxText>
        </View>
      ) : null}
      <Feather name="chevron-right" size={18} color={colors.mutedFg} />
    </TouchableOpacity>
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
  coverWrap: { height: 200, position: "relative" },
  headerRow: { position: "absolute", top: spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: spacing.lg },
  profileTopRow: { height: 86, flexDirection: "row", alignItems: "flex-start" },
  editBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1 },
  statusWrap: { flex: 1, minWidth: 0, height: 78, marginLeft: 10, marginRight: 10, marginTop: -32, position: "relative", justifyContent: "flex-end" },
  statusBubble: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", width: "92%", minHeight: 58, maxHeight: 78, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, overflow: "hidden" },
  thoughtDotSmall: { position: "absolute", left: -10, top: 7, width: 7, height: 7, borderRadius: 999, zIndex: 3 },
  thoughtDotLarge: { position: "absolute", left: 3, top: 16, width: 11, height: 11, borderRadius: 999, zIndex: 3 },
  statusPlus: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 },
  statsRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg },
  completionCard: { marginTop: spacing.md, borderRadius: radii.lg, borderWidth: 1, padding: spacing.md },
  completionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, marginBottom: 10 },
  sectionLabel: { fontSize: 13, fontFamily: fonts.bodySemi, color: "#888", marginLeft: 6 },
  galleryThumb: { width: 100, height: 130, borderRadius: radii.md, overflow: "hidden", borderWidth: 1, backgroundColor: "#111" },
  link: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm },
  linkIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
  onlineSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  onlineSheet: { borderWidth: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 28 },
  onlineSheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", opacity: 0.45, marginBottom: 18 },
  onlineSheetTitle: { fontFamily: fonts.bodySemi, fontSize: 19, marginBottom: 8 },
  onlineSheetOption: { minHeight: 72, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  onlineStatusIcon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dndMinus: { width: 10, height: 3, borderRadius: 2, backgroundColor: "#FFFFFF" },
  invisibleCenter: { width: 9, height: 9, borderRadius: 5 },
  onlineOptionText: { flex: 1, marginLeft: 14, marginRight: 12 },
  onlineOptionLabel: { fontFamily: fonts.bodySemi, fontSize: 15 },
  onlineOptionDescription: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
