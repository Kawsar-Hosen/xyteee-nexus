import { Alert } from "react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import dayjs from "dayjs";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";

const STORY_EMOJIS = ["⭐", "❤️", "😂", "🔥", "😍", "👏", "👍", "😱"];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const STORY_TEXT_FONTS = [
  fonts.bodySemi,
  "serif",
  fonts.bodySemi,
  fonts.bodyMedium,
  "monospace",
  "sans-serif",
  "sans-serif-condensed",
  fonts.body,
  fonts.display,
  fonts.bodySemi,
];

type FloatEmoji = { id: number; emoji: string; anim: Animated.Value };

export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = id as string;
  const { colors } = useTheme();
  const { user, token } = useAuth();

  const router = useRouter();

  const [stories, setStories] = useState<any[]>([]);
  const [author, setAuthor] = useState<any>(null);
  const [storyAuthors, setStoryAuthors] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const swipeHintAnim = useRef(new Animated.Value(0)).current;

  const currentStory = stories[idx];

  const videoPlayer = useVideoPlayer(
    currentStory?.kind === "video" ? currentStory.media : null,
    (player) => {
      player.loop = true;
      player.play();
    }
  );
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [floatEmojis, setFloatEmojis] = useState<FloatEmoji[]>([]);
  const timerRef = useRef<any>(null);
  const storyStartedAtRef = useRef(Date.now());
  const remainingTimeRef = useRef(15000);
  const emojiIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await api<{ feed: any[] }>("/stories/feed", { token });
    const feed = r.feed || [];

    const tappedGroup = feed.find((x) => x.user?.user_id === userId);
    const otherGroups = feed.filter((x) => x.user?.user_id !== userId);
    const orderedGroups = tappedGroup
      ? [tappedGroup, ...otherGroups]
      : otherGroups;

    const allStories: any[] = [];
    const allAuthors: any[] = [];

    orderedGroups.forEach((group) => {
      const orderedStories = [...(group.stories || [])].reverse();

      orderedStories.forEach((story: any) => {
        allStories.push(story);
        allAuthors.push(group.user);
      });
    });

    setStories(allStories);
    setStoryAuthors(allAuthors);
    setAuthor(allAuthors[0] || null);
    setIdx(0);
    setLoading(false);
  }, [token, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (loading || !stories.length || !showSwipeHint) return;

    swipeHintAnim.setValue(0);

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(swipeHintAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(swipeHintAnim, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    const hideTimer = setTimeout(() => {
      animation.stop();
      setShowSwipeHint(false);
    }, 2200);

    return () => {
      clearTimeout(hideTimer);
      animation.stop();
    };
  }, [loading, stories.length, showSwipeHint, swipeHintAnim]);

  useEffect(() => {
    setAuthor(storyAuthors[idx] || null);
  }, [idx, storyAuthors]);

  useEffect(() => {
    if (!stories.length) return;
    const s = stories[idx];
    if (s) api(`/stories/${s.story_id}/view`, { method: "POST", token: token! }).catch(() => {});
    if (timerRef.current) clearTimeout(timerRef.current);
    remainingTimeRef.current = 15000;
    storyStartedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => next(), remainingTimeRef.current);
    return () => timerRef.current && clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, stories]);

  const next = () => {
    if (idx < stories.length - 1) setIdx(idx + 1);
    else router.back();
  };

  const prev = () => setIdx((i) => Math.max(0, i - 1));

  const storySwipe = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 12 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx),

      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dy) > 12 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx),

      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -70 || gesture.vy < -0.65) {
          next();
          return;
        }

        if (gesture.dy > 70 || gesture.vy > 0.65) {
          prev();
        }
      },
    })
  ).current;

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - storyStartedAtRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
  };

  const resumeTimer = () => {
    if (timerRef.current || remainingTimeRef.current <= 0) return;
    storyStartedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => next(), remainingTimeRef.current);
  };

  const openViewers = async () => {
    const s = stories[idx];
    if (!s) return;
    pauseTimer();
    const r = await api<{ viewers: any[] }>(`/stories/${s.story_id}/viewers`, { token: token! });
    setViewers(r.viewers || []);
    setShowViewers(true);
  };

  const deleteStory = async () => {
    const s = stories[idx];
    if (!s) return;
    await api(`/stories/${s.story_id}`, { method: "DELETE", token: token! });
    if (stories.length === 1) router.back();
    else {
      setStories((prev) => prev.filter((x) => x.story_id !== s.story_id));
      setIdx(0);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !author || !token) return;
    setSendingReply(true);
    try {
      const r = await api<{ conversation: any }>("/chats/open", {
        method: "POST",
        body: { user_id: author.user_id },
        token,
      });
      await api("/chats/message", {
        method: "POST",
        body: {
          conversation_id: r.conversation.conversation_id,
          kind: "text",
          content: replyText.trim(),
        },
        token,
      });
      setReplyText("");
      resumeTimer();
    } catch {
      /* ignore */
    } finally {
      setSendingReply(false);
    }
  };

  const reactToStory = async (emoji: string) => {
    const s = stories[idx];
    if (!s || !token) return;

    /* floating animation */
    const id = ++emojiIdRef.current;
    const anim = new Animated.Value(0);
    setFloatEmojis((prev) => [...prev, { id, emoji, anim }].slice(-5));
    Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }).start(() => {
      setFloatEmojis((prev) => prev.filter((e) => e.id !== id));
    });

    /* send to backend (ephemeral WebSocket broadcast) */
    api(`/stories/${s.story_id}/react`, {
      method: "POST",
      body: { emoji },
      token,
    }).catch((error) => {
      console.log("STORY REACTION RESPONSE ERROR:", error);
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  const s = stories[idx];

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <NxText style={{ color: "#fff" }}>No stories</NxText>
      </View>
    );
  }
  const isMine = author?.user_id === user?.user_id;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [
              { translateX: (s.media_x ?? 0) * SCREEN_W },
              { translateY: (s.media_y ?? 0) * SCREEN_H },
              { scale: s.media_scale ?? 1 },
            ],
          },
        ]}
      >
        {s.kind === "video" ? (
          <VideoView
            player={videoPlayer}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: s.media }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="contain"
          />
        )}
      </View>
      <View style={styles.overlay} />

      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        {/* ── Progress bars ──────────────────────────────────────── */}
        <View style={styles.progressRow}>
          {stories.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                { backgroundColor: i < idx ? "#fff" : i === idx ? "#fff" : "rgba(255,255,255,0.35)" },
              ]}
            />
          ))}
        </View>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.push(`/user/${author?.user_id}`)} style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Avatar uri={author?.profile_picture} name={author?.display_name} size={40} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <NxText variant="titleSm" style={{ color: "#fff" }}>{author?.display_name}</NxText>
                <VerifiedBadge badgeType={author?.badge_type} size={16} />
              </View>
              <NxText variant="caption" style={{ color: "rgba(255,255,255,0.65)" }}>
                {dayjs(s.created_at).fromNow()}
              </NxText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity testID="story-close-viewer" onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Tap zones ──────────────────────────────────────────── */}
        <View
          testID="story-swipe-zone"
          style={styles.taps}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            const { pageX, pageY } = event.nativeEvent;
            (event.currentTarget as any).__storyStart = { x: pageX, y: pageY };
          }}
          onResponderRelease={(event) => {
            const target = event.currentTarget as any;
            const start = target.__storyStart;
            if (!start) return;

            const { pageX, pageY } = event.nativeEvent;
            const dx = pageX - start.x;
            const dy = pageY - start.y;

            if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx)) {
              if (dy < 0) next();
              else prev();
              return;
            }

            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
              if (pageX < SCREEN_W / 2) prev();
              else next();
            }
          }}
        />

        {/* ── First-open swipe demo ─────────────────────────────── */}
        {showSwipeHint ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.swipeHint,
              {
                opacity: swipeHintAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.65, 1],
                }),
                transform: [
                  {
                    translateY: swipeHintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, -18],
                    }),
                  },
                ],
              },
            ]}
          >
            <Feather name="chevron-up" size={30} color="#fff" />
            <NxText style={styles.swipeHintText}>Swipe</NxText>
            <Feather name="chevron-down" size={30} color="#fff" />
          </Animated.View>
        ) : null}

        {/* ── Responsive saved story text ────────────────────────── */}
        {s.caption ? (
          <View
            pointerEvents="none"
            style={[
              styles.captionBox,
              {
                left: Math.max(
                  8,
                  Math.min(
                    SCREEN_W - 248,
                    Number(s.text_x ?? 0.08) * SCREEN_W
                  )
                ),
                top: Math.max(
                  105,
                  Math.min(
                    SCREEN_H - 250,
                    Number(s.text_y ?? 0.38) * SCREEN_H
                  )
                ),
              },
            ]}
          >
            <Text
              style={[
                styles.captionText,
                {
                  color: String(s.text_color || "#FFFFFF"),
                  fontSize: Math.max(
                    12,
                    Math.min(72, Number(s.text_size ?? 28))
                  ),
                  lineHeight: Math.round(
                    Math.max(12, Math.min(72, Number(s.text_size ?? 28))) * 1.25
                  ),
                  fontFamily:
                    STORY_TEXT_FONTS[
                      Math.max(
                        0,
                        Math.min(9, Number(s.font_index ?? 0))
                      )
                    ],
                },
              ]}
            >
              {s.caption}
            </Text>
          </View>
        ) : null}

        {/* ── Owner controls ─────────────────────────────────────── */}
        {isMine ? (
          <View style={styles.myControls}>
            <TouchableOpacity
              testID="story-viewers-btn"
              onPress={openViewers}
              activeOpacity={0.78}
              style={styles.ownerAction}
            >
              <View style={styles.ownerIcon}>
                <Feather name="bar-chart-2" size={19} color="#fff" />
              </View>
              <View style={styles.ownerActionText}>
                <NxText style={styles.ownerActionTitle}>
                  {s.viewers?.length || 0} {s.viewers?.length === 1 ? "Viewer" : "Viewers"}
                </NxText>
                <NxText style={styles.ownerActionHint}>Story insights</NxText>
              </View>
              <Feather name="chevron-up" size={18} color="rgba(255,255,255,0.62)" />
            </TouchableOpacity>

            <TouchableOpacity
              testID="story-delete-btn"
              onPress={deleteStory}
              activeOpacity={0.78}
              style={[styles.ownerIconButton, styles.ownerDeleteButton]}
            >
              <Feather name="trash-2" size={19} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Floating emoji reactions ────────────────────────────── */}
        {floatEmojis.map((fe) => (
          <Animated.Text
            key={fe.id}
            style={[
              styles.floatEmoji,
              {
                opacity: fe.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                transform: [
                  {
                    translateY: fe.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -200] }),
                  },
                  {
                    scale: fe.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.5, 1.3, 1] }),
                  },
                ],
              },
            ]}
          >
            {fe.emoji}
          </Animated.Text>
        ))}

        {/* ── Bottom: reactions + reply (only for others' stories) ── */}
        {!isMine ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.bottomSection}
          >
            {/* Quick emoji reactions */}
            <View style={styles.reactionTray}>
              {STORY_EMOJIS.map((emoji) => {
                const scale = new Animated.Value(1);

                const pressReaction = () => {
                  Animated.sequence([
                    Animated.spring(scale, {
                      toValue: 1.55,
                      useNativeDriver: true,
                      speed: 28,
                      bounciness: 14,
                    }),
                    Animated.spring(scale, {
                      toValue: 1,
                      useNativeDriver: true,
                      speed: 22,
                      bounciness: 12,
                    }),
                  ]).start();

                  reactToStory(emoji);
                };

                return (
                  <TouchableOpacity
                    key={emoji}
                    onPress={pressReaction}
                    style={styles.reactionItem}
                    activeOpacity={0.75}
                  >
                    <Animated.View
                      style={{
                        transform: [{ scale }],
                        zIndex: 20,
                      }}
                    >
                      {emoji === "❤️" ? (
  <Image
    source={require("../../assets/reactions/heart.png")}
    style={{ width: 34, height: 34 }}
    resizeMode="contain"
  />
) : (
  <NxText style={styles.emojiText}>{emoji}</NxText>
)}
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Reply bar */}
            <View style={styles.replyBar}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                onFocus={pauseTimer}
                onBlur={resumeTimer}
                placeholder={`Reply to ${author?.display_name ?? "story"}…`}
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.replyInput}
              />
              <TouchableOpacity
                onPress={sendReply}
                disabled={!replyText.trim() || sendingReply}
                style={[styles.replySend, { opacity: replyText.trim() ? 1 : 0.45 }]}
              >
                {sendingReply ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </SafeAreaView>

      {/* ── Viewers sheet ──────────────────────────────────────────── */}
      <Modal
        transparent
        visible={showViewers}
        onRequestClose={() => { setShowViewers(false); resumeTimer(); }}
        animationType="slide"
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
          onPress={() => { setShowViewers(false); resumeTimer(); }}
        >
          <View style={[styles.viewersSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.viewersHeader}>
              <View>
                <NxText style={styles.viewersTitle}>Story viewers</NxText>
                <NxText style={styles.viewersSubtitle}>
                  {viewers.length} {viewers.length === 1 ? "person has" : "people have"} seen your story
                </NxText>
              </View>

              <View style={styles.viewerCountBadge}>
                <Feather name="eye" size={14} color="#fff" />
                <NxText style={styles.viewerCountText}>{viewers.length}</NxText>
              </View>
            </View>

            <FlatList
              data={viewers}
              keyExtractor={(v, i) => v.user?.user_id || String(i)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.viewersList}
              renderItem={({ item }) => (
                <View style={styles.viewerRow}>
                  <Avatar
                    uri={item.user?.profile_picture}
                    name={item.user?.display_name}
                    size={46}
                  />

                  <View style={styles.viewerInfo}>
                    <View style={styles.viewerNameRow}>
                      <NxText style={styles.viewerName}>
                        {item.user?.display_name}
                      </NxText>
                      <VerifiedBadge badgeType={item.user?.badge_type} size={16} />
                    </View>

                    <View style={styles.viewerTimeRow}>
                      <Feather name="clock" size={12} color={colors.mutedFg} />
                      <NxText style={[styles.viewerTime, { color: colors.mutedFg }]}>
                        {dayjs(item.viewed_at).fromNow()}
                      </NxText>
                    </View>
                  </View>

                  <View style={styles.viewerReactions}>
                    {(item.reactions || (item.reaction ? [item.reaction] : []))
                      .slice(0, 5)
                      .map((emoji: string, reactionIndex: number) => (
                        <Text
                          key={`${item.user?.user_id || "viewer"}-${reactionIndex}`}
                          style={styles.viewerReactionEmoji}
                        >
                          {emoji}
                        </Text>
                      ))}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyViewers}>
                  <View style={styles.emptyViewersIcon}>
                    <Feather name="eye-off" size={22} color={colors.mutedFg} />
                  </View>
                  <NxText style={styles.emptyViewersTitle}>No viewers yet</NxText>
                  <NxText style={[styles.emptyViewersHint, { color: colors.mutedFg }]}>
                    People who view your story will appear here.
                  </NxText>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing.md,
    marginTop: 6,
  },
  progressSegment: { flex: 1, height: 3, borderRadius: 2 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    paddingTop: 10,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  taps: {
    position: "absolute",
    top: 90,
    bottom: 180,
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  swipeHint: {
    position: "absolute",
    top: "38%",
    alignSelf: "center",
    zIndex: 100,
    elevation: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  swipeHintText: {
    color: "#fff",
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 0.8,
    marginVertical: 2,
  },
  captionBox: {
    position: "absolute",
    width: 240,
    alignItems: "center",
    zIndex: 25,
    elevation: 25,
  },
  captionText: {
    maxWidth: 240,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  myControls: {
    position: "absolute",
    bottom: 28,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 40,
    elevation: 40,
  },
  ownerAction: {
    flex: 1,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(12,12,16,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  ownerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  ownerActionText: {
    flex: 1,
    marginLeft: 11,
  },
  ownerActionTitle: {
    color: "#fff",
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
  ownerActionHint: {
    color: "rgba(255,255,255,0.52)",
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  ownerIconButton: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  ownerDeleteButton: {
    backgroundColor: "rgba(239,68,68,0.24)",
    borderColor: "rgba(255,110,110,0.28)",
  },
  floatEmoji: {
    position: "absolute",
    bottom: 160,
    alignSelf: "center",
    fontSize: 40,
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 18,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  reactionTray: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 30,
    backgroundColor: "rgba(8,8,12,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    elevation: 14,
  },
  reactionItem: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 27,
    lineHeight: 34,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: 26,
    gap: 10,
  },
  replyInput: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(18,18,22,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 20,
    color: "#fff",
    fontSize: 16,
    fontFamily: "Outfit",
  },
  replySend: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(30,30,36,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewersSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.4)",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  viewersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  viewersTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 22,
  },
  viewersSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    opacity: 0.55,
    marginTop: 3,
  },
  viewerCountBadge: {
    minWidth: 48,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  viewerCountText: {
    color: "#fff",
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  viewersList: {
    paddingBottom: 8,
  },
  viewerRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  viewerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  viewerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewerName: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
  },
  viewerTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  viewerTime: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  viewerReactions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  viewerReactionEmoji: {
    fontSize: 22,
    marginLeft: -2,
  },
  emptyViewers: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyViewersIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    marginBottom: 12,
  },
  emptyViewersTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
  },
  emptyViewersHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
});
