/**
 * AIChatBox — AI support chat panel for XYTEEE Nexus.
 * • Always-visible FAB (floating cpu button) — single trigger point.
 * • User search: type @username or "search name" → shows profile card inline.
 * • Powered by Gemini via /api/ai/chat.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Pressable,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/context/ThemeContext";
import { useAIChat } from "@/src/context/AIChatContext";
import { useAuth } from "@/src/context/AuthContext";
import { API_BASE } from "@/src/api/client";
import { fonts, radii, spacing } from "@/src/theme";

// ─── Types ─────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface UserResult {
  user_id: string;
  username: string;
  display_name: string;
  profile_picture?: string;
  badge_type?: string | null;
}

interface Message {
  id: string;
  role: Role;
  content: string;
  userResults?: UserResult[]; // populated for search results
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your XYTEEE Nexus assistant 👋 Ask me anything about the app — chats, calls, friends, profiles, or anything else!",
};

/** Returns search query string if message looks like a user search, else null. */
function parseUserSearch(text: string): string | null {
  const t = text.trim();

  // @username
  const atMatch = t.match(/^@(\S+)$/);
  if (atMatch) return atMatch[1];

  // "search X", "find X"
  const cmdMatch = t.match(/^(?:search|find|show)\s+(.+?)(?:\s+(?:profile))?$/i);
  if (cmdMatch) return cmdMatch[1].trim();

  // "X profile দেখাও / দেখান", "X এর profile"
  const banglaMatch = t.match(/^(.+?)\s+(?:এর\s+)?profile(?:\s+(?:দেখাও|দেখান))?$/i);
  if (banglaMatch) return banglaMatch[1].trim();

  return null;
}

// ─── Main component ────────────────────────────────────────────────────────

export function AIChatBox() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { open, toggle } = useAIChat();
  const { token } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Message>>(null);

  // Animate panel open / close
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: open ? 1 : 0,
      damping: 20,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  }, [open, slideAnim]);

  const scrollBottom = useCallback(
    (delay = 80) => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), delay),
    []
  );

  // ─── Send handler ───────────────────────────────────────────────────────

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollBottom();

    // ── User search intent? ─────────────────────────────────────────────
    const searchQuery = parseUserSearch(text);
    if (searchQuery) {
      try {
        const res = await fetch(
          `${API_BASE}/users/search?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        const found: UserResult[] = res.ok ? data.users || [] : [];

        const reply: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            found.length > 0
              ? `Found ${found.length} user${found.length > 1 ? "s" : ""} for "${searchQuery}":`
              : `No users found for "${searchQuery}". Try a different name or username.`,
          userResults: found.length > 0 ? found : undefined,
        };
        setMessages((prev) => [...prev, reply]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Couldn't search users. Check your connection.",
          },
        ]);
      } finally {
        setLoading(false);
        scrollBottom();
      }
      return;
    }

    // ── AI chat ─────────────────────────────────────────────────────────
    try {
      const history = [...messages, userMsg];
      const payload = history
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content }));

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      const data = await res.json();
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.ok
          ? data.reply
          : data.detail || "Sorry, something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Couldn't reach the AI service. Check your connection.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollBottom();
    }
  }, [input, loading, messages, token, scrollBottom]);

  // ─── Layout values ──────────────────────────────────────────────────────

  const panelTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 0.4],
    outputRange: [0, 1],
  });

  const DOCK_HEIGHT = 72 + Math.max(insets.bottom, 8);
  const FAB_BOTTOM = DOCK_HEIGHT + 14;
  const PANEL_BOTTOM = DOCK_HEIGHT + 70;
  const PANEL_TOP = insets.top + 8;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: backdropOpacity, backgroundColor: "rgba(0,0,0,0.45)" },
        ]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={toggle} />
      </Animated.View>

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.panel,
          {
            top: PANEL_TOP,
            bottom: PANEL_BOTTOM,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            transform: [{ translateY: panelTranslate }],
          },
        ]}
        pointerEvents={open ? "auto" : "none"}
      >
        {/* Panel header */}
        <BlurView
          intensity={Platform.OS === "ios" ? 50 : 20}
          tint={mode === "dark" ? "dark" : "light"}
          style={[
            styles.panelHeader,
            { borderBottomColor: colors.border, backgroundColor: colors.glass },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.aiDot, { backgroundColor: colors.primary }]}>
              <Feather name="cpu" size={13} color={colors.onPrimary} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              AI Support
            </Text>
            <View style={[styles.liveDot, { backgroundColor: colors.success ?? "#22c55e" }]} />
          </View>
          <TouchableOpacity onPress={toggle} hitSlop={12}>
            <Feather name="x" size={18} color={colors.mutedFg} />
          </TouchableOpacity>
        </BlurView>

        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <MessageBubble
              msg={item}
              colors={colors}
              router={router}
              onClose={toggle}
            />
          )}
        />

        {loading && (
          <View style={[styles.typingRow, { marginLeft: spacing.md }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.typingText, { color: colors.mutedFg }]}>Thinking…</Text>
          </View>
        )}

        {/* Input row */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={[
              styles.inputRow,
              { borderTopColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.accent,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Ask anything or @username…"
              placeholderTextColor={colors.mutedFg}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline={false}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!input.trim() || loading}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    input.trim() && !loading ? colors.primary : colors.accent,
                },
              ]}
            >
              <Feather
                name="send"
                size={16}
                color={input.trim() && !loading ? colors.onPrimary : colors.mutedFg}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

    </View>
  );
}

// ─── MessageBubble ─────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  colors,
  router,
  onClose,
}: {
  msg: Message;
  colors: any;
  router: ReturnType<typeof useRouter>;
  onClose: () => void;
}) {
  const isUser = msg.role === "user";

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]}>
      {!isUser && (
        <View style={[styles.aiBadge, { backgroundColor: colors.primary }]}>
          <Feather name="cpu" size={10} color={colors.onPrimary} />
        </View>
      )}

      <View style={{ flex: 1, alignItems: isUser ? "flex-end" : "flex-start" }}>
        {/* Text bubble */}
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.bubbleSent ?? colors.primary, alignSelf: "flex-end" }
              : { backgroundColor: colors.bubbleRecv ?? colors.accent, alignSelf: "flex-start", marginLeft: 6 },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              {
                color: isUser
                  ? (colors.bubbleSentFg ?? colors.onPrimary)
                  : (colors.bubbleRecvFg ?? colors.foreground),
              },
            ]}
          >
            {msg.content}
          </Text>
        </View>

        {/* User profile cards (search results) */}
        {msg.userResults && msg.userResults.length > 0 && (
          <View style={styles.userCardList}>
            {msg.userResults.map((u) => (
              <TouchableOpacity
                key={u.user_id}
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  router.push(`/user/${u.user_id}` as any);
                }}
                style={[
                  styles.userCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {/* Avatar */}
                <View style={[styles.userCardAvatar, { backgroundColor: colors.accent }]}>
                  {u.profile_picture ? (
                    <Image
                      source={{ uri: u.profile_picture }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  ) : (
                    <Feather name="user" size={18} color={colors.mutedFg} />
                  )}
                </View>

                {/* Info */}
                <View style={styles.userCardInfo}>
                  <Text
                    style={[styles.userCardName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {u.display_name}
                    {u.badge_type === "verified" && (
                      <Text style={{ color: colors.primary }}> ✓</Text>
                    )}
                  </Text>
                  <Text style={[styles.userCardUsername, { color: colors.mutedFg }]}>
                    @{u.username}
                  </Text>
                </View>

                {/* Arrow */}
                <Feather name="chevron-right" size={16} color={colors.mutedFg} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Panel
  panel: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  headerTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },

  // Messages
  messageList: { padding: spacing.md, gap: 10, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAi: { justifyContent: "flex-start" },
  aiBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginRight: 4,
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
  },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },

  // User search cards
  userCardList: { marginTop: 6, gap: 6, width: "100%" },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginLeft: 6,
  },
  userCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  userCardInfo: { flex: 1 },
  userCardName: { fontFamily: fonts.bodySemi, fontSize: 14 },
  userCardUsername: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },

  // Typing / input
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  typingText: { fontFamily: fonts.body, fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  // FAB
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 101,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});
