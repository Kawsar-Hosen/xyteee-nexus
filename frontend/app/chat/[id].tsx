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
  Alert,
  Linking,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  ZoomIn,
  FadeInUp,
} from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { VideoView as ExpoVideoView, useVideoPlayer } from "expo-video";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import dayjs from "dayjs";
import * as Clipboard from "expo-clipboard";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import * as Location from "expo-location";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { uploadFile } from "@/src/api/upload";
import { playSendSound, playReceiveSound, playEmojiSound } from "@/src/utils/sounds";
import { ChatSettingsPanel } from "@/src/components/ChatSettingsPanel";
import { useChatSettings, CHAT_THEMES, CHAT_WALLPAPERS } from "@/src/hooks/useChatSettings";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VoiceBubble } from "@/src/components/VoiceBubble";
import { LinkPreview } from "@/src/components/LinkPreview";
import { LiveLocationCard } from "@/src/components/LiveLocationCard";
import { startLiveLocation, stopLiveLocation } from "@/src/utils/liveLocation";
import { useVoiceRecorder } from "@/src/hooks/useVoiceRecorder";
import { useCallManager } from "@/src/context/CallContext";
import { MediaPicker, type MediaTab } from "@/src/components/MediaPicker";
import { klipyMedia, klipyStickerMedia, type KlipyGif } from "@/src/api/klipy";
import { fonts, radii, spacing } from "@/src/theme";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";

const REACTIONS = ["❤️", "😂", "🔥", "😮", "😢", "👏", "👍"];

const LIVE_DURATIONS = [
  { label: "15 minutes", ms: 15 * 60 * 1000 },
  { label: "30 minutes", ms: 30 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "8 hours", ms: 8 * 60 * 60 * 1000 },
];

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
  pinned_for?: string[];
  created_at: string;
};

const chatCache: Record<string, {
  messages: Msg[];
  other: any;
}> = {};

function replyPreviewLabel(m: Msg): string {
  if (m.kind === "call_voice") return "📞 Voice call";
  if (m.kind === "call_video") return "📹 Video call";
  if (m.kind === "voice") return "🎙 Voice message";
  if (m.kind === "image") return "📷 Photo";
  if (m.kind === "video") return "🎥 Video";
  if (m.kind === "gif") return "🎞️ GIF";
  if (m.kind === "sticker") return "🖼️ Sticker";
  if (m.kind === "location") return "📍 Shared location";
  if (m.kind === "live_location") return "📍 Live location";
  return m.content ? m.content.slice(0, 80) : "Message";
}

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
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLiveDuration, setShowLiveDuration] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [viewerMsg, setViewerMsg] = useState<Msg | null>(null);
  const [inputBarHeight, setInputBarHeight] = useState(62);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);
  const atBottomRef = useRef(true);
  const initialScrollDone = useRef(false);
  const highlightTimer = useRef<any>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isNarrow = screenWidth < 380;
  const isShort = screenHeight < 720;

  const [focused, setFocused] = useState(false);
  const sendScale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const { state: recState, elapsed: recElapsed, start: recStart, stop: recStop, cancel: recCancel } = useVoiceRecorder();

  const callManager = useCallManager();
  const {
    call: activeCall,
    startCall,
  } = callManager;

  const { settings: chatSettings } = useChatSettings(conversation_id);

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
          if (
            !e.message.kind?.startsWith("call_") &&
            !chatSettings.muted &&
            chatSettings.soundEnabled
          ) {
            playReceiveSound();
          }
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
      } else if (e.type === "message_pin" && e.message?.conversation_id === conversation_id) {
        setMessages((prev) => prev.map((m) => (m.message_id === e.message.message_id ? e.message : m)));
      } else if (
        (e.type === "live_location_update" || e.type === "live_location_end") &&
        e.conversation_id === conversation_id
      ) {
        setMessages((prev) =>
          prev.map((m) => (m.message_id === e.message_id ? { ...m, content: e.content } : m))
        );
      } else if (e.type === "chat_cleared" && e.conversation_id === conversation_id) {
        setMessages([]);
      } else if (e.type === "conversation_deleted" && e.conversation_id === conversation_id) {
        setMessages([]);
        router.back();
      } else if (e.type === "blocked" && e.by_user_id === other?.user_id) {
        setMessages([]);
        router.back();
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
  }, [subscribe, conversation_id, user, other?.user_id, chatSettings.muted, chatSettings.soundEnabled]);

  const scrollToBottom = useCallback((animated: boolean) => {
    if (!listRef.current) return;
    if (initialScrollDone.current && !atBottomRef.current) return;
    listRef.current.scrollToEnd({ animated });
    initialScrollDone.current = true;
  }, []);

  useEffect(() => {
    if (!messages.length || loading) return;

    const timer = setTimeout(() => {
      scrollToBottom(messages.length > 1);
    }, 80);

    return () => clearTimeout(timer);
  }, [messages.length, loading, scrollToBottom]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => {
        scrollToBottom(false);
      }, 150);
      return () => clearTimeout(t);
    }, [scrollToBottom])
  );

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
    playSendSound();

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

  const sendMedia = async (item: KlipyGif, kind: string, url: string, w: number, h: number) => {
    const body: any = {
      conversation_id,
      kind,
      media: url,
      content: JSON.stringify({
        title: item.title,
        w,
        h,
      }),
    };
    if (replyTo) body.reply_to = replyTo.message_id;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: any = {
      message_id: tempId,
      conversation_id,
      sender_id: user?.user_id,
      content: body.content,
      kind,
      media: url,
      created_at: new Date().toISOString(),
      read_by: [user?.user_id].filter(Boolean),
      reply_to: replyTo || null,
      reactions: [],
    };

    setReplyTo(null);
    emitTyping(false);
    setMessages((prev) => [...prev, optimisticMessage]);
    playSendSound();

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

  const sendGif = async (gif: KlipyGif) => {
    const media = klipyMedia(gif);
    if (!media) return;
    await sendMedia(gif, "gif", media.url, media.width, media.height);
  };

  const sendSticker = async (sticker: KlipyGif) => {
    const media = klipyStickerMedia(sticker);
    if (!media) return;
    await sendMedia(sticker, "sticker", media.url, media.width, media.height);
  };

  const handleMediaSelect = (item: KlipyGif, tab: MediaTab) => {
    if (tab === "sticker") sendSticker(item);
    else sendGif(item);
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
      // Send at the picked size — don't downscale/compress the original.
      quality: 1.0,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    setSending(true);
    try {
      const url = await uploadFile(asset.uri, "chat", token!, asset.fileName || undefined, asset.mimeType);
      // Store original dimensions so the bubble can keep the real aspect ratio.
      const dims =
        asset.width && asset.height
          ? JSON.stringify({ w: asset.width, h: asset.height })
          : "";
      await api("/chats/message", {
        method: "POST",
        body: {
          conversation_id,
          kind: type,
          media: url,
          content: dims,
        },
        token: token!,
      });
    } finally {
      setSending(false);
    }
  };

  /* ── Share live location ────────────────────────────────────────── */
  const shareLocation = () => {
    setShowAttachMenu(false);
    setShowLiveDuration(true);
  };

  const pickDuration = async (durationMs: number) => {
    setShowLiveDuration(false);
    try {
      let lat: number;
      let lng: number;
      if (Platform.OS === "web") {
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Location request timed out")), 12000)
          ),
        ]);
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } else {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Location permission", "Location access is needed to share your position.");
            return;
          }
        } catch {}
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      await sendLiveLocation(Number(lat.toFixed(6)), Number(lng.toFixed(6)), durationMs);
    } catch (e: any) {
      if (e?.code === 1 || e?.code === "E_LOCATION_PERMISSION_DENIED") {
        Alert.alert("Location permission", "Location access is needed to share your position.");
        return;
      }
      if (e?.code === 2 || e?.code === "E_LOCATION_UNAVAILABLE") {
        Alert.alert("Location unavailable", "Your browser couldn't determine your location.");
        return;
      }
      Alert.alert(
        "Couldn't get location",
        e?.message && String(e.message) !== "undefined"
          ? String(e.message)
          : "Unable to access your location right now."
      );
    }
  };

  const sendLiveLocation = async (lat: number, lng: number, durationMs: number) => {
    const startedAt = Date.now();
    const expiresAt = startedAt + durationMs;
    const content = JSON.stringify({
      lat,
      lng,
      started_at: new Date(startedAt).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
    });

    const body: any = { conversation_id, content, kind: "live_location" };
    if (replyTo) body.reply_to = replyTo.message_id;

    setReplyTo(null);
    emitTyping(false);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: any = {
      message_id: tempId,
      conversation_id,
      sender_id: user?.user_id,
      content,
      kind: "live_location",
      media: null,
      created_at: new Date().toISOString(),
      read_by: [user?.user_id].filter(Boolean),
      reply_to: replyTo || null,
      reactions: [],
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    playSendSound();

    try {
      const sent = await api<Msg>("/chats/message", { method: "POST", body, token: token! });
      setMessages((prev) => prev.map((m) => (m.message_id === tempId ? sent : m)));
      startLiveLocation({
        messageId: sent.message_id,
        conversationId: conversation_id,
        send,
        lat,
        lng,
        expiresAt,
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.message_id !== tempId));
    }
  };

  const stopLiveSharing = (messageId: string) => {
    stopLiveLocation(messageId);
    send({
      type: "live_location_end",
      conversation_id,
      message_id: messageId,
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

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: any = {
      message_id: tempId,
      conversation_id,
      sender_id: user?.user_id,
      content: result.durationStr,
      kind: "voice",
      media: result.uri,
      created_at: new Date().toISOString(),
      read_by: [user?.user_id].filter(Boolean),
      reply_to: null,
      reactions: [],
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    playSendSound();
    setSending(true);
    try {
      const url = await uploadFile(result.uri, "voice", token!, `voice_${Date.now()}.m4a`, "audio/m4a");
      const sent = await api<Msg>("/chats/message", {
        method: "POST",
        body: {
          conversation_id,
          kind: "voice",
          media: url,
          content: result.durationStr,
        },
        token: token!,
      });
      setMessages((prev) => prev.map((m) => (m.message_id === tempId ? sent : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.message_id !== tempId));
      Alert.alert("Couldn't send voice", "Your voice message failed to send. Please try again.");
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
    playEmojiSound();
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

  const doPin = async (msg: Msg) => {
    const myId = user?.user_id;
    if (!myId) return;
    setActionMsg(null);
    const isPinned = (msg.pinned_for || []).includes(myId);
    try {
      const updated = await api<Msg>(`/chats/message/${msg.message_id}/pin`, {
        method: "POST",
        body: { pinned: !isPinned },
        token: token!,
      });
      setMessages((prev) => prev.map((m) => (m.message_id === updated.message_id ? updated : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === msg.message_id
            ? { ...m, pinned_for: isPinned ? (m.pinned_for || []).filter((id: string) => id !== myId) : [...(m.pinned_for || []), myId] }
            : m
        )
      );
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      "Clear chat?",
      "This deletes all messages on this device. The other person will not be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setShowSettings(false);
            try {
              await api(`/chats/${conversation_id}/clear`, { method: "POST", token: token! });
            } catch {}
            setMessages([]);
          },
        },
      ]
    );
  };

  const handleDeleteConversation = () => {
    Alert.alert(
      "Delete conversation?",
      "This chat will be removed from your conversations.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setShowSettings(false);
            try {
              await api(`/chats/${conversation_id}/delete`, { method: "POST", token: token! });
            } catch {}
            setMessages([]);
            router.back();
          },
        },
      ]
    );
  };

  const handleBlock = () => {
    Alert.alert(
      "Block user?",
      `You will no longer receive messages or calls from ${other?.display_name || "this user"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setShowSettings(false);
            try {
              if (other?.user_id) await api("/friends/block", { method: "POST", body: { user_id: other.user_id }, token: token! });
            } catch {}
            router.back();
          },
        },
      ]
    );
  };

  const displayed = useMemo(() => {
    const base = !showSearch || !searchQ ? messages : messages.filter((m) => (m.content || "").toLowerCase().includes(searchQ.toLowerCase()));
    const pinned = base.filter((m) => (m.pinned_for?.length || 0) > 0);
    const rest = base.filter((m) => !(m.pinned_for?.length || 0));
    return [...pinned, ...rest];
  }, [messages, showSearch, searchQ]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const idx = displayed.findIndex((m) => m.message_id === messageId);
      if (idx === -1) return;
      setHighlightId(messageId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 2200);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index: idx,
          viewPosition: 0.4,
          animated: true,
        });
      });
    },
    [displayed]
  );

  const chatBg = CHAT_WALLPAPERS[chatSettings.wallpaper]?.bg || "transparent";
  const sentTheme = CHAT_THEMES[chatSettings.theme]?.sent;
  const sentThemeFg = CHAT_THEMES[chatSettings.theme]?.sentFg;

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
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.glass, paddingHorizontal: isNarrow ? 4 : 8 }]}>
        <TouchableOpacity testID="chat-back" onPress={() => router.back()} style={[styles.iconBtn, isNarrow && { width: 36, height: 36 }]}>
          <Feather name="chevron-left" size={isNarrow ? 26 : 28} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }} onPress={() => other && router.push(`/user/${other.username || other.user_id}`)}>
          <Avatar
            uri={other?.profile_picture}
            name={other?.display_name}
            size={isNarrow ? 36 : 40}
            frame={other?.profile_frame}
            achievement={other?.achievement_level}
            animation={other?.profile_animation}
            animationSpeed={other?.profile_animation_speed}
            animationIntensity={other?.profile_animation_intensity}
            online={other?.online}
            onlineStatus={other?.online_status || "online"}
          />
          <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="titleSm" numberOfLines={1} style={{ fontSize: isNarrow ? 15.5 : 17, fontFamily: fonts.bodySemi, flexShrink: 1 }}>{other?.display_name || "…"}</NxText>
              <VerifiedBadge
                badgeType={other?.badge_type}
                badgeIcon={other?.badge_icon}
                badgeExpiresAt={other?.badge_expires_at}
                size={isNarrow ? 13 : 15}
              />
            </View>
            <NxText
              variant="caption"
              numberOfLines={1}
              style={{ color: otherTyping ? colors.primary : colors.mutedFg, fontSize: isNarrow ? 11 : 12, marginTop: 1 }}
            >
              {otherTyping && chatSettings.typingIndicator ? "typing…" : lastSeen}
            </NxText>
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            testID="chat-voice-call"
            onPress={() => startCall("voice", conversation_id, other)}
            disabled={!!activeCall}
            style={[styles.iconBtn, isNarrow && { width: 32, height: 36 }]}
          >
            <Feather name="phone" size={isNarrow ? 18 : 20} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="chat-video-call"
            onPress={() => startCall("video", conversation_id, other)}
            disabled={!!activeCall}
            style={[styles.iconBtn, isNarrow && { width: 32, height: 36 }]}
          >
            <Feather name="video" size={isNarrow ? 18 : 20} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity testID="chat-settings-toggle" onPress={() => setShowSettings(true)} style={[styles.iconBtn, isNarrow && { width: 32, height: 36 }]}>
            <Feather name="sliders" size={isNarrow ? 18 : 20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
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
          style={chatBg !== "transparent" ? { backgroundColor: chatBg } : undefined}
          contentContainerStyle={{
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.md,
            paddingBottom: inputBarHeight + spacing.xl,
          }}
          renderItem={({ item }) => (
            <MessageBubble
              m={item}
              isMe={item.sender_id === user?.user_id}
              onLongPress={() => setActionMsg(item)}
              onReply={() => setReplyTo(item)}
              onOpenMedia={() => setViewerMsg(item)}
              onReplyPress={
                item.reply_to ? () => scrollToMessage(item.reply_to!) : undefined
              }
              highlighted={highlightId === item.message_id}
              replySource={item.reply_to ? messages.find((x) => x.message_id === item.reply_to) : undefined}
              other={other}
              sentBg={sentTheme}
              sentFg={sentThemeFg}
              showReadReceipts={chatSettings.readReceipts}
              onStopLive={(mid) => stopLiveSharing(mid)}
              onCallAgain={() => {
                if (item.kind === "call_video") startCall("video", conversation_id, other);
                else startCall("voice", conversation_id, other);
              }}
            />
          )}
          onContentSizeChange={() => {
            scrollToBottom(false);
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const distFromBottom =
              contentSize.height - (contentOffset.y + layoutMeasurement.height);
            atBottomRef.current = distFromBottom < 80;
          }}
          scrollEventThrottle={100}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({
              offset: index * averageItemLength,
              animated: true,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index,
                viewPosition: 0.4,
                animated: true,
              });
            }, 300);
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {replyTo ? (
          <View style={[styles.replyBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <NxText variant="caption" style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Replying to</NxText>
              <NxText variant="bodySm" numberOfLines={1}>{replyPreviewLabel(replyTo)}</NxText>
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
              backgroundColor: colors.glass,
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
                      bottom: isNarrow ? 50 : 56,
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

                  <TouchableOpacity
                    testID="chat-attach-location"
                    onPress={shareLocation}
                    style={styles.attachOption}
                  >
                    <Feather name="map-pin" size={19} color={colors.foreground} />
                    <NxText style={{ marginLeft: 10, color: colors.foreground }}>
                      Location
                    </NxText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                testID="chat-attach-toggle"
                onPress={() => setShowAttachMenu((v) => !v)}
                style={[
                  styles.roundBtn,
                  isNarrow && styles.roundBtnSm,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
            <Feather
              name={showAttachMenu ? "x" : "plus"}
              size={isNarrow ? 22 : 24}
              color={showAttachMenu ? colors.primary : colors.foreground}
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
                focused && styles.textFieldFocused,
                {
                  backgroundColor: colors.surface,
                  borderColor: focused ? colors.primary : colors.border,
                },
              ]}
            >
              <TextInput
                testID="chat-input"
                value={text}
                onChangeText={onChangeText}
                onFocus={() => {
                  setFocused(true);
                  setShowMediaPicker(false);
                }}
                onBlur={() => setFocused(false)}
                placeholder={editing ? "Edit message…" : "Message"}
                placeholderTextColor={colors.mutedFg}
                multiline
                style={[
                  styles.chatTextInput,
                  {
                    color: colors.foreground,
                  },
                ]}
              />

              {text.length > 0 ? (
                <TouchableOpacity
                  testID="chat-clear-input"
                  activeOpacity={0.7}
                  onPress={() => setText("")}
                  style={[
                    styles.clearBtn,
                    {
                      backgroundColor: colors.surfaceHigh,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather name="x" size={isNarrow ? 12 : 13} color={colors.mutedFg} />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                testID="chat-media"
                activeOpacity={0.7}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowMediaPicker((v) => !v);
                }}
                style={styles.emojiBtn}
              >
                <Feather
                  name="smile"
                  size={isNarrow ? 18 : 20}
                  color={showMediaPicker ? colors.primary : colors.mutedFg}
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
              style={[styles.roundBtn, isNarrow && styles.roundBtnSm, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Feather name="mic" size={isNarrow ? 16 : 18} color={colors.foreground} />
            </TouchableOpacity>
          ) : isRecording ? (
            <TouchableOpacity
              testID="chat-mic-stop"
              onPress={handleMicRelease}
              style={[styles.sendBtn, isNarrow && styles.sendBtnSm, { backgroundColor: colors.danger || "#e74c3c" }]}
            >
              <Feather name="stop-circle" size={isNarrow ? 18 : 20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <Animated.View style={sendStyle}>
              <TouchableOpacity
                testID="chat-send"
                disabled={sending || (!text.trim() && !editing)}
                onPress={submit}
                onPressIn={() => {
                  sendScale.value = withSpring(0.85, { damping: 16, stiffness: 320 });
                }}
                onPressOut={() => {
                  sendScale.value = withSpring(1, { damping: 12, stiffness: 260 });
                }}
                style={[
                  styles.sendBtn,
                  isNarrow && styles.sendBtnSm,
                  { backgroundColor: colors.primary, opacity: text.trim() ? 1 : 0.45 },
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Feather
                    name={editing ? "check" : "send"}
                    size={isNarrow ? 16 : 17}
                    color={colors.onPrimary}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>

      <MediaPicker
        visible={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleMediaSelect}
      />

      {/* ── Actions modal ─────────────────────────────────────────────── */}
      <Modal visible={!!actionMsg && !showReactPicker} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setActionMsg(null)}>
          <View style={[styles.reactionsBar, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            {REACTIONS.map((emoji) => (
              <ReactionBubble
                key={emoji}
                emoji={emoji}
                selected={actionMsg?.reactions?.some((r) => r.user_id === user?.user_id && r.emoji === emoji) || false}
                onPress={() => doReact(emoji)}
              />
            ))}
            <TouchableOpacity
              testID="react-custom"
              onPress={() => setShowReactPicker(true)}
              activeOpacity={0.7}
              style={[styles.reactionBubble, { width: 34, height: 34, borderRadius: 17 }, { backgroundColor: colors.accent }]}
            >
              <Feather name="plus" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {actionMsg ? (
              <View style={[styles.sheetPreview, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                <NxText variant="label" style={{ color: colors.mutedFg, marginBottom: 4 }}>Message</NxText>
                <NxText
                  variant="bodySm"
                  numberOfLines={2}
                  style={{ color: colors.foreground, opacity: 0.85 }}
                >
                  {actionMsg.kind === "image" ? "📷 Photo" : actionMsg.kind === "gif" ? "🎞️ GIF" : actionMsg.kind === "sticker" ? "🖼️ Sticker" : actionMsg.kind === "voice" ? "🎙 Voice message" : actionMsg.kind === "location" ? "📍 Shared location" : actionMsg.kind === "live_location" ? "📍 Live location" : actionMsg.content || ""}
                </NxText>
              </View>
            ) : null}
            <SheetAction icon="corner-up-left" label="Reply" onPress={() => { setReplyTo(actionMsg); setActionMsg(null); }} testID="msg-reply" />
            <SheetAction
              icon="map-pin"
              label={actionMsg?.pinned_for?.includes(user?.user_id as string) ? "Unpin" : "Pin"}
              tint={actionMsg?.pinned_for?.includes(user?.user_id as string) ? colors.primary : undefined}
              onPress={() => { if (actionMsg) doPin(actionMsg); }}
              testID="msg-pin"
            />
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
          </View>
        </Pressable>
      </Modal>

      {/* ── Custom emoji picker (reactions) ─────────────────────────────── */}
      <Modal visible={showReactPicker} transparent animationType="fade" onRequestClose={() => setShowReactPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowReactPicker(false)}>
          <Animated.View
            entering={FadeInUp.duration(180)}
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, height: isShort ? 300 : 360 }]}
          >
            <NxText variant="label" style={{ paddingBottom: spacing.sm }}>Add a reaction</NxText>
            <View style={{ flex: 1 }}>
              <EmojiKeyboard
                onEmojiSelected={(emoji) => {
                  setShowReactPicker(false);
                  if (actionMsg) doReact(emoji.emoji);
                }}
                enableSearchBar
                enableRecentlyUsed
                hideHeader
              />
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Live location duration picker ────────────────────────────── */}
      <Modal
        visible={showLiveDuration}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLiveDuration(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLiveDuration(false)}
        >
          <Animated.View
            entering={FadeInUp.duration(180)}
            style={[styles.liveSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.liveSheetHeader}>
              <View style={[styles.liveSheetDot, Platform.OS === "web" ? ({ boxShadow: "0 0 0 4px rgba(239,68,68,0.25)" } as any) : { elevation: 2 }]} />
              <NxText variant="label" style={{ marginLeft: 8 }}>Share live location</NxText>
            </View>
            <NxText style={{ color: colors.mutedFg, fontSize: 13, paddingBottom: spacing.sm }}>
              How long should your friends see your location?
            </NxText>
            {LIVE_DURATIONS.map((d) => (
              <TouchableOpacity
                key={d.label}
                testID={`live-duration-${d.label.replace(" ", "-")}`}
                onPress={() => pickDuration(d.ms)}
                style={[
                  styles.liveOption,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}
              >
                <Feather name="clock" size={17} color={colors.primary} />
                <NxText style={{ marginLeft: 10, color: colors.foreground, fontSize: 15 }}>
                  {d.label}
                </NxText>
                <Feather name="chevron-right" size={16} color={colors.mutedFg} />
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Chat Settings ─────────────────────────────────────────────── */}
      <ChatSettingsPanel
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        conversationId={conversation_id}
        other={other}
        messages={messages}
        onSearch={() => setShowSearch(true)}
        onClearChat={handleClearChat}
        onDeleteConversation={handleDeleteConversation}
        onBlock={handleBlock}
      />

      {/* ── Full-screen media viewer (photo / video / gif) ───────────── */}
      <Modal
        visible={!!viewerMsg}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerMsg(null)}
      >
        <View style={styles.viewerOverlay}>
          <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
            <View style={styles.viewerTopBar}>
              <TouchableOpacity
                testID="media-viewer-close"
                onPress={() => setViewerMsg(null)}
                style={styles.viewerClose}
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.viewerBody}>
              {viewerMsg?.kind === "video" && viewerMsg.media ? (
                <ViewerVideo uri={viewerMsg.media} />
              ) : viewerMsg?.media ? (
                <ExpoImage
                  source={{ uri: viewerMsg.media }}
                  style={styles.viewerImage}
                  contentFit="contain"
                />
              ) : null}
            </View>
          </SafeAreaView>
        </View>
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

/* ── Video preview in chat bubble ───────────────────────────────────── */
function BubbleVideo({
  uri,
  dims,
}: {
  uri: string;
  dims: { width: number; height: number };
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.pause();
    return () => {
      player.pause();
    };
  }, [player, uri]);

  return (
    <View
      style={{
        width: dims.width,
        height: dims.height,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <ExpoVideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        nativeControls={false}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <View style={styles.bubblePlay}>
          <Feather name="play" size={22} color="#fff" style={{ marginLeft: 2 }} />
        </View>
      </View>
    </View>
  );
}

/* ── Full-screen video (media viewer) ─────────────────────────────── */
function ViewerVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = false;
    player.play();
    return () => {
      player.pause();
    };
  }, [player, uri]);

  return (
    <ExpoVideoView
      player={player}
      style={styles.viewerVideo}
      contentFit="contain"
      nativeControls
    />
  );
}

/* ── Message bubble ───────────────────────────────────────────────── */
function MessageBubble({
  m,
  isMe,
  onLongPress,
  onReply,
  onOpenMedia,
  onReplyPress,
  highlighted,
  replySource,
  other,
  sentBg,
  sentFg,
  showReadReceipts = true,
  onStopLive,
  onCallAgain,
}: {
  m: Msg;
  isMe: boolean;
  onLongPress: () => void;
  onReply?: () => void;
  onOpenMedia?: () => void;
  onReplyPress?: () => void;
  highlighted?: boolean;
  replySource?: Msg;
  other?: any;
  sentBg?: string;
  sentFg?: string;
  showReadReceipts?: boolean;
  onStopLive: (messageId: string) => void;
  onCallAgain?: () => void;
}) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const swipeableRef = useRef<Swipeable | null>(null);
  const bubbleBg = isMe ? sentBg || colors.bubbleSent : colors.bubbleRecv;
  const bubbleFg = isMe ? sentFg || colors.bubbleSentFg : colors.bubbleRecvFg;
  const isDeleted = m.deleted_for_everyone || m.kind === "deleted";
  const isVoice = m.kind === "voice" && !!m.media;
  const isImage = m.kind === "image" && !!m.media;
  const isVideo = m.kind === "video" && !!m.media;
  const isGif = m.kind === "gif" && !!m.media;
  const isSticker = m.kind === "sticker" && !!m.media;
  const isMedia = isGif || isSticker;
  const isLocation = m.kind === "location";
  const isLiveLocation = m.kind === "live_location";
  const isCall = m.kind === "call_voice" || m.kind === "call_video";

  const callMeta = useMemo(() => {
    if (!isCall || !m.media) return null;
    let p: any = m.media;
    if (typeof p === "string") {
      try {
        p = JSON.parse(p);
      } catch {
        return null;
      }
    }
    if (p && p.type === "call")
      return p as { call_type?: string; status?: string; duration_sec?: number };
    return null;
  }, [isCall, m.media]);

  const mediaDims = useMemo(() => {
    if ((!isImage && !isVideo) || !m.content) return null;
    try {
      const p = JSON.parse(m.content);
      if (typeof p.w === "number" && typeof p.h === "number")
        return { w: p.w, h: p.h };
    } catch {}
    return null;
  }, [isImage, isVideo, m.content]);
  const loc = useMemo(() => {
    if (!isLocation || !m.content) return null;
    try {
      const p = JSON.parse(m.content);
      if (typeof p.lat === "number" && typeof p.lng === "number") return p as { lat: number; lng: number };
    } catch {}
    return null;
  }, [isLocation, m.content]);
  const liveData = useMemo(() => {
    if (!isLiveLocation || !m.content) return null;
    try {
      const p = JSON.parse(m.content);
      if (typeof p.lat === "number" && typeof p.lng === "number")
        return p as { lat: number; lng: number; started_at?: string; expires_at?: string };
    } catch {}
    return null;
  }, [isLiveLocation, m.content]);

  const gifMeta = useMemo(() => {
    if (!isMedia || !m.content) return null;
    try {
      const p = JSON.parse(m.content);
      if (typeof p.w === "number" && typeof p.h === "number")
        return p as { title?: string; w: number; h: number };
    } catch {}
    return null;
  }, [isMedia, m.content]);

  const isRead = (m.read_by?.length || 0) > 1;
  const time = dayjs(m.created_at).format("HH:mm");
  const [mapErr, setMapErr] = useState(false);

  const linkUrl = useMemo(() => {
    if (m.kind !== "text" || !m.content || m.content.length > 1000) return null;
    const found = m.content.match(/\bhttps?:\/\/[^\s<>"')\]]+/gi);
    return found ? found[0] : null;
  }, [m.kind, m.content]);

  const openLink = (url: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const openMapLink = () => {
    const target = loc || liveData;
    if (!target) return;
    const url = `https://www.google.com/maps?q=${target.lat},${target.lng}`;
    openLink(url);
  };

  // Responsive max bubble width: 78% of screen, capped at 320px
  const bubbleMaxWidth = Math.min(screenWidth * 0.78, 320);
  // Image size scales with screen
  const imageSize = Math.min(screenWidth * 0.62, 240);

  const gifDims = useMemo(() => {
    const base = imageSize;
    let w = base;
    let h = 200;
    if (gifMeta && gifMeta.w > 0 && gifMeta.h > 0) {
      const aspect = gifMeta.h / gifMeta.w;
      w = Math.min(base, gifMeta.w);
      h = Math.round(w * aspect);
      if (h > 180) {
        h = 180;
        w = Math.round(h / aspect);
      }
    }
    return { width: w, height: h };
  }, [gifMeta, imageSize]);

  // Stickers are rendered mini-sized (like WhatsApp), no bubble background.
  const stickerDims = useMemo(() => {
    const base = Math.min(screenWidth * 0.28, 112);
    let w = base;
    let h = base;
    if (gifMeta && gifMeta.w > 0 && gifMeta.h > 0) {
      const aspect = gifMeta.h / gifMeta.w;
      w = base;
      h = Math.round(w * aspect);
      if (h > 112) {
        h = 112;
        w = Math.round(h / aspect);
      }
    }
    return { width: Math.max(48, w), height: Math.max(48, h) };
  }, [gifMeta, screenWidth]);

  const photoDims = useMemo(() => {
    const maxW = Math.min(screenWidth * 0.62, 240);
    const maxH = Math.min(screenWidth * 0.62, 260);
    if (mediaDims && mediaDims.w > 0 && mediaDims.h > 0) {
      const aspect = mediaDims.w / mediaDims.h;
      let w = maxW;
      let h = maxW / aspect;
      if (h > maxH) {
        h = maxH;
        w = maxH * aspect;
      }
      return { width: w, height: h };
    }
    return { width: maxW, height: Math.round(maxW * 0.75) };
  }, [mediaDims, screenWidth]);

  const grouped = (m.reactions || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const groupedList = Object.entries(grouped);

  // ── Meta row (time + read receipt) ──────────────────────────────────
  const MetaRow = () => (
    <View style={styles.msgMeta}>
      {m.pinned_for?.length ? (
        <Feather name="map-pin" size={10} color={bubbleFg} style={{ marginRight: 3, opacity: 0.8 }} />
      ) : null}
      {m.edited ? (
        <NxText style={[styles.msgMetaText, { color: bubbleFg, opacity: 0.7, marginRight: 3 }]}>edited</NxText>
      ) : null}
      <NxText
        style={[
          styles.msgMetaText,
          { color: bubbleFg, opacity: 0.7 },
        ]}
      >
        {time}
      </NxText>
      {isMe ? (
        <NxText
          style={[
            styles.msgMetaTick,
            { color: bubbleFg, opacity: isRead ? 0.95 : 0.55 },
          ]}
        >
          {showReadReceipts ? (isRead ? "✓✓" : "✓") : "✓"}
        </NxText>
      ) : null}
    </View>
  );

  // Clean ChatGPT-style radius: 18 with a small tail on the sender side
  const bubbleRadius = isMe
    ? { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 }
    : { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 18 };

  return (
    <View
      style={[
        styles.msgRow,
        isMe ? styles.msgRowMe : styles.msgRowThem,
        { marginBottom: groupedList.length > 0 ? 16 : 8 },
      ]}
    >
      {/* ── Avatar for received messages ── */}
      {!isMe && (
        <View style={[styles.msgAvatar, { backgroundColor: colors.accent }]}>
          {other?.profile_picture ? (
            <Image
              source={{ uri: other.profile_picture }}
              style={{ width: 30, height: 30, borderRadius: 15 }}
            />
          ) : (
            <NxText style={{ color: colors.mutedFg, fontSize: 12, fontFamily: fonts.bodySemi }}>
              {(other?.display_name || "?")[0].toUpperCase()}
            </NxText>
          )}
        </View>
      )}

        <Swipeable
          ref={swipeableRef}
          friction={0.5}
          leftThreshold={52}
          overshootLeft={false}
          renderLeftActions={() => (
            <View style={styles.swipeReplyAction}>
              <View
                style={[
                  styles.swipeReplyIcon,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Feather name="corner-up-left" size={18} color={colors.onPrimary} />
              </View>
            </View>
          )}
          onSwipeableOpen={(direction) => {
            if (direction === "left" && !isCall) {
              swipeableRef.current?.close();
              onReply?.();
            }
          }}
        >
        <Animated.View
          entering={isMe ? FadeInUp.duration(180) : undefined}
          style={{ maxWidth: bubbleMaxWidth, alignItems: isMe ? "flex-end" : "flex-start" }}
        >
        <TouchableOpacity
          onLongPress={() => {
            if (isCall) return;
            try {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            } catch {}
            onLongPress();
          }}
          onPress={() => {
            if (isCall) onCallAgain?.();
            else if (isImage || isVideo) onOpenMedia?.();
            else if ((isLocation || isLiveLocation) && (loc || liveData)) openMapLink();
            else if (linkUrl) openLink(linkUrl);
          }}
          activeOpacity={0.82}
          testID={`msg-${m.message_id}`}
        >
          {/* ── Call-status card ── */}
          {isCall ? (
            <View
              style={[
                {
                  backgroundColor: bubbleBg,
                  borderRadius: 16,
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  minWidth: 216,
                  maxWidth: bubbleMaxWidth,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  ...(Platform.OS === "web"
                    ? { boxShadow: "0px 2px 10px rgba(0,0,0,0.14)" } as any
                    : {
                        shadowColor: "#000",
                        shadowOpacity: 0.12,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                      }),
                  ...(highlighted ? { borderWidth: 1.5, borderColor: colors.primary } : {}),
                },
              ]}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: colors.primary + "22",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name={callMeta?.call_type === "video" ? "video" : "phone"}
                  size={19}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <NxText
                  variant="bodySm"
                  style={{ fontFamily: fonts.bodySemi, color: bubbleFg }}
                >
                  {m.content}
                </NxText>
                {callMeta?.status === "canceled" ? (
                  <NxText
                    variant="caption"
                    style={{ color: colors.primary, marginTop: 3, fontFamily: fonts.bodySemi }}
                  >
                    Tap to call again
                  </NxText>
                ) : null}
                <View style={{ marginTop: 2 }}>
                  <MetaRow />
                </View>
              </View>
              {callMeta?.status === "canceled" ? (
                <Feather name="phone-call" size={18} color={colors.primary} />
              ) : null}
            </View>
          ) : isVoice ? (
            <View
              style={[
                styles.bubble,
                bubbleRadius,
                { backgroundColor: bubbleBg, paddingHorizontal: 8, paddingVertical: 8 },
                ...(highlighted
                  ? [{ borderWidth: 1.5, borderColor: colors.primary }]
                  : []),
              ]}
            >
              <VoiceBubble
                mediaUri={m.media!}
                duration={m.content}
                messageId={m.message_id}
                isMe={isMe}
              />
              <MetaRow />
            </View>
          ) : (
            /* ── Text / image bubble ── */
            <View
              style={[
                styles.bubble,
                bubbleRadius,
                {
                  backgroundColor: isSticker ? "transparent" : bubbleBg,
                  paddingVertical: isImage || isMedia || isLocation || isLiveLocation ? 4 : 11,
                  paddingHorizontal: isImage || isMedia || isLocation || isLiveLocation ? 4 : 15,
                  ...(!isMe && !isImage && !isMedia && !isDeleted && !isLocation
                    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }
                    : {}),
                  ...(isImage || isMedia
                    ? {}
                    : isMe
                      ? (Platform.OS === "web"
                        ? { boxShadow: `0px 4px 16px rgba(0,0,0,0.18)` } as any
                        : { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }
                      )
                      : {}),
                  ...(highlighted
                    ? { borderWidth: 1.5, borderColor: colors.primary }
                    : {}),
                },
              ]}
            >
              {/* Reply preview — tap to jump to the original message */}
              {replySource ? (
                <Pressable
                  onPress={onReplyPress}
                  style={({ pressed }) => [
                    styles.replyPreview,
                    {
                      borderLeftColor: isMe ? "rgba(0,0,0,0.4)" : colors.primary,
                      backgroundColor: isMe
                        ? "rgba(0,0,0,0.06)"
                        : colors.primary + "18",
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <NxText
                    numberOfLines={2}
                    style={{ color: bubbleFg, fontSize: 12, fontFamily: fonts.bodySemi, opacity: 0.9 }}
                  >
                    {replyPreviewLabel(replySource)}
                  </NxText>
                </Pressable>
              ) : null}

              {/* Content */}
              {isDeleted ? (
                <NxText
                  style={{
                    color: bubbleFg,
                    fontStyle: "italic",
                    fontSize: 14,
                    opacity: 0.55,
                  }}
                >
                  🚫 Message removed
                </NxText>
              ) : isImage ? (
                <Image
                  source={{ uri: m.media! }}
                  resizeMode="cover"
                  style={{
                    width: photoDims.width,
                    height: photoDims.height,
                    borderRadius: 14,
                  }}
                />
              ) : isVideo ? (
                <BubbleVideo uri={m.media!} dims={photoDims} />
              ) : isGif ? (
                <ExpoImage
                  source={{ uri: m.media! }}
                  contentFit="contain"
                  style={{
                    width: gifDims.width,
                    height: gifDims.height,
                    borderRadius: 14,
                  }}
                />
              ) : isSticker ? (
                <ExpoImage
                  source={{ uri: m.media! }}
                  contentFit="contain"
                  style={{ width: stickerDims.width, height: stickerDims.height }}
                />
              ) : isLocation && loc ? (
                <View style={{ borderRadius: 14, overflow: "hidden", width: imageSize }}>
                  {mapErr ? (
                    <View
                      style={{
                        height: 140,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.05)",
                      }}
                    >
                      <Feather name="map-pin" size={28} color={bubbleFg} style={{ opacity: 0.7 }} />
                      <NxText style={{ marginTop: 6, fontSize: 11, color: bubbleFg, opacity: 0.7 }}>
                        Shared location
                      </NxText>
                    </View>
                  ) : (
                    <Image
                      source={{
                        uri: `https://static-maps.yandex.ru/1.x/?ll=${loc.lng},${loc.lat}&z=15&size=600,400&l=map&pt=${loc.lng},${loc.lat},pm2rdl&lang=en_US`,
                      }}
                      resizeMode="cover"
                      style={{ width: imageSize, height: 150 }}
                      onError={() => setMapErr(true)}
                    />
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      backgroundColor: "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Feather name="map-pin" size={12} color={bubbleFg} style={{ opacity: 0.8 }} />
                    <NxText
                      style={{
                        flex: 1,
                        marginLeft: 6,
                        fontSize: 12.5,
                        color: bubbleFg,
                        fontFamily: fonts.bodySemi,
                      }}
                      numberOfLines={1}
                    >
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                    </NxText>
                    <Feather name="external-link" size={13} color={bubbleFg} style={{ opacity: 0.7 }} />
                  </View>
                </View>
              ) : isLiveLocation && liveData ? (
                <LiveLocationCard
                  data={liveData}
                  isOwner={isMe}
                  fg={bubbleFg}
                  muted={bubbleFg}
                  width={imageSize}
                  onOpen={openMapLink}
                  onStop={() => onStopLive(m.message_id)}
                />
              ) : (
                <View>
                  <NxText
                    style={{
                      color: bubbleFg,
                      fontSize: 15,
                      lineHeight: 22,
                      fontFamily: isMe ? fonts.bodyMedium : fonts.body,
                    }}
                  >
                    {m.content}
                  </NxText>
                  {linkUrl ? (
                    <View style={{ marginTop: 8 }}>
                      <LinkPreview
                        url={linkUrl}
                        token={token}
                        bg={
                          isMe
                            ? "rgba(0,0,0,0.14)"
                            : "rgba(255,255,255,0.07)"
                        }
                        fg={bubbleFg}
                        muted={
                          isMe
                            ? "rgba(0,0,0,0.6)"
                            : "rgba(255,255,255,0.62)"
                        }
                      />
                    </View>
                  ) : null}
                </View>
              )}

              {/* Time + tick */}
              <MetaRow />
            </View>
          )}
        </TouchableOpacity>

        {/* Reactions row */}
        {groupedList.length > 0 ? (
          <Animated.View
            entering={ZoomIn.springify().damping(14)}
            style={[
              styles.reactionsRow,
              {
                backgroundColor: colors.surfaceHigh,
                borderColor: colors.border,
                marginTop: 6,
                alignSelf: isMe ? "flex-end" : "flex-start",
                marginRight: isMe ? 6 : 0,
                marginLeft: isMe ? 0 : 6,
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
        </Animated.View>
        </Swipeable>
      </View>
  );
}
function ReactionBubble({ emoji, selected, onPress }: { emoji: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={`react-${emoji}`}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.reactionBubble, { width: 34, height: 34, borderRadius: 17 }, selected && { backgroundColor: colors.primary + "33", borderColor: colors.primary, borderWidth: 1 }]}
    >
      <NxText style={{ fontSize: 19 }}>{emoji}</NxText>
    </TouchableOpacity>
  );
}

function SheetAction({ icon, label, onPress, testID, tint }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8} style={styles.sheetItem}>
      <View style={[styles.sheetIcon, { backgroundColor: tint ? colors.danger + "1A" : colors.accent }]}>
        <Feather name={icon} size={18} color={tint || colors.foreground} />
      </View>
      <NxText style={{ marginLeft: 12, color: tint || colors.foreground, fontFamily: fonts.bodyMedium }}>{label}</NxText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── Message bubble ───────────────────────────────────────────────────
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 2,
    paddingHorizontal: 4,
  },
  msgRowMe: {
    justifyContent: "flex-end",
  },
  msgRowThem: {
    justifyContent: "flex-start",
  },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginBottom: 2,
    flexShrink: 0,
  },
  bubble: {
    borderRadius: 20,
    overflow: "hidden",
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingLeft: 10,
    paddingVertical: 5,
    paddingRight: 8,
    marginBottom: 7,
  },
  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
    gap: 2,
  },
  msgMetaText: {
    fontSize: 11,
    fontFamily: "Outfit",
  },
  msgMetaTick: {
    fontSize: 12,
    lineHeight: 15,
    marginLeft: 2,
    fontFamily: "Outfit-SemiBold",
  },

  // ── Shared ──────────────────────────────────────────────────────────
  chatSkeleton: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // subtle bottom shadow for depth
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    ...(Platform.OS === "web"
      ? { backdropFilter: "blur(20px)" as any, WebkitBackdropFilter: "blur(20px)" as any }
      : {}),
  },
  iconBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  searchInput: { flexDirection: "row", alignItems: "center", borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 14, height: 40 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === "web"
      ? { backdropFilter: "blur(24px)" as any, WebkitBackdropFilter: "blur(24px)" as any }
      : {}),
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  roundBtnSm: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  attachMenu: {
    position: "absolute",
    left: 0,
    bottom: 56,
    width: 160,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 6,
    elevation: 14,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 50,
  },
  attachOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  textField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 2,
    minHeight: 44,
    maxHeight: 110,
  },
  textFieldFocused: {
    shadowColor: "#CFA876",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  chatTextInput: {
    flex: 1,
    fontFamily: "Outfit",
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 21,
    minHeight: 42,
    maxHeight: 104,
    paddingTop: Platform.OS === "ios" ? 11 : 10,
    paddingBottom: Platform.OS === "ios" ? 11 : 10,
    paddingRight: 6,
    textAlignVertical: "center",
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginLeft: 4,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  stickerMarkText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: "Outfit-SemiBold",
    letterSpacing: 0.3,
    marginTop: 1,
    opacity: 0.55,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#CFA876",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  sendBtnSm: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  liveSheet: { padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1 },
  liveSheetHeader: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.xs },
  liveSheetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DC2626",
  },
  liveOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  reactionsBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    paddingHorizontal: 8, paddingVertical: 6, marginHorizontal: 20, marginBottom: 14,
    borderRadius: 24, borderWidth: 1, gap: 2,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  reactionBubble: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  reactionsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, borderWidth: 1, gap: 6 },
  reactionChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2 },
  sheet: { padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1 },
  sheetPreview: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  sheetIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  sheetItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
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
  bubblePlay: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  swipeReplyAction: {
    width: 62,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 7,
  },
  swipeReplyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerOverlay: { flex: 1, backgroundColor: "#000" },
  viewerTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  viewerClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  viewerBody: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "100%" },
  viewerVideo: { width: "100%", height: "100%" },
});
