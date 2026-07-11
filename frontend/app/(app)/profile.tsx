import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
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

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  const [hasStory, setHasStory] = useState(false);
  const storyRingRotation = useSharedValue(0);

  useEffect(() => {
    if (hasStory) {
      storyRingRotation.value = withRepeat(
        withTiming(360, { duration: 3000 }),
        -1,
        false
      );
    } else {
      storyRingRotation.value = 0;
    }
  }, [hasStory]);

  const storyRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${storyRingRotation.value}deg` }],
  }));
  const [bondsCount, setBondsCount] = useState(0);
  const [reveriesCount, setReveriesCount] = useState(0);
  const [onlineSheetOpen, setOnlineSheetOpen] = useState(false);
  const [onlineStatusBusy, setOnlineStatusBusy] = useState(false);

  const loadStory = useCallback(async () => {
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
    } catch {
      setHasStory(false);
      setReveriesCount(0);
      setBondsCount(0);
    }
  }, [token, user]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  if (!user) return null;

  const sinceValue = (() => {
    if (!user.created_at) return "New";

    const created = new Date(user.created_at);
    const ageMs = Date.now() - created.getTime();
    const days = Math.max(0, Math.floor(ageMs / 86400000));

    if (days <= 30) return "New";

    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;

    const years = Math.floor(days / 365);
    return `${Math.max(1, years)}y`;
  })();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: DOCK_PAD }}>
        <View style={styles.coverWrap}>
          {user.cover_picture ? (
            <Image source={{ uri: user.cover_picture }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={StyleSheet.absoluteFillObject} />
          )}
          <View style={styles.headerRow}>
            <TouchableOpacity testID="profile-theme-toggle" onPress={toggle} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
              <Feather name={mode === "dark" ? "sun" : "moon"} size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity testID="profile-settings" onPress={() => router.push("/settings")} style={[styles.iconBtn, { backgroundColor: colors.glass }]}>
              <Feather name="settings" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.profileTopRow}>
            <TouchableOpacity
              testID="profile-avatar"
              activeOpacity={0.85}
              onPress={() =>
                hasStory
                  ? router.push(`/story/${user.user_id}`)
                  : setOnlineSheetOpen(true)
              }
              onLongPress={() => setOnlineSheetOpen(true)}
              delayLongPress={400}
              style={{
                marginTop: -50,
                width: hasStory ? 108 : 100,
                height: hasStory ? 108 : 100,
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel={hasStory ? "View your story. Long press to change online status" : "Change online status"}
            >
              {hasStory ? (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: "absolute",
                        width: 108,
                        height: 108,
                        borderRadius: 54,
                        overflow: "hidden",
                      },
                      storyRingStyle,
                    ]}
                  >
                    <LinearGradient
                      colors={["#ff004c", "#ffea00", "#00ff85", "#00c8ff", "#7a00ff", "#ff00c8", "#ff004c"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </Animated.View>

                  <View
                    style={{
                      padding: 2,
                      borderRadius: 52,
                      backgroundColor: colors.background,
                    }}
                  >
                    <Avatar
                      uri={user.profile_picture}
                      name={user.display_name}
                      size={100}
                      online
                      onlineStatus={user.online_status || "online"}
                    />
                  </View>
                </>
              ) : (
                <Avatar
                  uri={user.profile_picture}
                  name={user.display_name}
                  size={100}
                  online
                  onlineStatus={user.online_status || "online"}
                />
              )}
            </TouchableOpacity>

            <View style={styles.statusWrap}>
              <View
                style={[
                  styles.thoughtDotSmall,
                  { backgroundColor: colors.surface },
                ]}
              />
              <View
                style={[
                  styles.thoughtDotLarge,
                  { backgroundColor: colors.surface },
                ]}
              />

              <TouchableOpacity
                testID="profile-status"
                activeOpacity={0.8}
                onPress={() => router.push("/settings/status")}
                style={[
                  styles.statusBubble,
                  {
                    backgroundColor: colors.surfaceHigh,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusPlus,
                    { backgroundColor: colors.mutedFg },
                  ]}
                >
                  <Feather name="plus" size={12} color={colors.background} />
                </View>
                <AnimatedStatusText
                  color={
                    user.status_text
                      ? colors.foreground
                      : colors.mutedFg
                  }
                >
                  {user.status_text || "Set a status"}
                </AnimatedStatusText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <NxText variant="title" style={{ flexShrink: 1 }}>{user.display_name}</NxText>
                <VerifiedBadge badgeType={user.badge_type} verifiedSince={user.verified_since} showInfo size={18} />
              </View>
              <NxText variant="bodySm">@{user.username}</NxText>
            </View>
            <TouchableOpacity
              testID="profile-edit"
              onPress={() => router.push("/settings/edit-profile")}
              style={[styles.editBtn, { borderColor: colors.primary }]}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <NxText style={{ color: colors.primary, marginLeft: 6, fontFamily: fonts.bodySemi, fontSize: 13 }}>Edit</NxText>
            </TouchableOpacity>
          </View>

          {user.bio ? (
            <NxText variant="body" style={{ marginTop: spacing.md, color: colors.foreground, lineHeight: 22 }}>
              {user.bio}
            </NxText>
          ) : (
            <NxText variant="bodySm" style={{ marginTop: spacing.md, fontStyle: "italic" }}>
              No bio yet. Tap Edit to add one.
            </NxText>
          )}

          {user.birthday ? (
            <Animated.View
              entering={FadeInDown.duration(650).springify()}
              style={{
                marginTop: spacing.md,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <BirthdayGift color={colors.primary} />
              <NxText
                variant="bodySm"
                style={{
                  marginLeft: 8,
                  color: colors.mutedFg,
                  fontFamily: fonts.bodyMedium,
                }}
              >
                Birthday · {new Date(`${user.birthday}T00:00:00`).toLocaleDateString(
                  undefined,
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }
                )}
              </NxText>
            </Animated.View>
          ) : null}

          <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Stat label="Bonds" value={String(bondsCount)} />
            <Divider />
            <Stat label="Reveries" value={String(reveriesCount)} />
            <Divider />
            <Stat label="Since" value={sinceValue} />
          </View>

          <View style={{ height: spacing.lg }} />

          <QuickLink icon="bell" label="Notifications" onPress={() => router.push("/notifications")} testID="profile-notifications" />
          <QuickLink icon="users" label="My Bonds" onPress={() => router.push("/(app)/friends")} testID="profile-friends" />
          <QuickLink icon="shield" label="Blocked" onPress={() => router.push("/settings/blocked")} testID="profile-blocked" />
          {user.email === ADMIN_EMAIL && (
            <QuickLink icon="lock" label="Admin Panel" tint={colors.primary} onPress={() => router.push("/admin")} testID="profile-admin" />
          )}
          <QuickLink icon="log-out" label="Sign out" tint={colors.danger} onPress={async () => { await logout(); router.replace("/"); }} testID="profile-logout" />
        </View>
      </ScrollView>

      <Modal
        visible={onlineSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOnlineSheetOpen(false)}
      >
        <Pressable
          style={styles.onlineSheetOverlay}
          onPress={() => setOnlineSheetOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.onlineSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.onlineSheetHandle,
                { backgroundColor: colors.mutedFg },
              ]}
            />

            <NxText
              style={[
                styles.onlineSheetTitle,
                { color: colors.foreground },
              ]}
            >
              Change Online Status
            </NxText>

            {[
              {
                key: "online",
                label: "Online",
                description: "You're active and available",
                color: "#23A55A",
              },
              {
                key: "idle",
                label: "Idle",
                description: "You may be away for a while",
                color: "#F0B232",
              },
              {
                key: "dnd",
                label: "Do Not Disturb",
                description: "Show that you don't want to be disturbed",
                color: "#F23F43",
              },
              {
                key: "invisible",
                label: "Invisible",
                description: "Appear offline to everyone",
                color: "#80848E",
              },
            ].map((option) => {
              const selected =
                (user.online_status || "online") === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.75}
                  disabled={onlineStatusBusy}
                  onPress={async () => {
                    setOnlineStatusBusy(true);
                    try {
                      await updateUser({
                        online_status: option.key as
                          | "online"
                          | "idle"
                          | "dnd"
                          | "invisible",
                      });
                      setOnlineSheetOpen(false);
                    } finally {
                      setOnlineStatusBusy(false);
                    }
                  }}
                  style={[
                    styles.onlineSheetOption,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.onlineStatusIcon,
                      { backgroundColor: option.color },
                    ]}
                  >
                    {option.key === "dnd" ? (
                      <View style={styles.dndMinus} />
                    ) : option.key === "invisible" ? (
                      <View
                        style={[
                          styles.invisibleCenter,
                          { backgroundColor: colors.surface },
                        ]}
                      />
                    ) : null}
                  </View>

                  <View style={styles.onlineOptionText}>
                    <NxText
                      style={[
                        styles.onlineOptionLabel,
                        { color: colors.foreground },
                      ]}
                    >
                      {option.label}
                    </NxText>

                    <NxText
                      style={[
                        styles.onlineOptionDescription,
                        { color: colors.mutedFg },
                      ]}
                    >
                      {option.description}
                    </NxText>
                  </View>

                  {selected ? (
                    <Feather
                      name="check"
                      size={21}
                      color={colors.primary}
                    />
                  ) : (
                    <View style={{ width: 21 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <NxText variant="titleSm">{value}</NxText>
      <NxText variant="caption" style={{ marginTop: 2 }}>{label}</NxText>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ width: 1, height: 24, backgroundColor: colors.border }} />;
}

function QuickLink({ icon, label, onPress, testID, tint }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8} style={[styles.link, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.linkIcon, { backgroundColor: colors.surfaceHigh }]}>
        <Feather name={icon} size={16} color={tint || colors.foreground} />
      </View>
      <NxText style={{ marginLeft: 14, fontFamily: fonts.bodyMedium, color: tint || colors.foreground, fontSize: 14 }}>{label}</NxText>
      <View style={{ flex: 1 }} />
      <Feather name="chevron-right" size={18} color={colors.mutedFg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  coverWrap: { height: 200, position: "relative" },
  headerRow: { position: "absolute", top: spacing.md, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: spacing.lg },
  profileTopRow: {
    height: 86,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  editBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1 },
  statusWrap: {
    flex: 1,
    minWidth: 0,
    height: 78,
    marginLeft: 10,
    marginRight: 10,
    marginTop: -32,
    position: "relative",
    justifyContent: "flex-end",
  },
  statusBubble: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    width: "92%",
    minWidth: 0,
    minHeight: 58,
    maxHeight: 78,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
    overflow: "hidden",
  },
  thoughtDotSmall: {
    position: "absolute",
    left: -10,
    top: 7,
    width: 7,
    height: 7,
    borderRadius: 999,
    zIndex: 3,
  },
  thoughtDotLarge: {
    position: "absolute",
    left: 3,
    top: 16,
    width: 11,
    height: 11,
    borderRadius: 999,
    zIndex: 3,
  },
  statusPlus: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    flexShrink: 0,
  },
  onlineSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  onlineSheet: {
    borderWidth: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 28,
  },
  onlineSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    opacity: 0.45,
    marginBottom: 18,
  },
  onlineSheetTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 19,
    marginBottom: 8,
  },
  onlineSheetOption: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  onlineStatusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dndMinus: {
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  invisibleCenter: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  onlineOptionText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
  },
  onlineOptionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
  onlineOptionDescription: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  statsRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg },
  link: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm },
  linkIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});


function BirthdayGift({ color }: { color: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 700 }),
        withTiming(1, { duration: 700 })
      ),
      -1,
      true
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Feather name="gift" size={16} color={color} />
    </Animated.View>
  );
}
