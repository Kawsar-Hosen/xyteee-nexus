/**
 * AIChatBox — floating AI support assistant for XYTEEE Nexus.
 * Renders a gold bubble button (bottom-right, above the dock) that opens
 * a slide-up chat panel powered by /api/ai/chat.
 */

import React, { useState, useRef, useCallback } from "react";
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

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Message>>(null);

  const toggleOpen = useCallback(() => {
    if (open) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setOpen(false));
    } else {
      setOpen(true);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [open, slideAnim]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

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
          content: "Couldn't reach the AI service. Check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [input, loading, messages]);

  // Panel slides up from below
  const panelTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  const DOCK_HEIGHT = 72 + Math.max(insets.bottom, 8);
  const BUTTON_BOTTOM = DOCK_HEIGHT + 12;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <Pressable
          style={[StyleSheet.absoluteFillObject, { zIndex: 99 }]}
          onPress={toggleOpen}
        />
      )}

      {/* Slide-up chat panel */}
      {open && (
        <Animated.View
          style={[
            styles.panel,
            {
              bottom: BUTTON_BOTTOM + 60,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ translateY: panelTranslate }],
              zIndex: 100,
            },
          ]}
        >
          {/* Header */}
          <BlurView
            intensity={Platform.OS === "ios" ? 50 : 20}
            tint={mode === "dark" ? "dark" : "light"}
            style={[
              styles.header,
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
            </View>
            <TouchableOpacity onPress={toggleOpen} hitSlop={12}>
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
              <MessageBubble msg={item} colors={colors} />
            )}
          />

          {/* Typing indicator */}
          {loading && (
            <View style={[styles.typingRow, { marginLeft: spacing.md }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.typingText, { color: colors.mutedFg }]}>
                Thinking…
              </Text>
            </View>
          )}

          {/* Input bar */}
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

      {/* Floating button */}
      <TouchableOpacity
        onPress={toggleOpen}
        activeOpacity={0.85}
        style={[
          styles.fab,
          {
            bottom: BUTTON_BOTTOM,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            zIndex: 101,
          },
        ]}
      >
        <Feather
          name={open ? "x" : "cpu"}
          size={22}
          color={colors.onPrimary}
        />
      </TouchableOpacity>
    </>
  );
}

function MessageBubble({
  msg,
  colors,
}: {
  msg: Message;
  colors: ReturnType<typeof useTheme>["colors"];
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
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.bubbleSent, alignSelf: "flex-end" }
            : {
                backgroundColor: colors.bubbleRecv,
                alignSelf: "flex-start",
                marginLeft: 6,
              },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? colors.bubbleSentFg : colors.bubbleRecvFg },
          ]}
        >
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    right: spacing.lg,
    left: spacing.lg,
    maxHeight: 440,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
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
  aiDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
  messageList: {
    padding: spacing.md,
    gap: 10,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
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
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
  },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 6,
  },
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
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});
