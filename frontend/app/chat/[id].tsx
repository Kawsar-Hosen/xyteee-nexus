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
  Keyboard,
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
import { EmojiKeyboard } from "rn-emoji-keyboard";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VoiceBubble } from "@/src/components/VoiceBubble";
import { useVoiceRecorder } from "@/src/hooks/useVoiceRecorder";
import { usePrivateVoiceCall } from "@/src/hooks/usePrivateVoiceCall";
import { usePrivateVideoCall } from "@/src/hooks/usePrivateVideoCall";
import { VideoView } from "@/src/components/VideoView";
import { fonts, radii, spacing } from "@/src/theme";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";

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

const chatCache: Record<string, {
  messages: Msg[];
  other: any;
}> = {};

export default function ChatScreen() {
  const {
    id,
    userId,
    displayName,
    profilePicture,
    badgeType,
    online,
    onlineStatus,
    lastSeen: routeLastSeen,
  } = useLocalSearchParams<{
    id: string;
    userId?: string;
    displayName?: string;
    profilePicture?: string;
    badgeType?: string;
    online?: string;
    onlineStatus?: string;
    lastSeen?: string;
  }>();

  const conversation_id = id as string;

  const routeOther =
    userId || displayName
      ? {
          user_id: userId || "",
          display_name: displayName || "",
          profile_picture: profilePicture || undefined,
          badge_type: badgeType || null,
          online: online === "1",
          online_status: onlineStatus || "online",
          last_seen: routeLastSeen || undefined,
        }
      : null;
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { subscribe, send } = useWs();
  const router = useRouter();

  const [messages, setMessages] = useState<Msg[]>(
    () => chatCache[conversation_id]?.messages || []
  );
  const [other, setOther] = useState<any>(
    () => chatCache[conversation_id]?.other || routeOther
  );
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(
    () => !chatCache[conversation_id]
  );
  const [otherTyping, setOtherTyping] = useState(false);
  const [actionMsg, setActionMsg] = useState<Msg | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inputBarHeight, setInputBarHeight] = useState(62);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);

  const { state: recState, elapsed: recElapsed, start: recStart, stop: recStop, cancel: recCancel } = useVoiceRecorder();

  const {
    callState,
    muted,
    speakerOn,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  } = usePrivateVoiceCall({
    conversationId: conversation_id,
    token,
    subscribe,
    send,
  });

  const {
    callState: videoCallState,
    muted: videoMuted,
    cameraOff,
    localStream,
    remoteStream,
    startCall: startVideoCall,
    acceptCall: acceptVideoCall,
    endCall: endVideoCall,
    toggleMute: toggleVideoMute,
    toggleCamera,
    switchCamera,
  } = usePrivateVideoCall({
    conversationId: conversation_id,
    token,
    subscribe,
    send,
  });

  const load = useCallback(async () => {
    if (!token || !conversation_id) return;
    try {
      const [chats, r] = await Promise.all([
        api<{ chats: any[] }>("/chats", { token }),
        api<{ messages: Msg[] }>(`/chats/${conversation_id}/messages`, {
          token,
          query: { limit: 100 },
        }),
      ]);

      const c = (chats.chats || []).find(
        (x) => x.conversation_id === conversation_id
      );

      const nextOther =
        c?.other_user || chatCache[conversation_id]?.other || null;

      const nextMessages = r.messages || [];

      if (nextOther) setOther(nextOther);
      setMessages(nextMessages);

      chatCache[conversation_id] = {
        messages: nextMessages,
        other: nextOther,
      };
    } catch (error) {
      console.log("Chat load failed:", error);

      const cached = chatCache[conversation_id];

      if (cached) {
        setMessages(cached.messages);
        setOther(cached.other);
      }
    } finally {
      setLoading(false);
    }
  }, [token, conversation_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!conversation_id) return;

    chatCache[conversation_id] = {
      messages,
      other,
    };
  }, [conversation_id, messages, other]);

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "message" && e.message.conversation_id === conversation_id) {
        const incomingMessage =
          e.message.sender_id !== user?.user_id && user?.user_id
            ? {
                ...e.message,
                read_by: Array.from(
                  new Set([...(e.message.read_by || []), user.user_id])
                ),
              }
            : e.message;

        if (e.message.sender_id !== user?.user_id) {
          send({
            type: "message_read",
            conversation_id,
            message_id: e.message.message_id,
          });
        }

        setMessages((prev) => {
          if (prev.some((m) => m.message_id === e.message.message_id)) {
            return prev;
          }

          const tempIndex = prev.findIndex(
            (m) =>
              String(m.message_id).startsWith("temp-") &&
              m.sender_id === e.message.sender_id &&
              m.content === e.message.content &&
              m.kind === e.message.kind
          );

          if (tempIndex !== -1) {
            const next = [...prev];
            next[tempIndex] = incomingMessage;
            return next;
          }

          return [...prev, incomingMessage];
        });
      } else if (e.type === "message_edit" && e.message.conversation_id === conversation_id) {
        setMessages((prev) => prev.map((m) => (m.message_id === e.message.message_id ? e.message : m)));
      } else if (e.type === "message_react" && e.message.conversation_id === conversation_id) {
        setMessages((prev) => prev.map((m) => (m.message_id === e.message.message_id ? e.message : m)));
      } else if (e.type === "message_read" && e.conversation_id === conversation_id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.message_id === e.message_id
              ? { ...m, read_by: e.read_by || m.read_by }
              : m
          )
        );
      } else if (e.type === "message_delete") {
        setMessages((prev) => prev.map((m) => (m.message_id === e.message_id ? { ...m, deleted_for_everyone: true, content: "", media: null, kind: "deleted" } : m)));
      } else if (e.type === "typing" && e.conversation_id === conversation_id && e.user_id !== user?.user_id) {
        setOtherTyping(e.is_typing);
      } else if (e.type === "presence" && e.user_id === other?.user_id) {
        setOther((o: any) =>
          o
            ? {
                ...o,
                online: e.online,
                online_status: e.online_status,
                last_seen: e.last_seen,
              }
            : o
        );
      }
    });
  }, [subscribe, conversation_id, user, other?.user_id]);

  useEffect(() => {
    if (!messages.length || loading) return;

    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({
        animated: messages.length > 1,
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages.length, loading]);

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
    const content = text.trim();
    const body: any = { conversation_id, content, kind: "text" };
    if (replyTo) body.reply_to = replyTo.message_id;

    setText("");
    setReplyTo(null);
    emitTyping(false);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: any = {
      message_id: tempId,
      conversation_id,
      sender_id: user?.user_id,
      content,
      kind: "text",
      media: null,
      created_at: new Date().toISOString(),
      read_by: [user?.user_id].filter(Boolean),
      reply_to: replyTo || null,
      reactions: [],
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const sent = await api<Msg>("/chats/message", {
        method: "POST",
        body,
        token: token!,
      });

      setMessages((prev) =>
        prev.map((m) => (m.message_id === tempId ? sent : m))
      );
    } catch {
      setMessages((prev) =>
        prev.filter((m) => m.message_id !== tempId)
      );
    }
  };

  const pickMedia = async (type: "image" | "video") => {
    setShowAttachMenu(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        type === "image"
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.6,
      base64: type === "image",
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    if (type === "image") {
      if (!asset.base64) return;

      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;

      await api("/chats/message", {
        method: "POST",
        body: {
          conversation_id,
          kind: "image",
          media: dataUrl,
          content: "",
        },
        token: token!,
      });

      return;
    }

    await api("/chats/message", {
      method: "POST",
      body: {
        conversation_id,
        kind: "video",
        media: asset.uri,
        content: "",
      },
      token: token!,
    });
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

  const callStatusText =
    callState === "incoming"
      ? "Incoming voice call"
      : callState === "calling"
        ? "Calling…"
        : callState === "connecting"
          ? "Connecting…"
          : callState === "active"
            ? "Voice call"
            : "";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <Modal
        visible={callState !== "idle"}
        transparent
        animationType="fade"
        onRequestClose={endCall}
      >
        <View style={styles.callOverlay}>
          <View
            style={[
              styles.callCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Avatar
              uri={other?.profile_picture}
              name={other?.display_name}
              size={88}
              online={false}
            />

            <NxText
              variant="title"
              numberOfLines={1}
              style={styles.callName}
            >
              {other?.display_name || "Nexus User"}
            </NxText>

            <NxText
              variant="bodySm"
              style={{ marginTop: 6, color: colors.mutedFg }}
            >
              {callStatusText}
            </NxText>

            <View style={styles.callActions}>
              {callState === "incoming" ? (
                <>
                  <TouchableOpacity
                    testID="call-decline"
                    onPress={endCall}
                    style={[styles.callActionButton, styles.callEndButton]}
                  >
                    <Feather name="phone-off" size={25} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="call-accept"
                    onPress={acceptCall}
                    style={[styles.callActionButton, styles.callAcceptButton]}
                  >
                    <Feather name="phone" size={25} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    testID="call-mute"
                    onPress={toggleMute}
                    style={[
                      styles.callActionButton,
                      {
                        backgroundColor: muted
                          ? colors.primary
                          : colors.background,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Feather
                      name={muted ? "mic-off" : "mic"}
                      size={24}
                      color={muted ? colors.onPrimary : colors.foreground}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="call-speaker"
                    onPress={toggleSpeaker}
                    style={[
                      styles.callActionButton,
                      {
                        backgroundColor: speakerOn
                          ? colors.primary
                          : colors.background,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Feather
                      name="volume-2"
                      size={24}
                      color={speakerOn ? colors.onPrimary : colors.foreground}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="call-end"
                    onPress={endCall}
                    style={[styles.callActionButton, styles.callEndButton]}
                  >
                    <Feather name="phone-off" size={25} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Video Call Overlay ──────────────────────────────────────── */}
      <Modal
        visible={videoCallState !== "idle"}
        transparent={false}
        animationType="slide"
        onRequestClose={endVideoCall}
      >
        <View style={styles.videoCallContainer}>
          {/* Remote video — full screen */}
          {remoteStream ? (
            <VideoView stream={remoteStream} style={styles.remoteVideo} objectFit="cover" zOrder={0} />
          ) : (
            <View style={[styles.remoteVideo, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
              <Avatar uri={other?.profile_picture} name={other?.display_name} size={96} online={false} />
              <NxText variant="title" style={{ color: "#fff", marginTop: 16 }}>
                {videoCallState === "calling" ? "Calling…" : videoCallState === "incoming" ? "Incoming video call" : "Connecting…"}
              </NxText>
            </View>
          )}

          {/* Local video — picture-in-picture */}
          {localStream && (
            <VideoView
              stream={localStream}
              style={styles.localVideo}
              objectFit="cover"
              zOrder={1}
              mirror
            />
          )}

          {/* Controls */}
          <View style={styles.videoCallControls}>
            {videoCallState === "incoming" ? (
              <>
                <TouchableOpacity onPress={endVideoCall} style={[styles.videoCallBtn, { backgroundColor: "#E5484D" }]}>
                  <Feather name="phone-off" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={acceptVideoCall} style={[styles.videoCallBtn, { backgroundColor: "#2DBE72" }]}>
                  <Feather name="video" size={26} color="#fff" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={toggleVideoMute}
                  style={[styles.videoCallBtn, { backgroundColor: videoMuted ? "#fff" : "rgba(255,255,255,0.2)" }]}
                >
                  <Feather name={videoMuted ? "mic-off" : "mic"} size={24} color={videoMuted ? "#000" : "#fff"} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleCamera}
                  style={[styles.videoCallBtn, { backgroundColor: cameraOff ? "#fff" : "rgba(255,255,255,0.2)" }]}
                >
                  <Feather name={cameraOff ? "video-off" : "video"} size={24} color={cameraOff ? "#000" : "#fff"} />
                </TouchableOpacity>

                <TouchableOpacity onPress={endVideoCall} style={[styles.videoCallBtn, { backgroundColor: "#E5484D" }]}>
                  <Feather name="phone-off" size={26} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={switchCamera} style={[styles.videoCallBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Feather name="refresh-cw" size={22} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity testID="chat-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", flex: 1 }} onPress={() => other && router.push(`/user/${other.user_id}`)}>
          <Avatar
            uri={other?.profile_picture}
            name={other?.display_name}
            size={38}
            online={other?.online}
            onlineStatus={other?.online_status || "online"}
          />
          <View style={{ marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="titleSm" numberOfLines={1}>{other?.display_name || "…"}</NxText>
              <VerifiedBadge badgeType={other?.badge_type} size={16} />
            </View>
            <NxText variant="caption" style={{ color: otherTyping ? colors.primary : colors.mutedFg }}>
              {otherTyping ? "typing…" : lastSeen}
            </NxText>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          testID="chat-voice-call"
          onPress={startCall}
          disabled={callState !== "idle"}
          style={styles.iconBtn}
        >
          <Feather name="phone" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="chat-video-call"
          onPress={startVideoCall}
          disabled={videoCallState !== "idle"}
          style={styles.iconBtn}
        >
          <Feather name="video" size={20} color={colors.foreground} />
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
        <ChatSkeleton />
      ) : (
        <FlatList
          ref={listRef}
          data={displayed}
          keyExtractor={(m) => m.message_id}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: inputBarHeight + spacing.lg,
          }}
          renderItem={({ item }) => (
            <MessageBubble
              m={item}
              isMe={item.sender_id === user?.user_id}
              onLongPress={() => setActionMsg(item)}
              replySource={item.reply_to ? messages.find((x) => x.message_id === item.reply_to) : undefined}
            />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "position"}
        keyboardVerticalOffset={0}
      >
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

        <View
          onLayout={(e) => {
            const h = Math.ceil(e.nativeEvent.layout.height);
            if (h !== inputBarHeight) setInputBarHeight(h);
          }}
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
            },
          ]}
        >
          {/* Attachment menu + button */}
          {!isRecording ? (
            <View style={{ position: "relative" }}>
              {showAttachMenu ? (
                <View
                  style={[
                    styles.attachMenu,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    testID="chat-attach-photo"
                    onPress={() => pickMedia("image")}
                    style={styles.attachOption}
                  >
                    <Feather name="image" size={19} color={colors.foreground} />
                    <NxText style={{ marginLeft: 10, color: colors.foreground }}>
                      Photo
                    </NxText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="chat-attach-video"
                    onPress={() => pickMedia("video")}
                    style={styles.attachOption}
                  >
                    <Feather name="video" size={19} color={colors.foreground} />
                    <NxText style={{ marginLeft: 10, color: colors.foreground }}>
                      Video
                    </NxText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                testID="chat-attach-toggle"
                onPress={() => setShowAttachMenu((v) => !v)}
                style={[
                  styles.roundBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather
                  name={showAttachMenu ? "x" : "plus"}
                  size={24}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Message field / compact recording field */}
          {isRecording ? (
            <RecordingBar
              elapsed={recElapsed}
              onCancel={recCancel}
              colors={colors}
            />
          ) : (
            <View
              style={[
                styles.textField,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                testID="chat-input"
                value={text}
                onChangeText={onChangeText}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder="Message"
                placeholderTextColor={colors.mutedFg}
                multiline
                style={[
                  styles.chatTextInput,
                  {
                    color: colors.foreground,
                  },
                ]}
              />

              <TouchableOpacity
                testID="chat-emoji"
                activeOpacity={0.7}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowEmojiPicker((v) => !v);
                }}
                style={styles.emojiBtn}
              >
                <Feather
                  name="smile"
                  size={21}
                  color={colors.mutedFg}
                />
              </TouchableOpacity>
            </View>
          )}

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

      {showEmojiPicker ? (
        <View
          style={{
            height: 330,
            backgroundColor: colors.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <EmojiKeyboard
            onEmojiSelected={(emoji) => {
              onChangeText(text + emoji.emoji);
            }}
            enableSearchBar
            enableRecentlyUsed
            hideHeader
          />
        </View>
      ) : null}

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

/* ── Chat loading skeleton ───────────────────────────────────────── */
function ChatSkeleton() {
  const { colors } = useTheme();

  const rows = [
    { side: "left", width: "58%" },
    { side: "right", width: "42%" },
    { side: "left", width: "72%" },
    { side: "right", width: "64%" },
    { side: "left", width: "46%" },
  ] as const;

  return (
    <View style={styles.chatSkeleton}>
      {rows.map((row, index) => (
        <View
          key={index}
          style={{
            alignItems: row.side === "right" ? "flex-end" : "flex-start",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: row.width,
              height: index === 2 ? 68 : 46,
              borderRadius: 22,
              borderBottomRightRadius: row.side === "right" ? 6 : 22,
              borderBottomLeftRadius: row.side === "left" ? 6 : 22,
              backgroundColor:
                row.side === "right"
                  ? colors.primary + "30"
                  : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </View>
      ))}
    </View>
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
  const isVoice = m.kind === "voice" && !!m.media;
  const isImage = m.kind === "image" && !!m.media;
  const isRead = (m.read_by?.length || 0) > 1;
  const time = dayjs(m.created_at).format("HH:mm");

  const grouped = (m.reactions || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const groupedList = Object.entries(grouped);

  return (
    <View
      style={{
        alignItems: isMe ? "flex-end" : "flex-start",
        marginTop: 2,
        marginBottom: groupedList.length > 0 ? 10 : 3,
      }}
    >
      <TouchableOpacity
        onLongPress={() => {
          try {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(
                Haptics.ImpactFeedbackStyle.Medium
              ).catch(() => {});
            }
          } catch {}
          onLongPress();
        }}
        activeOpacity={0.85}
        testID={`msg-${m.message_id}`}
        style={{ maxWidth: "84%" }}
      >
        {isVoice ? (
          <View>
            <VoiceBubble
              mediaUri={m.media!}
              duration={m.content}
              messageId={m.message_id}
              isMe={isMe}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                marginTop: 3,
                marginHorizontal: 5,
              }}
            >
              <NxText
                style={{
                  fontSize: 10,
                  color: colors.mutedFg,
                }}
              >
                {time}
              </NxText>

              {isMe ? (
                <NxText
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    color: isRead ? colors.primary : colors.mutedFg,
                    fontFamily: fonts.bodySemi,
                  }}
                >
                  {isRead ? "✓✓" : "✓"}
                </NxText>
              ) : null}
            </View>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: bg,
              paddingVertical: isImage ? 4 : 9,
              paddingHorizontal: isImage ? 4 : 13,
              borderRadius: 20,
              borderBottomRightRadius: isMe ? 5 : 20,
              borderBottomLeftRadius: isMe ? 20 : 5,
              overflow: "hidden",
            }}
          >
            {replySource ? (
              <View
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: fg,
                  paddingLeft: 8,
                  marginHorizontal: isImage ? 6 : 0,
                  marginTop: isImage ? 6 : 0,
                  marginBottom: 7,
                  opacity: 0.82,
                }}
              >
                <NxText
                  numberOfLines={2}
                  style={{
                    color: fg,
                    fontSize: 12,
                    fontFamily: fonts.bodySemi,
                  }}
                >
                  {replySource.kind === "voice"
                    ? "🎙 Voice message"
                    : replySource.kind === "image"
                      ? "📷 Photo"
                      : replySource.content
                        ? replySource.content.slice(0, 60)
                        : "Message"}
                </NxText>
              </View>
            ) : null}

            {isDeleted ? (
              <NxText
                style={{
                  color: fg,
                  fontStyle: "italic",
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                Message removed
              </NxText>
            ) : isImage ? (
              <Image
                source={{ uri: m.media! }}
                resizeMode="cover"
                style={{
                  width: 230,
                  height: 230,
                  borderRadius: 16,
                }}
              />
            ) : (
              <NxText
                style={{
                  color: fg,
                  fontSize: 15,
                  lineHeight: 20,
                  fontFamily: "Outfit",
                }}
              >
                {m.content}
              </NxText>
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-end",
                marginTop: isImage ? 5 : 3,
                marginHorizontal: isImage ? 7 : 0,
                marginBottom: isImage ? 3 : 0,
              }}
            >
              {m.edited ? (
                <NxText
                  style={{
                    color: fg,
                    fontSize: 10,
                    opacity: 0.65,
                    marginRight: 5,
                  }}
                >
                  edited
                </NxText>
              ) : null}

              <NxText
                style={{
                  color: fg,
                  fontSize: 10,
                  opacity: 0.68,
                }}
              >
                {time}
              </NxText>

              {isMe ? (
                <NxText
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    lineHeight: 14,
                    color: isRead ? colors.primary : fg,
                    opacity: isRead ? 1 : 0.72,
                    fontFamily: fonts.bodySemi,
                  }}
                >
                  {isRead ? "✓✓" : "✓"}
                </NxText>
              ) : null}
            </View>
          </View>
        )}
      </TouchableOpacity>

      {groupedList.length > 0 ? (
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={[
            styles.reactionsRow,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              marginTop: -7,
              marginRight: isMe ? 8 : 0,
              marginLeft: isMe ? 0 : 8,
            },
          ]}
        >
          {groupedList.map(([emoji, count]) => (
            <View key={emoji} style={styles.reactionChip}>
              <NxText style={{ fontSize: 14 }}>{emoji}</NxText>
              {count > 1 ? (
                <NxText
                  style={{
                    color: colors.foreground,
                    fontSize: 11,
                    fontFamily: fonts.bodySemi,
                    marginLeft: 3,
                  }}
                >
                  {count}
                </NxText>
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
  chatSkeleton: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
  },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchInput: { flexDirection: "row", alignItems: "center", borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 7,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  attachMenu: {
    position: "absolute",
    left: 0,
    bottom: 52,
    width: 150,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 6,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 50,
  },
  attachOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  textField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 22,
    paddingLeft: 15,
    paddingRight: 2,
    minHeight: 42,
    maxHeight: 100,
  },
  chatTextInput: {
    flex: 1,
    fontFamily: "Outfit",
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    maxHeight: 96,
    paddingTop: 10,
    paddingBottom: 10,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 8, borderTopWidth: 1 },
  callOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  callCard: {
    width: "100%",
    maxWidth: 380,
    minHeight: 390,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  callName: {
    marginTop: 20,
    maxWidth: "90%",
    textAlign: "center",
  },
  callActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 52,
  },
  callActionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  callEndButton: {
    backgroundColor: "#E5484D",
  },
  callAcceptButton: {
    backgroundColor: "#2DBE72",
  },
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
    flex: 1,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 22,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e74c3c",
  },
  cancelRec: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
  },
  videoCallContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  remoteVideo: {
    flex: 1,
    width: "100%",
  },
  localVideo: {
    position: "absolute",
    top: 52,
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  videoCallControls: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  videoCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
