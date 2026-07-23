/**
 * AIChatBox — AI support chat panel for XYTEEE Nexus.
 * Controlled via AIChatContext (toggle from any header icon).
 * Renders as a full-screen absolute overlay so it floats above all content.
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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import { useTheme } from "@/src/context/ThemeContext";
import { useAIChat } from "@/src/context/AIChatContext";
import { API_BASE } from "@/src/api/client";
import { fonts, radii, spacing } from "@/src/theme";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
}

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your XYTEEE Nexus assistant 👋 Ask me anything about the app — chats, calls, friends, profiles, or anything else!",
};

export function AIChatBox() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { open, toggle } = useAIChat();

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Message>>(null);

  // Animate when open changes
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: open ? 1 : 0,
      damping: 20,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  }, [open, slideAnim]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    try {
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
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [input, loading, messages]);

  const panelTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });
  const opacity = slideAnim.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1] });

  const PANEL_BOTTOM = 72 + Math.max(insets.bottom, 8) + 8;
  const PANEL_TOP = insets.top + 8;

  if (!open) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity, backgroundColor: "rgba(0,0,0,0.45)" }]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={toggle} />
      </Animated.View>

      {/* Chat panel */}
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
        pointerEvents="auto"
      >
        {/* Header */}
        <BlurView
          intensity={Platform.OS === "ios" ? 50 : 20}
          tint={mode === "dark" ? "dark" : "light"}
          style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.glass }]}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.aiDot, { backgroundColor: colors.primary }]}>
              <Feather name="cpu" size={13} color={colors.onPrimary} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              AI Support
            </Text>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
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
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <MessageBubble msg={item} colors={colors} />}
        />

        {loading && (
          <View style={[styles.typingRow, { marginLeft: spacing.md }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.typingText, { color: colors.mutedFg }]}>Thinking…</Text>
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.accent, borderColor: colors.border }]}
              placeholder="Ask me anything…"
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
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

function MessageBubble({ msg, colors }: { msg: Message; colors: any }) {
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]}>
      {!isUser && (
        <View style={[styles.aiBadge, { backgroundColor: colors.primary }]}>
          <Feather name="cpu" size={10} color={colors.onPrimary} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.bubbleSent, alignSelf: "flex-end" }
            : { backgroundColor: colors.bubbleRecv, alignSelf: "flex-start", marginLeft: 6 },
        ]}
      >
        <Text style={[styles.bubbleText, { color: isUser ? colors.bubbleSentFg : colors.bubbleRecvFg }]}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  headerTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },
  messageList: { padding: spacing.md, gap: 10, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAi: { justifyContent: "flex-start" },
  aiBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  bubble: { maxWidth: "82%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.lg },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  typingText: { fontFamily: fonts.body, fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, fontFamily: fonts.body, fontSize: 14 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
