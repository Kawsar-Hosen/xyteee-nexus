import React, { useCallback, useEffect, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Image,
  Modal, Pressable, Share, Linking, Alert, ActivityIndicator, Switch, Platform,
} from "react-native";
import { AnimatedStatusText } from "@/src/components/AnimatedStatusText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { uploadFile } from "@/src/api/upload";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { CoverWatermark } from "@/src/components/CoverWatermark";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL || "smdkawsar2@gmail.com";
const APP_VERSION = "1.0.0";
const COVER_H = 220;
const AVATAR_SIZE = 96;

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
  const [notifCount, setNotifCount] = useState(0);
  const [reveriesCount, setReveriesCount] = useState(0);
  const [onlineSheetOpen, setOnlineSheetOpen] = useState(false);
  const [onlineStatusBusy, setOnlineStatusBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [privateConfirmOpen, setPrivateConfirmOpen] = useState(false);
  const [privateTarget, setPrivateTarget] = useState(false);
  const [privateBusy, setPrivateBusy] = useState(false);

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const url = await uploadFile(asset.uri, "profiles", token || "", asset.fileName || undefined, asset.mimeType);
      await updateUser({ profile_picture: url });
    } catch {
      Alert.alert("Upload failed", "Could not update profile photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickCoverPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to change your cover photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const url = await uploadFile(asset.uri, "profiles", token || "", asset.fileName || undefined, asset.mimeType);
      await updateUser({ cover_picture: url });
    } catch {
      Alert.alert("Upload failed", "Could not update cover photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const completionWidth = useSharedValue(0);

  const loadData = useCallback(async () => {
    if (!token || !user) return;
    try {
      const [storyResult, friendsResult, notifResult] = await Promise.all([
        api<{ feed: any[] }>("/stories/feed", { token }),
        api<{ friends: any[] }>("/friends", { token }),
        api<{ notifications: any[] }>("/notifications", { token }),
      ]);
      const myStoryGroup = (storyResult.feed || []).find(
        (g: any) => g.user?.user_id === user.user_id
      );
      const myStories = myStoryGroup?.stories || [];
      setHasStory(myStories.length > 0);
      setReveriesCount(myStories.length);
      setBondsCount((friendsResult.friends || []).length);
      setNotifCount((notifResult.notifications || []).filter((n: any) => !n.read).length);
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
        message: `Check out @${user.username} on Xyteee!\nhttps://xyteee.com/user/${user.username}`,
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
        <View style={styles.mobileWrapper}>

        {/* ═══════════════ COVER ═══════════════ */}
        <Pressable
          onPress={!user.cover_picture ? pickCoverPhoto : undefined}
          disabled={uploadingPhoto}
          style={({ pressed }) => [
            styles.coverWrap,
            { height: COVER_H, backgroundColor: colors.surfaceHigh },
            pressed && styles.coverPressed,
          ]}
        >
          {user.cover_picture ? (
            <Image source={{ uri: user.cover_picture }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <>
              <CoverWatermark />
              {/* Add cover hint (no photo yet) */}
              <View style={styles.coverAddHint} pointerEvents="none">
                <View style={[styles.coverAddBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Feather name="camera" size={15} color={colors.foreground} />
                </View>
                <NxText style={[styles.coverAddText, { color: colors.foreground }]}>Add a cover</NxText>
              </View>
            </>
          )}

          {/* Header action buttons */}
          <View style={styles.coverActions}>
            <TouchableOpacity onPress={() => router.push("/settings")} style={[styles.glassBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="settings" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </Pressable>

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
              <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                <Avatar
                  uri={user.profile_picture}
                  name={user.display_name}
                  size={AVATAR_SIZE}
                  frame={user.profile_frame}
                  achievement={user.achievement_level}
                  animation={user.profile_animation}
                  animationSpeed={user.profile_animation_speed}
                  animationIntensity={user.profile_animation_intensity}
                />
              </View>
              {/* Edit overlay badge */}
              <TouchableOpacity
                onPress={pickProfilePhoto}
                disabled={uploadingPhoto}
                style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}
              >
                {uploadingPhoto
                  ? <ActivityIndicator size={11} color={colors.onPrimary} />
                  : <Feather name="camera" size={11} color={colors.onPrimary} />}
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* Name + badge */}
          <View style={styles.nameRow}>
            <NxText variant="title" style={[styles.displayName, { color: colors.foreground }]}>{user.display_name}</NxText>
            <VerifiedBadge badgeType={user.badge_type} badgeIcon={user.badge_icon} badgeExpiresAt={user.badge_expires_at} verifiedSince={user.verified_since} showInfo size={18} />
          </View>
          <NxText style={[styles.username, { color: colors.mutedFg }]}>@{user.username}</NxText>

          {/* Bio inline below username */}
          {user.bio ? (
            <NxText style={[styles.inlineBio, { color: colors.foreground }]}>{user.bio}</NxText>
          ) : (
            <TouchableOpacity onPress={() => router.push("/settings/edit-profile")} activeOpacity={0.7}>
              <NxText style={[styles.inlineBioPlaceholder, { color: colors.mutedFg }]}>+ Add a bio</NxText>
            </TouchableOpacity>
          )}

          {/* Status pills row */}
          <View style={styles.statusPillsRow}>
            {/* Online status pill */}
            <TouchableOpacity
              onPress={() => setOnlineSheetOpen(true)}
              activeOpacity={0.8}
              style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.statusDot, { backgroundColor: currentStatusColor }]} />
              <NxText style={[styles.statusPillText, { color: colors.foreground }]}>
                {user.online_status === "dnd" ? "DND"
                  : user.online_status === "invisible" ? "Invisible"
                  : user.online_status === "idle" ? "Idle"
                  : "Online"}
              </NxText>
              <Feather name="chevron-down" size={12} color={colors.mutedFg} />
            </TouchableOpacity>

            {/* Status note pill */}
            <TouchableOpacity
              onPress={() => router.push("/settings/status")}
              activeOpacity={0.8}
              style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.notePillIcon, { backgroundColor: colors.primary }]}>
                <Feather name="edit-3" size={10} color={colors.onPrimary} />
              </View>
              {user.status_text ? (
                <AnimatedStatusText color={colors.foreground} style={{ flexShrink: 1, fontSize: 12, lineHeight: 16 }}>
                  {user.status_text}
                </AnimatedStatusText>
              ) : (
                <NxText style={[styles.statusPillText, { color: colors.mutedFg }]}>Status</NxText>
              )}
              <Feather name="chevron-right" size={12} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ═══════════════ STATS ═══════════════ */}
        <Animated.View entering={FadeIn.delay(80).duration(500)}>
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <StatCol value={String(bondsCount)} label="Bonds" accent={colors.primary} />
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <StatCol value={String(reveriesCount)} label="Reveries" accent="#a78bfa" />
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <StatCol value={sinceValue} label="Since" accent={colors.mutedFg} />
          </View>
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
              {notifCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                  <NxText style={styles.notifBadgeText}>{notifCount > 9 ? "9+" : notifCount}</NxText>
                </View>
              )}
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
            {/* Meta row */}
            <View style={styles.metaRow}>
              {user.website ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(user.website!.startsWith("http") ? user.website! : `https://${user.website!}`)}
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

          {/* ═══════════════ SETTINGS GROUPS ═══════════════ */}
          <Animated.View entering={FadeInDown.delay(200).duration(450)}>

            {/* Customize & Preferences */}
            <SectionLabel icon="sliders" label="Customize" colors={colors} />
            <MenuCard colors={colors}>
              <SettingRowItem
                icon="edit-2"
                iconColor={colors.primary}
                label="Edit profile"
                sub="Name, bio, photos & birthday"
                colors={colors}
                onPress={() => router.push("/settings/edit-profile")}
              />
              <SettingRowItem
                icon={mode === "dark" ? "sun" : "moon"}
                iconColor="#fbbf24"
                label={mode === "dark" ? "Light mode" : "Dark mode"}
                sub="Switch your look"
                colors={colors}
                right={
                  <Switch
                    value={mode === "dark"}
                    onValueChange={toggle}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={colors.background}
                  />
                }
              />
              <SettingRowItem
                icon="eye-off"
                iconColor="#23A55A"
                label="Private account"
                sub="Only your Bonds can see you"
                colors={colors}
                right={
                  <Switch
                    value={!!user.is_private}
                    onValueChange={(v) => {
                      if (v === true) {
                        setPrivateTarget(true);
                        setPrivateConfirmOpen(true);
                      } else {
                        setPrivateTarget(false);
                        setPrivateConfirmOpen(true);
                      }
                    }}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={colors.background}
                  />
                }
                last
              />
            </MenuCard>

            {/* Social & Connections */}
            <SectionLabel icon="heart" label="Social" colors={colors} />
            <MenuCard colors={colors}>
              <SettingRowItem
                icon="bell"
                iconColor={colors.primary}
                label="Notifications"
                sub="Alerts & activity"
                badge={notifCount > 0 ? (notifCount > 9 ? "9+" : String(notifCount)) : undefined}
                badgeColor={colors.primary}
                colors={colors}
                onPress={() => router.push("/notifications")}
              />
              <SettingRowItem
                icon="users"
                iconColor="#a78bfa"
                label="My Bonds"
                sub="Friends & connections"
                badge={bondsCount > 0 ? String(bondsCount) : undefined}
                badgeColor="#a78bfa"
                colors={colors}
                onPress={() => router.push("/(app)/friends")}
              />
              {user.email === ADMIN_EMAIL && (
                <SettingRowItem
                  icon="shield"
                  iconColor={colors.primary}
                    label="Admin control"
                  sub="Manage the platform"
                  colors={colors}
                  onPress={() => router.push("/admin")}
                  last
                />
              )}
            </MenuCard>

            {/* Security & Account */}
            <SectionLabel icon="lock" label="Account" colors={colors} />
            <MenuCard colors={colors}>
              <SettingRowItem
                icon="key"
                iconColor="#F0B232"
                label="Change password"
                sub="Keep your account safe"
                colors={colors}
                onPress={() => router.push("/settings/change-password")}
              />
              <SettingRowItem
                icon="slash"
                iconColor="#f472b6"
                label="Blocked users"
                sub="Manage blocked people"
                colors={colors}
                onPress={() => router.push("/settings/blocked")}
              />
              <SettingRowItem
                icon="file-text"
                iconColor="#60a5fa"
                label="Privacy policy"
                sub="How we handle your data"
                colors={colors}
                onPress={() => router.push("/settings/privacy-policy")}
              />
              <SettingRowItem
                icon="user-x"
                iconColor={colors.danger}
                label="Delete account"
                sub="Permanently remove everything"
                colors={colors}
                onPress={() => router.push("/settings/delete-account")}
                last
              />
            </MenuCard>

            {/* Sign out */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setLogoutConfirmOpen(true)}
              style={[styles.signOutCard, { backgroundColor: colors.danger + "14", borderColor: colors.danger + "55" }]}
            >
              <View style={[styles.signOutIcon, { backgroundColor: colors.danger }]}>
                <Feather name="log-out" size={19} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <NxText style={[styles.signOutLabel, { color: colors.danger }]}>Sign out</NxText>
                <NxText style={styles.signOutSub}>End your session on this device</NxText>
              </View>
              <Feather name="chevron-right" size={18} color={colors.danger} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          </Animated.View>

          {/* App Version */}
          <View style={{ alignItems: "center", marginTop: spacing.xl }}>
            <NxText style={{ color: colors.mutedFg, fontSize: 11, letterSpacing: 0.5 }}>
              XYTEEE NEXUS  ·  v{APP_VERSION}
            </NxText>
          </View>

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

      {/* ═══════════════ LOGOUT CONFIRM MODAL ═══════════════ */}
      <Modal visible={logoutConfirmOpen} transparent animationType="fade" onRequestClose={() => setLogoutConfirmOpen(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setLogoutConfirmOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}
            style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: colors.danger + "22" }]}>
              <Feather name="log-out" size={22} color={colors.danger} />
            </View>
            <NxText style={[styles.confirmTitle, { color: colors.foreground }]}>Sign out of Xyteee?</NxText>
            <NxText style={[styles.confirmBody, { color: colors.mutedFg }]}>
              Are you sure you want to sign out? You can sign back in anytime.
            </NxText>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setLogoutConfirmOpen(false)}
                style={[styles.confirmCancel, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
              >
                <NxText style={[styles.confirmCancelLabel, { color: colors.foreground }]}>Cancel</NxText>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={loggingOut}
                onPress={async () => {
                  setLoggingOut(true);
                  try {
                    await logout();
                    router.replace("/");
                  } catch {
                    setLoggingOut(false);
                    setLogoutConfirmOpen(false);
                  }
                }}
                style={[styles.confirmLogout, { backgroundColor: colors.danger }]}
              >
                {loggingOut
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <NxText style={styles.confirmLogoutLabel}>Sign out</NxText>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════════ PRIVATE ACCOUNT CONFIRM MODAL ═══════════════ */}
      <Modal visible={privateConfirmOpen} transparent animationType="fade" onRequestClose={() => setPrivateConfirmOpen(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setPrivateConfirmOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}
            style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: privateTarget ? "#23A55A22" : colors.danger + "22" }]}>
              <Feather name={privateTarget ? "eye-off" : "eye"} size={22} color={privateTarget ? "#23A55A" : colors.danger} />
            </View>
            <NxText style={[styles.confirmTitle, { color: colors.foreground }]}>
              {privateTarget ? "Make your profile private?" : "Go back to public?"}
            </NxText>
            <NxText style={[styles.confirmBody, { color: colors.mutedFg }]}>
              {privateTarget
                ? "Only your Bonds will be able to see your profile, stories and info. Others will see a locked profile."
                : "Anyone on Xyteee will be able to view your profile and stories again."}
            </NxText>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setPrivateConfirmOpen(false)}
                style={[styles.confirmCancel, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
              >
                <NxText style={[styles.confirmCancelLabel, { color: colors.foreground }]}>Cancel</NxText>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={privateBusy}
                onPress={async () => {
                  setPrivateBusy(true);
                  try {
                    await updateUser({ is_private: privateTarget });
                    setPrivateConfirmOpen(false);
                  } catch {
                    // keep modal open so they can retry / cancel
                  } finally {
                    setPrivateBusy(false);
                  }
                }}
                style={[styles.confirmLogout, { backgroundColor: privateTarget ? "#23A55A" : colors.primary }]}
              >
                {privateBusy
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <NxText style={styles.confirmLogoutLabel}>
                      {privateTarget ? "Make Private" : "Make Public"}
                    </NxText>}
              </TouchableOpacity>
            </View>
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
      <Feather name={icon} size={13} color={colors.mutedFg} />
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

function SettingRowItem({
  icon,
  iconColor,
  label,
  sub,
  badge,
  badgeColor,
  colors,
  onPress,
  right,
  last,
}: {
  icon: any;
  iconColor: string;
  label: string;
  sub?: string;
  badge?: string;
  badgeColor?: string;
  colors: any;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      style={[styles.settingRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconColor }]}>
        <Feather name={icon} size={16} color="#fff" strokeWidth={2.2} />
      </View>
      <View style={styles.settingTextWrap}>
        <View style={styles.settingTitleRow}>
          <NxText style={[styles.settingLabel, { color: colors.foreground }]} numberOfLines={1}>
            {label}
          </NxText>
          {badge ? (
            <View style={[styles.settingBadge, { backgroundColor: badgeColor || colors.primary }]}>
              <NxText style={styles.settingBadgeText}>{badge}</NxText>
            </View>
          ) : null}
        </View>
        {sub ? (
          <NxText style={[styles.settingSub, { color: colors.mutedFg }]} numberOfLines={1}>
            {sub}
          </NxText>
        ) : null}
      </View>
      {right || (
        <Feather name="chevron-right" size={18} color={colors.mutedFg} style={{ opacity: 0.5 }} />
      )}
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
  mobileWrapper: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  coverWrap: { position: "relative", overflow: "hidden" },
  coverPressed: { opacity: 0.85 },
  coverAddHint: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverAddBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coverAddText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.5,
  },
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 0.3,
  },
  username: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  statusPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.sm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  notePillIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

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
  statValue: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, lineHeight: 30 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: "#888", marginTop: 3, letterSpacing: 0.8, textTransform: "uppercase" },
  statDivider: { width: 1, height: 36 },

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
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  actionPrimaryLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
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
    paddingVertical: 11,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  actionSecondaryLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  notifBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.bodySemi },

  // Body pad
  bodyPad: { paddingHorizontal: spacing.lg, marginTop: spacing.md },

  // Bio card
  bioCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: 10,
  },
  inlineBio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 4, paddingHorizontal: spacing.lg, maxWidth: 300 },
  inlineBioPlaceholder: { fontFamily: fonts.body, fontSize: 12, fontStyle: "italic", marginTop: 4 },
  bioText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  bioPlaceholder: { fontFamily: fonts.body, fontSize: 14, fontStyle: "italic" },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.body, fontSize: 12 },

  // Profile completion
  completionCard: {
    marginTop: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  completionTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  completionDot: { width: 7, height: 7, borderRadius: 4 },
  completionTitle: { fontFamily: fonts.bodySemi, fontSize: 13 },
  completionSub: { fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  completionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },

  // Gallery
  galleryThumb: {
    width: 90,
    height: 120,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#111",
  },

  // Section label
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xl,
    marginBottom: 8,
  },
  sectionLabelText: {
    fontSize: 10,
    fontFamily: fonts.bodySemi,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // Menu card — light rounded corners
  menuCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Setting rows
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    gap: 12,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingTextWrap: { flex: 1, marginRight: 6 },
  settingTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    flexShrink: 1,
  },
  settingSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  settingBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  settingBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.bodySemi },

  // Sign out card — light rounded corners
  signOutCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  signOutIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutLabel: { fontFamily: fonts.bodySemi, fontSize: 14 },
  signOutSub: { fontFamily: fonts.body, fontSize: 11, marginTop: 2, opacity: 0.65 },

  // Logout confirm modal
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
  },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  confirmTitle: { fontFamily: fonts.display, fontSize: 20, textAlign: "center" },
  confirmBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: 8 },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: spacing.xl,
  },
  confirmCancel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  confirmCancelLabel: { fontFamily: fonts.bodySemi, fontSize: 14 },
  confirmLogout: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: radii.md,
  },
  confirmLogoutLabel: { color: "#fff", fontFamily: fonts.bodySemi, fontSize: 14 },

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
