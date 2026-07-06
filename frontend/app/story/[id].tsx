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
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";

const STORY_EMOJIS = ["❤️", "😂", "🔥", "😮", "👏"];

type FloatEmoji = { id: number; emoji: string; anim: Animated.Value };

export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = id as string;
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const router = useRouter();

  const [stories, setStories] = useState<any[]>([]);
  const [author, setAuthor] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [floatEmojis, setFloatEmojis] = useState<FloatEmoji[]>([]);
  const timerRef = useRef<any>(null);
  const emojiIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await api<{ feed: any[] }>("/stories/feed", { token });
    const g = (r.feed || []).find((x) => x.user?.user_id === userId);
    if (g) {
      setStories(g.stories);
      setAuthor(g.user);
    }
    setLoading(false);
  }, [token, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!stories.length) return;
    const s = stories[idx];
    if (s) api(`/stories/${s.story_id}/view`, { method: "POST", token: token! }).catch(() => {});
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => next(), 5000);
    return () => timerRef.current && clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, stories]);

  const next = () => {
    if (idx < stories.length - 1) setIdx(idx + 1);
    else router.back();
  };
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  const pauseTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };
  const resumeTimer = () => { timerRef.current = setTimeout(() => next(), 3000); };

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
    setFloatEmojis((prev) => [...prev, { id, emoji, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }).start(() => {
      setFloatEmojis((prev) => prev.filter((e) => e.id !== id));
    });

    /* send to backend (ephemeral WebSocket broadcast) */
    api(`/stories/${s.story_id}/react`, {
      method: "POST",
      body: { emoji },
      token,
    }).catch(() => {});
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
      <Image source={{ uri: s.media }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
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
              <NxText variant="titleSm" style={{ color: "#fff" }}>{author?.display_name}</NxText>
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
        <View style={styles.taps} pointerEvents="box-none">
          <TouchableOpacity testID="story-prev-tap" style={{ flex: 1 }} onPress={prev} />
          <TouchableOpacity testID="story-next-tap" style={{ flex: 1 }} onPress={next} />
        </View>

        {/* ── Caption ────────────────────────────────────────────── */}
        {s.caption ? (
          <View style={styles.captionBox}>
            <NxText style={styles.captionText}>{s.caption}</NxText>
          </View>
        ) : null}

        {/* ── Owner controls ─────────────────────────────────────── */}
        {isMine ? (
          <View style={styles.myControls}>
            <TouchableOpacity testID="story-viewers-btn" onPress={openViewers} style={styles.controlPill}>
              <Feather name="eye" size={14} color="#fff" />
              <NxText style={styles.controlPillText}>
                {s.viewers?.length || 0} viewers
              </NxText>
            </TouchableOpacity>
            <TouchableOpacity
              testID="story-delete-btn"
              onPress={deleteStory}
              style={[styles.controlPill, { backgroundColor: "rgba(224,60,60,0.38)" }]}
            >
              <Feather name="trash-2" size={14} color="#fff" />
              <NxText style={styles.controlPillText}>Delete</NxText>
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
            <View style={styles.emojiRow}>
              {STORY_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => reactToStory(emoji)}
                  style={styles.emojiBtn}
                  activeOpacity={0.75}
                >
                  <NxText style={styles.emojiText}>{emoji}</NxText>
                </TouchableOpacity>
              ))}
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
            <NxText variant="title" style={{ marginBottom: spacing.md }}>Viewers</NxText>
            <FlatList
              data={viewers}
              keyExtractor={(v, i) => v.user?.user_id || String(i)}
              renderItem={({ item }) => (
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
                  <Avatar uri={item.user?.profile_picture} name={item.user?.display_name} size={38} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <NxText variant="titleSm">{item.user?.display_name}</NxText>
                    <NxText variant="caption" style={{ color: colors.mutedFg }}>
                      {dayjs(item.viewed_at).fromNow()}
                    </NxText>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <NxText variant="bodySm" style={{ padding: 12, color: colors.mutedFg }}>
                  No viewers yet.
                </NxText>
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
  captionBox: {
    position: "absolute",
    bottom: 200,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  captionText: {
    color: "#fff",
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 20,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  myControls: {
    position: "absolute",
    bottom: 34,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  controlPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
    gap: 6,
  },
  controlPillText: {
    color: "#fff",
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
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
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: spacing.xl,
  },
  emojiBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  emojiText: { fontSize: 24 },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: 28,
    paddingTop: 4,
    gap: 10,
  },
  replyInput: {
    flex: 1,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 18,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Outfit",
  },
  replySend: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.18)",
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
});
