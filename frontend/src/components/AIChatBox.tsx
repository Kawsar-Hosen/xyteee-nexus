/**
 * AIChatBox — AI support chat panel for XYTEEE Nexus.
 * • Draggable: grab the header to move anywhere on screen.
 * • Resizable: drag the bottom-right corner handle.
 * • Keyboard-aware: panel shifts up automatically when keyboard opens.
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
  Platform,
  ActivityIndicator,
  Animated,
  Pressable,
  Image,
  useWindowDimensions,
  PanResponder,
  Keyboard,
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

// ─── Constants ─────────────────────────────────────────────────────────────

const MIN_W = 260;
const MAX_W = 600;
const MIN_H = 300;
const MAX_H = 720;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Welcome message ────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your XYTEEE Nexus assistant 👋 Ask me anything about the app — chats, calls, friends, profiles, or anything else!",
};

// ─── User-search parser ─────────────────────────────────────────────────────

function parseUserSearch(text: string): { query: string; exact: boolean } | null {
  const t = text.trim();
  const atMatch = t.match(/^@(\S+)$/);
  if (atMatch) return { query: atMatch[1], exact: true };
  const cmdMatch = t.match(/^(?:search|find|show)\s+(.+?)(?:\s+profile)?$/i);
  if (cmdMatch) return { query: cmdMatch[1].trim(), exact: false };
  const banglaMatch = t.match(/^(.+?)\s+(?:এর\s+)?profile(?:\s+(?:দেখাও|দেখান))?$/i);
  if (banglaMatch) return { query: banglaMatch[1].trim(), exact: false };
  return null;
}

// ─── Main component ─────────────────────────────────────────────────────────

export function AIChatBox() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { open, toggle } = useAIChat();
  const { token } = useAuth();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Keep screen dims in a ref so PanResponder callbacks always see latest values
  const screenRef = useRef({ w: screenWidth, h: screenHeight });
  useEffect(() => {
    screenRef.current = { w: screenWidth, h: screenHeight };
  }, [screenWidth, screenHeight]);
  const insetsRef = useRef(insets);
  useEffect(() => { insetsRef.current = insets; }, [insets]);

  // ── Chat state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // ── Panel geometry ────────────────────────────────────────────────────
  // posRef / sizeRef hold the "committed" values between renders.
  // panelState drives the actual layout.
  const posRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const [panelState, setPanelState] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const initialised = useRef(false);

  const getDefaultGeometry = useCallback(() => {
    const w = clamp(Math.min(screenRef.current.w - 32, 360), MIN_W, MAX_W);
    const h = clamp(Math.min(screenRef.current.h * 0.55, 460), MIN_H, MAX_H);
    const x = (screenRef.current.w - w) / 2;
    const y = (screenRef.current.h - h) / 2;
    return { x, y, w, h };
  }, []);

  // ── Keyboard avoidance ────────────────────────────────────────────────
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKbHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKbHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Shift panel up if keyboard would cover it
  useEffect(() => {
    if (!mounted || !open) return;
    if (kbHeight > 0) {
      const { h: sh } = screenRef.current;
      const panelBottom = posRef.current.y + sizeRef.current.h;
      const kbTop = sh - kbHeight - 8;
      if (panelBottom > kbTop) {
        const newY = clamp(kbTop - sizeRef.current.h, insetsRef.current.top + 8, sh);
        posRef.current.y = newY;
        setPanelState((p) => ({ ...p, y: newY }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbHeight, mounted, open]);

  // ── Open / close animation ────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (open) {
      // Initialise geometry on very first open
      if (!initialised.current) {
        const g = getDefaultGeometry();
        posRef.current = { x: g.x, y: g.y };
        sizeRef.current = { w: g.w, h: g.h };
        setPanelState(g);
        initialised.current = true;
      }
      setMounted(true);
      Animated.parallel([
        Animated.spring(fadeAnim, { toValue: 1, damping: 22, stiffness: 280, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, damping: 22, stiffness: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(fadeAnim, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 0.92, damping: 22, stiffness: 280, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Drag (header) ─────────────────────────────────────────────────────
  const dragOrigin = useRef({ pageX: 0, pageY: 0, px: 0, py: 0 });

  const dragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        dragOrigin.current = {
          pageX: e.nativeEvent.pageX,
          pageY: e.nativeEvent.pageY,
          px: posRef.current.x,
          py: posRef.current.y,
        };
      },
      onPanResponderMove: (e) => {
        const { w: sw, h: sh } = screenRef.current;
        const dx = e.nativeEvent.pageX - dragOrigin.current.pageX;
        const dy = e.nativeEvent.pageY - dragOrigin.current.pageY;
        const newX = clamp(dragOrigin.current.px + dx, 0, sw - sizeRef.current.w);
        const newY = clamp(dragOrigin.current.py + dy, insetsRef.current.top, sh - sizeRef.current.h - 40);
        posRef.current = { x: newX, y: newY };
        setPanelState((p) => ({ ...p, x: newX, y: newY }));
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  // ── Resize (bottom-right corner) ──────────────────────────────────────
  const resizeOrigin = useRef({ pageX: 0, pageY: 0, w: 0, h: 0 });

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        resizeOrigin.current = {
          pageX: e.nativeEvent.pageX,
          pageY: e.nativeEvent.pageY,
          w: sizeRef.current.w,
          h: sizeRef.current.h,
        };
      },
      onPanResponderMove: (e) => {
        const { w: sw, h: sh } = screenRef.current;
        const dx = e.nativeEvent.pageX - resizeOrigin.current.pageX;
        const dy = e.nativeEvent.pageY - resizeOrigin.current.pageY;
        const newW = clamp(resizeOrigin.current.w + dx, MIN_W, Math.min(MAX_W, sw - 16));
        const newH = clamp(resizeOrigin.current.h + dy, MIN_H, Math.min(MAX_H, sh - 80));
        sizeRef.current = { w: newW, h: newH };
        setPanelState((p) => ({ ...p, w: newW, h: newH }));
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  // ── Scroll to bottom ──────────────────────────────────────────────────
  const scrollBottom = useCallback(
    (delay = 80) =>
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), delay),
    []
  );

  // ── Send ──────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollBottom();

    // User search intent
    const searchIntent = parseUserSearch(text);
    if (searchIntent) {
      try {
        const res = await fetch(
          `${API_BASE}/users/search?q=${encodeURIComponent(searchIntent.query)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        let found: UserResult[] = res.ok ? data.users || [] : [];
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
          { id: (Date.now() + 1).toString(), role: "assistant", content: "Couldn't search users. Check your connection." },
        ]);
      } finally {
        setLoading(false);
        scrollBottom();
      }
      return;
    }

    // AI chat
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
          content: res.ok ? data.reply : data.detail || "Sorry, something went wrong.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Couldn't reach the AI service. Check your connection." },
      ]);
    } finally {
      setLoading(false);
      scrollBottom();
    }
  }, [input, loading, messages, token, scrollBottom]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

      {/* Backdrop */}
      {mounted && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim, backgroundColor: "rgba(0,0,0,0.4)" }]}
          pointerEvents={open ? "auto" : "none"}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={toggle} />
        </Animated.View>
      )}

      {/* Floating panel */}
      {mounted && (
        <Animated.View
          style={[
            styles.panel,
            {
              left: panelState.x,
              top: panelState.y,
              width: panelState.w,
              height: panelState.h,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          pointerEvents="auto"
        >

          {/* ── Header / drag handle ── */}
          <BlurView
            intensity={Platform.OS === "ios" ? 50 : 20}
            tint={mode === "dark" ? "dark" : "light"}
            style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.glass }]}
            {...dragResponder.panHandlers}
          >
            {/* Drag hint bar */}
            <View style={[styles.dragBar, { backgroundColor: colors.border }]} />

            <View style={styles.headerInner}>
              <View style={styles.headerLeft}>
                <View style={[styles.aiDot, { backgroundColor: colors.primary }]}>
                  <Feather name="cpu" size={13} color={colors.onPrimary} />
                </View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>AI Support</Text>
                <View style={[styles.liveDot, { backgroundColor: colors.success ?? "#22c55e" }]} />
              </View>
              <TouchableOpacity onPress={toggle} hitSlop={12}>
                <Feather name="x" size={18} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* ── Messages ── */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <MessageBubble msg={item} colors={colors} router={router} onClose={toggle} />
            )}
          />

          {loading && (
            <View style={[styles.typingRow, { marginLeft: spacing.md }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.typingText, { color: colors.mutedFg }]}>Thinking…</Text>
            </View>
          )}

          {/* ── Input ── */}
          <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.accent, borderColor: colors.border }]}
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
              style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? colors.primary : colors.accent }]}
            >
              <Feather name="send" size={16} color={input.trim() && !loading ? colors.onPrimary : colors.mutedFg} />
            </TouchableOpacity>
          </View>

          {/* ── Resize handle (bottom-right corner) ── */}
          <View style={styles.resizeHandle} {...resizeResponder.panHandlers}>
            <Feather name="maximize-2" size={12} color={colors.mutedFg} style={{ transform: [{ rotate: "90deg" }] }} />
          </View>

        </Animated.View>
      )}
    </View>
  );
}

// ─── MessageBubble ──────────────────────────────────────────────────────────

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
              { color: isUser ? colors.bubbleSentFg ?? colors.onPrimary : colors.bubbleRecvFg ?? colors.foreground },
            ]}
          >
            {msg.content}
          </Text>
        </View>
        {msg.userResults && msg.userResults.length > 0 && (
          <View style={styles.cardList}>
            {msg.userResults.map((u) => (
              <UserProfileCard
                key={u.user_id}
                user={u}
                colors={colors}
                onViewProfile={() => { onClose(); router.push(`/user/${u.user_id}` as any); }}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── UserProfileCard ────────────────────────────────────────────────────────

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
    user.badge_type === "gold" ? "#F59E0B"
    : user.badge_type === "silver" ? "#94A3B8"
    : user.badge_type === "diamond" ? "#818CF8"
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardAvatar, { backgroundColor: colors.accent }]}>
          {user.profile_picture ? (
            <Image source={{ uri: user.profile_picture }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <Feather name="user" size={22} color={colors.mutedFg} />
          )}
        </View>
        <View style={styles.cardInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
              {user.display_name}
            </Text>
            {badgeColor && (
              <View style={[styles.badgeDot, { backgroundColor: badgeColor }]}>
                <Feather name="award" size={9} color="#fff" />
              </View>
            )}
          </View>
          <Text style={[styles.cardUsername, { color: colors.mutedFg }]}>@{user.username}</Text>
        </View>
      </View>
      <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onViewProfile} activeOpacity={0.8}
          style={[styles.cardBtn, { backgroundColor: colors.primary }]}>
          <Feather name="user" size={13} color={colors.onPrimary} />
          <Text style={[styles.cardBtnText, { color: colors.onPrimary }]}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewProfile} activeOpacity={0.8}
          style={[styles.cardBtn, { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.border }]}>
          <Feather name="message-circle" size={13} color={colors.foreground} />
          <Text style={[styles.cardBtnText, { color: colors.foreground }]}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Floating panel — positioned by left/top from state
  panel: {
    position: "absolute",
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 24,
  },

  // Header / drag handle
  header: {
    borderBottomWidth: 1,
    cursor: "grab" as any,
  },
  dragBar: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.4,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  headerTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },

  // Messages
  messageList: { padding: spacing.md, gap: 10, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAi: { justifyContent: "flex-start" },
  aiBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 4, marginRight: 4, flexShrink: 0 },
  bubble: { maxWidth: "82%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.lg },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },

  // User card
  cardList: { marginTop: 8, gap: 8, width: "100%", marginLeft: 6 },
  card: { borderRadius: radii.lg, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  cardAvatar: { width: 48, height: 48, borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: fonts.bodySemi, fontSize: 15 },
  cardUsername: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  badgeDot: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardDivider: { height: 1 },
  cardActions: { flexDirection: "row", gap: 8, padding: 10 },
  cardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: radii.pill },
  cardBtnText: { fontFamily: fonts.bodySemi, fontSize: 13 },

  // Typing indicator
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  typingText: { fontFamily: fonts.body, fontSize: 13 },

  // Input bar
  inputRow: { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, fontFamily: fonts.body, fontSize: 14 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },

  // Resize handle
  resizeHandle: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    cursor: "nwse-resize" as any,
  },
});
