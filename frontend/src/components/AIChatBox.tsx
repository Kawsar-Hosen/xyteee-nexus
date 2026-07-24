/**
 * AIChatBox — AI support chat panel for XYTEEE Nexus.
 * • Panel only mounts when open (prevents footer bleed-through).
 * • User search: @username (exact) or "search name" (fuzzy) → rich profile card.
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
  useWindowDimensions,
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
  userResults?: UserResult[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your XYTEEE Nexus assistant 👋 Ask me anything about the app — chats, calls, friends, profiles, or anything else!",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns { query, exact } if message looks like a user search.
 * exact=true → @username search (filter to exact username match).
 * exact=false → display_name fuzzy search.
 */
function parseUserSearch(text: string): { query: string; exact: boolean } | null {
  const t = text.trim();

  // @username  →  exact username lookup
  const atMatch = t.match(/^@(\S+)$/);
  if (atMatch) return { query: atMatch[1], exact: true };

  // "search X", "find X", "show X"
  const cmdMatch = t.match(/^(?:search|find|show)\s+(.+?)(?:\s+profile)?$/i);
  if (cmdMatch) return { query: cmdMatch[1].trim(), exact: false };

  // "X এর profile", "X profile দেখাও / দেখান"
  const banglaMatch = t.match(/^(.+?)\s+(?:এর\s+)?profile(?:\s+(?:দেখাও|দেখান))?$/i);
  if (banglaMatch) return { query: banglaMatch[1].trim(), exact: false };

  return null;
}

// ─── Main component ────────────────────────────────────────────────────────

export function AIChatBox() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { open, toggle } = useAIChat();
  const { token } = useAuth();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // mounted controls whether the panel DOM node exists at all.
  // It stays true during the close animation so the slide-out plays,
  // then becomes false so nothing renders (fixes footer bleed-through).
  const [mounted, setMounted] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Message>>(null);

  const DOCK_HEIGHT = 72 + Math.max(insets.bottom, 8);
  const PANEL_BOTTOM = DOCK_HEIGHT + 10;
  // Panel takes ~46% of screen height — compact so footer is never pushed down
  const PANEL_HEIGHT = Math.min(screenHeight * 0.46, screenHeight - (insets.top + 16) - PANEL_BOTTOM);

  // Open/close animation — only mount while open or animating
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.spring(slideAnim, {
        toValue: 1,
        damping: 22,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open]);

  const panelTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_HEIGHT + 60, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: [0, 1],
  });

  const scrollBottom = useCallback(
    (delay = 80) =>
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), delay),
    []
  );

  // ─── Send ──────────────────────────────────────────────────────────────

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollBottom();

    // ── User search ───────────────────────────────────────────────────
    const searchIntent = parseUserSearch(text);
    if (searchIntent) {
      try {
        const res = await fetch(
          `${API_BASE}/users/search?q=${encodeURIComponent(searchIntent.query)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        let found: UserResult[] = res.ok ? data.users || [] : [];

        // Exact @username → keep only exact username match
        if (searchIntent.exact) {
          found = found.filter(
            (u) => u.username.toLowerCase() === searchIntent.query.toLowerCase()
          );
        }

        const reply: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            found.length > 0
              ? `${found.length} user${found.length > 1 ? "s" : ""} found:`
              : `No users found for "${searchIntent.query}". Try a different name or @username.`,
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

    // ── AI chat ────────────────────────────────────────────────────────
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
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.ok
            ? data.reply
            : data.detail || "Sorry, something went wrong. Please try again.",
        },
      ]);
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

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

      {/* Backdrop — only interactive when open */}
      {mounted && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: backdropOpacity,
              backgroundColor: "rgba(0,0,0,0.5)",
            },
          ]}
          pointerEvents={open ? "auto" : "none"}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={toggle} />
        </Animated.View>
      )}

      {/* Chat panel — conditionally mounted to prevent footer bleed */}
      {mounted && (
        <Animated.View
          style={[
            styles.panel,
            {
              bottom: PANEL_BOTTOM,
              height: PANEL_HEIGHT,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ translateY: panelTranslate }],
            },
          ]}
          pointerEvents="auto"
        >
          {/* Header */}
          <BlurView
            intensity={Platform.OS === "ios" ? 50 : 20}
            tint={mode === "dark" ? "dark" : "light"}
            style={[
              styles.panelHeader,
              {
                borderBottomColor: colors.border,
                backgroundColor: colors.glass,
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <View style={[styles.aiDot, { backgroundColor: colors.primary }]}>
                <Feather name="cpu" size={13} color={colors.onPrimary} />
              </View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                AI Support
              </Text>
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: colors.success ?? "#22c55e" },
                ]}
              />
            </View>
            <TouchableOpacity onPress={toggle} hitSlop={12}>
              <Feather name="x" size={18} color={colors.mutedFg} />
            </TouchableOpacity>
          </BlurView>

          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
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
              <Text style={[styles.typingText, { color: colors.mutedFg }]}>
                Thinking…
              </Text>
            </View>
          )}

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={[
                styles.inputRow,
                {
                  borderTopColor: colors.border,
                  backgroundColor: colors.surface,
                },
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
                      input.trim() && !loading
                        ? colors.primary
                        : colors.accent,
                  },
                ]}
              >
                <Feather
                  name="send"
                  size={16}
                  color={
                    input.trim() && !loading
                      ? colors.onPrimary
                      : colors.mutedFg
                  }
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}
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
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAi,
      ]}
    >
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
              ? {
                  backgroundColor: colors.bubbleSent ?? colors.primary,
                  alignSelf: "flex-end",
                }
              : {
                  backgroundColor: colors.bubbleRecv ?? colors.accent,
                  alignSelf: "flex-start",
                  marginLeft: 6,
                },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              {
                color: isUser
                  ? colors.bubbleSentFg ?? colors.onPrimary
                  : colors.bubbleRecvFg ?? colors.foreground,
              },
            ]}
          >
            {msg.content}
          </Text>
        </View>

        {/* User profile cards */}
        {msg.userResults && msg.userResults.length > 0 && (
          <View style={styles.cardList}>
            {msg.userResults.map((u) => (
              <UserProfileCard
                key={u.user_id}
                user={u}
                colors={colors}
                onViewProfile={() => {
                  onClose();
                  router.push(`/user/${u.user_id}` as any);
                }}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── UserProfileCard ───────────────────────────────────────────────────────

function UserProfileCard({
  user,
  colors,
  onViewProfile,
}: {
  user: UserResult;
  colors: any;
  onViewProfile: () => void;
}) {
  const badgeColor =
    user.badge_type === "gold"
      ? "#F59E0B"
      : user.badge_type === "silver"
      ? "#94A3B8"
      : user.badge_type === "diamond"
      ? "#818CF8"
      : null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Avatar row */}
      <View style={styles.cardTop}>
        <View
          style={[styles.cardAvatar, { backgroundColor: colors.accent }]}
        >
          {user.profile_picture ? (
            <Image
              source={{ uri: user.profile_picture }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <Feather name="user" size={22} color={colors.mutedFg} />
          )}
        </View>

        <View style={styles.cardInfo}>
          {/* Name + badge */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text
              style={[styles.cardName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {user.display_name}
            </Text>
            {badgeColor && (
              <View
                style={[styles.badgeDot, { backgroundColor: badgeColor }]}
              >
                <Feather name="award" size={9} color="#fff" />
              </View>
            )}
          </View>
          {/* Username */}
          <Text style={[styles.cardUsername, { color: colors.mutedFg }]}>
            @{user.username}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          onPress={onViewProfile}
          activeOpacity={0.8}
          style={[styles.cardBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="user" size={13} color={colors.onPrimary} />
          <Text style={[styles.cardBtnText, { color: colors.onPrimary }]}>
            View Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onViewProfile}
          activeOpacity={0.8}
          style={[
            styles.cardBtn,
            { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Feather name="message-circle" size={13} color={colors.foreground} />
          <Text style={[styles.cardBtnText, { color: colors.foreground }]}>
            Message
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Panel — positioned from bottom with fixed height
  panel: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
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
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
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
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
  },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },

  // User card list
  cardList: { marginTop: 8, gap: 8, width: "100%", marginLeft: 6 },

  // User profile card
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: fonts.bodySemi, fontSize: 15 },
  cardUsername: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  badgeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDivider: { height: 1 },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  cardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  cardBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },

  // Typing
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  typingText: { fontFamily: fonts.body, fontSize: 13 },

  // Input
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
});
