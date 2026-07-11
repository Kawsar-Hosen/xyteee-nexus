import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [u, setU] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setNotFound(false);
      const r = await api<any>(`/users/${id}`, { token });
      setU(r);

      try {
        const storyResult = await api<{ feed: any[] }>("/stories/feed", { token });
        setHasStory(
          (storyResult.feed || []).some(
            (g: any) =>
              g.user?.user_id === id &&
              (g.stories || []).length > 0
          )
        );
      } catch {
        setHasStory(false);
      }
    } catch (e: any) {
      if (e?.status === 404) {
        setU(null);
        setNotFound(true);
      }
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

          <NxText variant="title" style={{ marginTop: 18 }}>
            User Not Found
          </NxText>

          <NxText
            variant="bodySm"
            style={{
              marginTop: 8,
              color: colors.mutedFg,
              textAlign: "center",
              maxWidth: 280,
            }}
          >
            This profile is unavailable.
          </NxText>
        </View>
      </SafeAreaView>
    );
  }

  if (!u) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <View style={styles.cover}>
          {u.cover_picture ? (
            <Image source={{ uri: u.cover_picture }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={StyleSheet.absoluteFillObject} />
          )}
          <TouchableOpacity testID="user-back" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.glass, position: "absolute", top: spacing.md, left: spacing.md }]}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={styles.profileTopRow}>
            <TouchableOpacity
              testID="user-profile-avatar"
              activeOpacity={hasStory ? 0.85 : 1}
              disabled={!hasStory}
              onPress={() => router.push(`/story/${id}`)}
              style={{
                marginTop: -50,
                width: hasStory ? 108 : 100,
                height: hasStory ? 108 : 100,
                alignItems: "center",
                justifyContent: "center",
              }}
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
                      uri={u.profile_picture}
                      name={u.display_name}
                      size={100}
                      online={u.online}
                      onlineStatus={u.online_status || "online"}
                    />
                  </View>
                </>
              ) : (
                <Avatar
                  uri={u.profile_picture}
                  name={u.display_name}
                  size={100}
                  online={u.online}
                  onlineStatus={u.online_status || "online"}
                />
              )}
            </TouchableOpacity>

            {!u.private_locked && u.status_text ? (
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

                <View
                  style={[
                    styles.statusBubble,
                    {
                      backgroundColor: colors.surface,
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
                    <Feather
                      name="plus"
                      size={12}
                      color={colors.background}
                    />
                  </View>

                  <AnimatedStatusText
                    color={colors.foreground}
                    style={{ flexShrink: 1 }}
                  >
                    {u.status_text}
                  </AnimatedStatusText>
                </View>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="title" style={{ flexShrink: 1 }}>{u.display_name}</NxText>
              <VerifiedBadge badgeType={u.badge_type} verifiedSince={u.verified_since} showInfo size={18} />
            </View>
            <NxText variant="bodySm">@{u.username}</NxText>
          </View>

          {!u.private_locked && u.bio ? (
            <NxText variant="body" style={{ marginTop: spacing.md }}>
              {u.bio}
            </NxText>
          ) : null}

          {!u.private_locked && u.birthday ? (
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
                Birthday · {new Date(`${u.birthday}T00:00:00`).toLocaleDateString(
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

          {!u.private_locked && (u.mutual_bonds_count ?? 0) > 0 ? (
            <View style={styles.mutualRow}>
              <View style={styles.mutualAvatars}>
                {(u.mutual_bonds_preview || []).slice(0, 3).map((person: any, index: number) => (
                  <View
                    key={person.user_id}
                    style={[
                      styles.mutualAvatarWrap,
                      {
                        marginLeft: index === 0 ? 0 : -7,
                        zIndex: 3 - index,
                        borderColor: colors.background,
                      },
                    ]}
                  >
                    <Avatar
                      uri={person.profile_picture}
                      name={person.display_name}
                      size={22}
                    />
                  </View>
                ))}
              </View>

              <NxText
                variant="bodySm"
                style={{ marginLeft: 7, color: colors.mutedFg, fontFamily: fonts.bodySemi }}
              >
                {u.mutual_bonds_count} Mutual {u.mutual_bonds_count === 1 ? "Bond" : "Bonds"}
              </NxText>
            </View>
          ) : null}

          {!u.private_locked ? (
            <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Stat label="Bonds" value={u.friend_count ?? 0} />
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <Stat label="Reveries" value={u.story_count ?? 0} />
            </View>
          ) : (
            <View
              style={[
                styles.privateCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.privateIcon,
                  { backgroundColor: colors.surfaceHigh },
                ]}
              >
                <Feather name="lock" size={24} color={colors.foreground} />
              </View>

              <NxText variant="titleSm" style={{ marginTop: 14 }}>
                This account is private
              </NxText>

              <NxText
                variant="bodySm"
                style={{
                  marginTop: 7,
                  color: colors.mutedFg,
                  textAlign: "center",
                  maxWidth: 280,
                }}
              >
                Send a bond request to see this profile's reveries and private content.
              </NxText>
            </View>
          )}

          <View style={{ height: spacing.lg }} />

          {u.relation === "friend" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity testID="user-message" onPress={openChat} style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Message</NxText>
              </TouchableOpacity>
              <TouchableOpacity testID="user-unfriend" disabled={busy} onPress={() => act("/friends/unfriend")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="user-x" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity testID="user-block" disabled={busy} onPress={() => act("/friends/block")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="slash" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : u.relation === "requested" ? (
            <TouchableOpacity testID="user-cancel-req" disabled={busy} onPress={() => act("/friends/cancel")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}>
              <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Request sent · Cancel</NxText>
            </TouchableOpacity>
          ) : u.relation === "incoming" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity testID="user-accept" disabled={busy} onPress={() => act("/friends/accept")} style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Accept request</NxText>
              </TouchableOpacity>
              <TouchableOpacity testID="user-reject" disabled={busy} onPress={() => act("/friends/reject")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="x" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          ) : u.relation === "blocked" ? (
            <TouchableOpacity testID="user-unblock" disabled={busy} onPress={() => act("/friends/unblock")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}>
              <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Unblock</NxText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity testID="user-add" disabled={busy} onPress={() => act("/friends/request")} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
              <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Send bond request</NxText>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <NxText variant="titleSm">{String(value)}</NxText>
      <NxText variant="caption" style={{ marginTop: 2 }}>{label}</NxText>
    </View>
  );
}

const styles = StyleSheet.create({
  notFoundHeader: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notFoundBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: 80,
  },
  notFoundAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cover: { height: 200 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  profileTopRow: {
    height: 86,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  statusWrap: {
    flex: 1,
    height: 78,
    marginLeft: 10,
    marginTop: -32,
    position: "relative",
    justifyContent: "flex-end",
  },
  statusBubble: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
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
  mutualRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    alignSelf: "flex-start",
  },
  mutualAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  mutualAvatarWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  statsRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg },
  privateCard: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 28,
    alignItems: "center",
  },
  privateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: { height: 52, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
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
