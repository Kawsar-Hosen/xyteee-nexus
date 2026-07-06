import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  withRepeat,
  ZoomIn,
  ZoomOut,
  FadeIn,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import dayjs from "dayjs";
import * as Clipboard from "expo-clipboard";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VoiceBubble } from "@/src/components/VoiceBubble";
import { useVoiceRecorder } from "@/src/hooks/useVoiceRecorder";
import { fonts, radii, spacing } from "@/src/theme";

const REACTIONS = ["❤️", "😂", "🔥", "😮", "😢", "👏", "👍"];

type Reaction = { user_id: string; emoji: string; at?: string };

type Msg = {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  kind: string;
  media?: string | null;
  reply_to?: string | null;
  edited?: boolean;
  deleted_for_everyone?: boolean;
  read_by?: string[];
  reactions?: Reaction[];
  created_at: string;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation_id = id as string;
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { subscribe, send } = useWs();
  const router = useRouter();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<any>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);
  const [actionMsg, setActionMsg] = useState<Msg | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);

  const { state: recState, elapsed: recElapsed, start: recStart, stop: recStop, cancel: recCancel } = useVoiceRecorder();

  const load = useCallback(async () => {
    if (!token || !conversation_id) return;
    try {
      const chats = await api<{ chats: any[] }>("/chats", { token });
      const c = (chats.chats || []).find((x) => x.conversation_id === conversation_id);
      if (c) setOther(c.other_user);
      const r = await api<{ messages: Msg[] }>(`/chats/${conversation_id}/messages`, { token, query: { limit: 100 } });
      setMessages(r.messages || []);
    } finally {
      setLoading(false);
    }
  }, [token, conversation_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "message" && e.message.conversation_id === conversation_id) {
        setMessages((prev) => (prev.some((m) => m.message_id === e.message.message_id) ? prev : [...prev, e.message]));
      } else if (e.type === "message_edit" && e.message.conversation_id === conversation_id) {
        setMessages((prev) => prev.map((m) => (m.message_id === e.message.message_id ? e.message : m)));
      } else if (e.type === "message_react" && e.message.conversation_id === conversation_id) {
        setMessages((prev) => prev.map((m) => (m.message_id === e.message.message_id ? e.message : m)));
      } else if (e.type === "message_delete") {
        setMessages((prev) => prev.map((m) => (m.message_id === e.message_id ? { ...m, deleted_for_everyone: true, content: "", media: null, kind: "deleted" } : m)));
      } else if (e.type === "typing" && e.conversation_id === conversation_id && e.user_id !== user?.user_id) {
        setOtherTyping(e.is_typing);
      } else if (e.type === "presence" && e.user_id === other?.user_id) {
        setOther((o: any) => (o ? { ...o, online: e.online, last_seen: e.last_seen } : o));
      }
    });
  }, [subscribe, conversation_id, user, other?.user_id]);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const emitTyping = (isTyping: boolean) => {
    send({ type: "typing", conversation_id, is_typing: isTyping });
  };

  const onChangeText = (t: string) => {
    setText(t);
    if (t.length > 0) {
      emitTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => emitTyping(false), 2000);
    } else {
      emitTyping(false);
    }
  };

  const submit = async () => {
    if (!text.trim() && !editing) return;
    if (editing) {
      const t = text;
      setEditing(null);
      setText("");
      await api(`/chats/message/${editing.message_id}`, { method: "PUT", body: { content: t }, token: token! });
      return;
    }
    setSending(true);
    const body: any = { conversation_id, content: text.trim(), kind: "text" };
    if (replyTo) body.reply_to = replyTo.message_id;
    setText("");
    setReplyTo(null);
    emitTyping(false);
    try {
      await api<Msg>("/chats/message", { method: "POST", body, token: token! });
    } finally {
      setSending(false);
    }
  };

  const sendImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
    await api("/chats/message", { method: "POST", body: { conversation_id, kind: "image", media: dataUrl, content: "" }, token: token! });
  };

  /* ── Voice recording ──────────────────────────────────────────────── */
  const handleMicPress = async () => {
    if (recState === "idle") {
      try {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch {}
      await recStart();
    }
  };

  const handleMicRelease = async () => {
    if (recState !== "recording") return;
    const result = await recStop();
    if (!result) return;
    setSending(true);
    try {
      await api("/chats/message", {
        method: "POST",
        body: {
          conversation_id,
          kind: "voice",
          media: result.uri,
          content: result.durationStr,
        },
        token: token!,
      });
    } finally {
      setSending(false);
    }
  };

  const doDelete = async (scope: "me" | "everyone") => {
    if (!actionMsg) return;
    await api(`/chats/message/${actionMsg.message_id}`, { method: "DELETE", token: token!, query: { scope } });
    setActionMsg(null);
    if (scope === "me") {
      setMessages((prev) => prev.filter((m) => m.message_id !== actionMsg.message_id));
    }
  };

  const doReact = async (emoji: string) => {
    if (!actionMsg) return;
    const target = actionMsg;
    setActionMsg(null);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}
    setMessages((prev) => prev.map((m) => {
      if (m.message_id !== target.message_id) return m;
      const mine = (m.reactions || []).find((r) => r.user_id === user?.user_id);
      let next = (m.reactions || []).filter((r) => r.user_id !== user?.user_id);
      if (!mine || mine.emoji !== emoji) next = [...next, { user_id: user!.user_id, emoji }];
      return { ...m, reactions: next };
    }));
    try {
      await api(`/chats/message/${target.message_id}/react`, { method: "POST", body: { emoji }, token: token! });
    } catch {}
  };

  const displayed = useMemo(() => {
    if (!showSearch || !searchQ) return messages;
    return messages.filter((m) => (m.content || "").toLowerCase().includes(searchQ.toLowerCase()));
  }, [messages, showSearch, searchQ]);

  const lastSeen = other?.online
    ? "online"
    : other?.last_seen
    ? `last seen ${dayjs(other.last_seen).fromNow()}`
    : "";

  const isRecording = recState === "recording";
  const showMic = !text.trim() && !editing && !isRecording;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity testID="chat-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", flex: 1 }} onPress={() => other && router.push(`/user/${other.user_id}`)}>
          <Avatar uri={other?.profile_picture} name={other?.display_name} size={38} online={other?.online} />
          <View style={{ marginLeft: 12 }}>
            <NxText variant="titleSm" numberOfLines={1}>{other?.display_name || "…"}</NxText>
            <NxText variant="caption" style={{ color: otherTyping ? colors.primary : colors.mutedFg }}>
              {otherTyping ? "typing…" : lastSeen}
            </NxText>
          </View>
        </TouchableOpacity>
        <TouchableOpacity testID="chat-search-toggle" onPress={() => setShowSearch((s) => !s)} style={styles.iconBtn}>
          <Feather name="search" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {showSearch ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: 8 }}>
          <View style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedFg} />
            <TextInput
              testID="chat-search-input"
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder="Search this chat…"
              placeholderTextColor={colors.mutedFg}
              style={{ flex: 1, marginLeft: 8, color: colors.foreground, fontFamily: "Outfit", fontSize: 14 }}
            />
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={displayed}
          keyExtractor={(m) => m.message_id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg }}
          renderItem={({ item }) => (
            <MessageBubble
              m={item}
              isMe={item.sender_id === user?.user_id}
              onLongPress={() => setActionMsg(item)}
              replySource={item.reply_to ? messages.find((x) => x.message_id === item.reply_to) : undefined}
            />
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {replyTo ? (
          <View style={[styles.replyBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <NxText variant="caption" style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Replying to</NxText>
              <NxText variant="bodySm" numberOfLines={1}>{replyTo.content || "media"}</NxText>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} testID="chat-cancel-reply">
              <Feather name="x" size={18} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>
        ) : null}
        {editing ? (
          <View style={[styles.replyBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <NxText variant="caption" style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Editing</NxText>
              <NxText variant="bodySm" numberOfLines={1}>{editing.content}</NxText>
            </View>
            <TouchableOpacity onPress={() => { setEditing(null); setText(""); }} testID="chat-cancel-edit">
              <Feather name="x" size={18} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Recording indicator */}
        {isRecording ? (
          <RecordingBar elapsed={recElapsed} onCancel={recCancel} colors={colors} />
        ) : null}

        <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {/* Image attach (hidden while recording) */}
          {!isRecording ? (
            <TouchableOpacity testID="chat-attach-image" onPress={sendImage} style={[styles.roundBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="image" size={18} color={colors.foreground} />
            </TouchableOpacity>
          ) : null}

          {/* Text field (hidden while recording) */}
          {!isRecording ? (
            <View style={[styles.textField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="chat-input"
                value={text}
                onChangeText={onChangeText}
                placeholder="Write to your Nexus…"
                placeholderTextColor={colors.mutedFg}
                multiline
                style={{ color: colors.foreground, fontFamily: "Outfit", fontSize: 15, maxHeight: 100, minHeight: 24 }}
              />
            </View>
          ) : null}

          {/* Send / Mic button */}
          {showMic ? (
            <TouchableOpacity
              testID="chat-mic"
              onPressIn={handleMicPress}
              onPressOut={handleMicRelease}
              style={[styles.roundBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Feather name="mic" size={18} color={colors.foreground} />
            </TouchableOpacity>
          ) : isRecording ? (
            <TouchableOpacity
              testID="chat-mic-stop"
              onPress={handleMicRelease}
              style={[styles.sendBtn, { backgroundColor: colors.danger || "#e74c3c" }]}
            >
              <Feather name="stop-circle" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="chat-send"
              disabled={sending || (!text.trim() && !editing)}
              onPress={submit}
              style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: text.trim() ? 1 : 0.5 }]}
            >
              <Feather name={editing ? "check" : "send"} size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Actions modal ─────────────────────────────────────────────── */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setActionMsg(null)}>
          <Animated.View
            entering={ZoomIn.springify().damping(15).mass(0.6)}
            exiting={ZoomOut.duration(120)}
            style={[styles.reactionsBar, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
          >
            {REACTIONS.map((emoji, i) => (
              <ReactionBubble
                key={emoji}
                emoji={emoji}
                index={i}
                selected={actionMsg?.reactions?.some((r) => r.user_id === user?.user_id && r.emoji === emoji) || false}
                onPress={() => doReact(emoji)}
              />
            ))}
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(180).delay(80)}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <NxText variant="label" style={{ paddingBottom: spacing.sm }}>Message</NxText>
            <SheetAction icon="corner-up-left" label="Reply" onPress={() => { setReplyTo(actionMsg); setActionMsg(null); }} testID="msg-reply" />
            {actionMsg?.sender_id === user?.user_id && actionMsg?.kind === "text" && !actionMsg?.deleted_for_everyone ? (
              <SheetAction icon="edit-2" label="Edit" onPress={() => { setEditing(actionMsg); setText(actionMsg?.content || ""); setActionMsg(null); }} testID="msg-edit" />
            ) : null}
            {actionMsg?.content ? (
              <SheetAction icon="copy" label="Copy" onPress={async () => { if (actionMsg?.content) await Clipboard.setStringAsync(actionMsg.content); setActionMsg(null); }} testID="msg-copy" />
            ) : null}
            <SheetAction icon="trash-2" label="Delete for me" onPress={() => doDelete("me")} testID="msg-delete-me" />
            {actionMsg?.sender_id === user?.user_id && !actionMsg?.deleted_for_everyone ? (
              <SheetAction icon="trash" label="Delete for everyone" tint={colors.danger} onPress={() => doDelete("everyone")} testID="msg-delete-all" />
            ) : null}
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Recording bar ────────────────────────────────────────────────── */
function RecordingBar({ elapsed, onCancel, colors }: { elapsed: number; onCancel: () => void; colors: any }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.4, { duration: 500 }), withTiming(1, { duration: 500 })), -1, false);
  }, [pulse]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const s = Math.floor(elapsed / 1000);
  const label = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <View style={[styles.recordingBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Animated.View style={[styles.recDot, dotStyle]} />
      <NxText style={{ color: colors.danger || "#e74c3c", fontFamily: fonts.bodySemi, flex: 1, marginLeft: 8 }}>
        Recording {label}
      </NxText>
      <TouchableOpacity onPress={onCancel} style={styles.cancelRec}>
        <Feather name="x" size={16} color={colors.mutedFg} />
        <NxText style={{ color: colors.mutedFg, fontSize: 12, marginLeft: 4 }}>Cancel</NxText>
      </TouchableOpacity>
    </View>
  );
}

/* ── Message bubble ───────────────────────────────────────────────── */
function MessageBubble({ m, isMe, onLongPress, replySource }: { m: Msg; isMe: boolean; onLongPress: () => void; replySource?: Msg }) {
  const { colors } = useTheme();
  const bg = isMe ? colors.bubbleSent : colors.bubbleRecv;
  const fg = isMe ? colors.bubbleSentFg : colors.bubbleRecvFg;
  const isDeleted = m.deleted_for_everyone || m.kind === "deleted";
  const time = dayjs(m.created_at).format("HH:mm");
  const grouped = (m.reactions || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const groupedList = Object.entries(grouped);

  return (
    <View style={{ alignItems: isMe ? "flex-end" : "flex-start", marginVertical: 4 }}>
      <TouchableOpacity
        onLongPress={() => {
          try { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } catch {}
          onLongPress();
        }}
        activeOpacity={0.85}
        testID={`msg-${m.message_id}`}
      >
        {m.kind === "voice" && m.media ? (
          /* ── Voice bubble ── */
          <VoiceBubble
            mediaUri={m.media}
            duration={m.content}
            messageId={m.message_id}
            isMe={isMe}
          />
        ) : (
          /* ── Text / Image bubble ── */
          <View
            style={{
              maxWidth: 300,
              backgroundColor: bg,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 22,
              borderBottomRightRadius: isMe ? 6 : 22,
              borderBottomLeftRadius: isMe ? 22 : 6,
            }}
          >
            {replySource ? (
              <View style={{ borderLeftWidth: 2, borderLeftColor: fg, paddingLeft: 8, marginBottom: 6, opacity: 0.85 }}>
                <NxText style={{ color: fg, fontSize: 12, fontFamily: fonts.bodySemi }}>
                  {replySource.kind === "voice" ? "🎙 Voice message" : replySource.content ? replySource.content.slice(0, 60) : `[${replySource.kind}]`}
                </NxText>
              </View>
            ) : null}
            {isDeleted ? (
              <NxText style={{ color: fg, fontStyle: "italic", fontSize: 14 }}>Message removed</NxText>
            ) : m.kind === "image" && m.media ? (
              <Image source={{ uri: m.media }} style={{ width: 220, height: 220, borderRadius: 14 }} />
            ) : (
              <NxText style={{ color: fg, fontSize: 15, fontFamily: "Outfit" }}>{m.content}</NxText>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, alignSelf: "flex-end" }}>
              {m.edited ? <NxText style={{ color: fg, fontSize: 10, opacity: 0.7, marginRight: 6 }}>edited</NxText> : null}
              <NxText style={{ color: fg, fontSize: 10, opacity: 0.7 }}>{time}</NxText>
              {isMe ? (
                <Feather name={(m.read_by?.length || 0) > 1 ? "check-circle" : "check"} size={12} color={fg} style={{ marginLeft: 4, opacity: 0.7 }} />
              ) : null}
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Time for voice bubbles */}
      {m.kind === "voice" ? (
        <NxText style={{ fontSize: 10, color: colors.mutedFg, marginTop: 2, marginHorizontal: 4 }}>{time}</NxText>
      ) : null}

      {groupedList.length > 0 ? (
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={[styles.reactionsRow, { backgroundColor: colors.background, borderColor: colors.border, marginTop: -8, marginRight: isMe ? 8 : 0, marginLeft: isMe ? 0 : 8 }]}
        >
          {groupedList.map(([emoji, count]) => (
            <View key={emoji} style={styles.reactionChip}>
              <NxText style={{ fontSize: 14 }}>{emoji}</NxText>
              {count > 1 ? (
                <NxText style={{ color: colors.foreground, fontSize: 11, fontFamily: fonts.bodySemi, marginLeft: 3 }}>{count}</NxText>
              ) : null}
            </View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function ReactionBubble({ emoji, index, selected, onPress }: { emoji: string; index: number; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useSharedValue(0);
  useEffect(() => { scale.value = withDelay(index * 35, withSpring(1, { damping: 12, stiffness: 220 })); }, [index, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    scale.value = withSequence(withSpring(1.4, { damping: 10 }), withTiming(1, { duration: 120 }));
    onPress();
  };
  return (
    <Animated.View style={style}>
      <TouchableOpacity
        testID={`react-${emoji}`}
        onPress={handlePress}
        activeOpacity={0.7}
        style={[styles.reactionBubble, selected && { backgroundColor: colors.primary + "33", borderColor: colors.primary, borderWidth: 1 }]}
      >
        <NxText style={{ fontSize: 26 }}>{emoji}</NxText>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SheetAction({ icon, label, onPress, testID, tint }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8} style={styles.sheetItem}>
      <Feather name={icon} size={18} color={tint || colors.foreground} />
      <NxText style={{ marginLeft: 12, color: tint || colors.foreground, fontFamily: fonts.bodyMedium }}>{label}</NxText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchInput: { flexDirection: "row", alignItems: "center", borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  textField: { flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 8, borderTopWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  reactionsBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 20,
    borderRadius: 40, borderWidth: 1, gap: 4,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  reactionBubble: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  reactionsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, borderWidth: 1, gap: 6 },
  reactionChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2 },
  sheet: { padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1 },
  sheetItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  recordingBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e74c3c" },
  cancelRec: { flexDirection: "row", alignItems: "center" },
});
