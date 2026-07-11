import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  Keyboard,
  PanResponder,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import dayjs from "dayjs";
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VoiceBubble } from "@/src/components/VoiceBubble";
import { useVoiceRecorder } from "@/src/hooks/useVoiceRecorder";
import { fonts, spacing } from "@/src/theme";

type Circle = {
  circle_id: string;
  name: string;
  description?: string;
  photo?: string | null;
  privacy: "public" | "private";
  theme?: string;
  member_count: number;
  my_role: "owner" | "admin" | "member";
};

const CIRCLE_THEMES = [
  { id: "default", name: "Default", colors: ["#F8FAFC", "#EEF2F7"] },
  { id: "classic", name: "XYTEEE", colors: ["#6D28D9", "#A855F7"] },
  { id: "midnight", name: "Nexus", colors: ["#0F172A", "#312E81"] },
  { id: "ocean", name: "Ocean", colors: ["#0369A1", "#06B6D4"] },
  { id: "sunset", name: "Sunset", colors: ["#F97316", "#EC4899"] },
  { id: "forest", name: "Forest", colors: ["#166534", "#22C55E"] },
  { id: "aurora", name: "Aurora", colors: ["#06B6D4", "#8B5CF6"] },
  { id: "rose", name: "Rose", colors: ["#E11D48", "#FB7185"] },
  { id: "violet", name: "Violet", colors: ["#6D28D9", "#C026D3"] },
  { id: "gold", name: "Gold", colors: ["#B45309", "#FACC15"] },
  { id: "cyber", name: "Cyber", colors: ["#00F5FF", "#FF00E5"] },
  { id: "sky", name: "Sky", colors: ["#0EA5E9", "#93C5FD"] },
  { id: "ember", name: "Ember", colors: ["#DC2626", "#F97316"] },
  { id: "mint", name: "Mint", colors: ["#059669", "#6EE7B7"] },
  { id: "monochrome", name: "Mono", colors: ["#27272A", "#A1A1AA"] },
] as const;

type CircleMessage = {
  message_id: string;
  circle_id: string;
  sender_id: string;
  content: string;
  kind: string;
  media?: string | null;
  reply_to?: string | null;
  read_by?: string[];
  reactions?: Array<{
    user_id: string;
    emoji: string;
    at?: string;
  }>;
  edited?: boolean;
  created_at: string;
  sender?: any;
};

function CircleVideo({ uri, preview = false }: { uri: string; preview?: boolean }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={{
        width: preview ? 84 : 230,
        height: preview ? 84 : 230,
        borderRadius: preview ? 12 : 16,
      }}
      contentFit="cover"
      nativeControls={!preview}
      pointerEvents={preview ? "none" : "auto"}
    />
  );
}

export default function CirclePage() {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCircleMenu, setShowCircleMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<CircleMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<CircleMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<CircleMessage | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<CircleMessage | null>(null);
  const [showAllReactionEmojis, setShowAllReactionEmojis] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<string | null>(null);
  const [pendingMediaKind, setPendingMediaKind] = useState<"image" | "video">("image");

  const listRef = useRef<FlatList<CircleMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const micStartXRef = useRef(0);
  const micDragCancelledRef = useRef(false);

  const {
    state: recState,
    elapsed: recElapsed,
    start: recStart,
    stop: recStop,
    cancel: recCancel,
  } = useVoiceRecorder();

  const load = useCallback(async () => {
    if (!token || !id) return;

    try {
      const [circleResult, messageResult] = await Promise.all([
        api<{ circle: Circle }>(`/circles/${id}`, { token }),
        api<{ messages: CircleMessage[] }>(
          `/circles/${id}/messages`,
          { token }
        ),
      ]);

      setCircle(circleResult.circle);
      setMessages(messageResult.messages || []);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeCircleTheme = async (theme: string) => {
    if (!token || !id || themeBusy) return;

    setThemeBusy(true);

    try {
      await api<{ theme: string }>(`/circles/${id}/theme`, {
        method: "PUT",
        token,
        body: { theme },
      });

      setCircle((current) =>
        current ? { ...current, theme } : current
      );
      setShowThemePicker(false);
    } finally {
      setThemeBusy(false);
    }
  };

  useEffect(() => {
    return subscribe((event) => {
      if (
        event.type !== "circle_message" &&
        event.type !== "circle_message_edit" &&
        event.type !== "circle_message_react" &&
        event.type !== "circle_message_delete" &&
        event.type !== "circle_theme_update"
      ) {
        return;
      }

      if (event.circle_id !== id) return;

      if (event.type === "circle_theme_update" && event.theme) {
        setCircle((current) =>
          current ? { ...current, theme: event.theme } : current
        );
        return;
      }

      if (event.type === "circle_message" && event.message) {
        setMessages((current) => {
          if (
            current.some(
              (message) =>
                message.message_id === event.message.message_id
            )
          ) {
            return current;
          }

          return [...current, event.message];
        });
      }

      if (
        (event.type === "circle_message_edit" ||
          event.type === "circle_message_react") &&
        event.message
      ) {
        setMessages((current) =>
          current.map((message) =>
            message.message_id === event.message.message_id
              ? { ...message, ...event.message }
              : message
          )
        );
      }

      if (
        event.type === "circle_message_delete" &&
        event.message_id
      ) {
        setMessages((current) =>
          current.filter(
            (message) => message.message_id !== event.message_id
          )
        );
      }
    });
  }, [subscribe, id]);

  const sendMessage = async () => {
    const content = text.trim();

    if ((!content && !pendingMedia) || !token || !id || sending) return;

    setSending(true);

    try {
      if (editingMessage) {
        const updated = await api<CircleMessage>(
          `/circles/message/${editingMessage.message_id}`,
          {
            method: "PUT",
            token,
            body: { content },
          }
        );

        setMessages((current) =>
          current.map((message) =>
            message.message_id === updated.message_id
              ? { ...message, ...updated }
              : message
          )
        );

        setEditingMessage(null);
        setText("");
        return;
      }

      const result = await api<{ message: CircleMessage }>(
        "/circles/message",
        {
          method: "POST",
          token,
          body: {
            circle_id: id,
            content,
            kind: pendingMedia ? pendingMediaKind : "text",
            media: pendingMedia || undefined,
            reply_to: replyingTo?.message_id || null,
          },
        }
      );

      setMessages((current) => {
        if (
          current.some(
            (message) =>
              message.message_id === result.message.message_id
          )
        ) {
          return current;
        }

        return [...current, result.message];
      });

      setText("");
      setPendingMedia(null);
      setReplyingTo(null);
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const pickMedia = async (type: "image" | "video") => {
    setShowAttachMenu(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted" || !token || !id) return;

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
    const media =
      type === "image"
        ? asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : null
        : asset.uri;

    if (!media) return;

    setPendingMedia(media);
    setPendingMediaKind(type);
    setTimeout(() => inputRef.current?.focus(), 100);
    return;
  };

  const handleMicPress = async () => {
    if (recState !== "idle") return;

    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Medium
        ).catch(() => {});
      }
    } catch {}

    await recStart();
  };

  const handleMicTouchStart = (event: any) => {
    micStartXRef.current = event.nativeEvent.pageX;
    micDragCancelledRef.current = false;
    handleMicPress();
  };

  const handleMicTouchMove = async (event: any) => {
    if (micDragCancelledRef.current) return;

    const distance = event.nativeEvent.pageX - micStartXRef.current;

    if (distance <= -80) {
      micDragCancelledRef.current = true;

      try {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          ).catch(() => {});
        }
      } catch {}

      await recCancel();
    }
  };

  const micPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: () => {
      micDragCancelledRef.current = false;
      handleMicPress();
    },

    onPanResponderMove: async (_, gestureState) => {
      if (
        gestureState.dx <= -80 &&
        !micDragCancelledRef.current
      ) {
        micDragCancelledRef.current = true;

        try {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            ).catch(() => {});
          }
        } catch {}

        await recCancel();
      }
    },

    onPanResponderRelease: () => {
      micDragCancelledRef.current = false;
    },

    onPanResponderTerminate: () => {
      micDragCancelledRef.current = false;
    },
  });

  const handleMicRelease = async () => {
    if (recState !== "recording" || !token || !id) return;

    const result = await recStop();
    if (!result) return;

    setSending(true);

    try {
      const resultMessage = await api<{ message: CircleMessage }>(
        "/circles/message",
        {
          method: "POST",
          token,
          body: {
            circle_id: id,
            kind: "voice",
            media: result.uri,
            content: result.durationStr,
            reply_to: replyingTo?.message_id || null,
          },
        }
      );

      setMessages((current) =>
        current.some(
          (message) =>
            message.message_id === resultMessage.message.message_id
        )
          ? current
          : [...current, resultMessage.message]
      );

      setReplyingTo(null);
    } finally {
      setSending(false);
    }
  };

  const startReply = (message: CircleMessage) => {
    setSelectedMessage(null);
    setEditingMessage(null);
    setReplyingTo(message);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const startEdit = (message: CircleMessage) => {
    setSelectedMessage(null);
    setReplyingTo(null);
    setEditingMessage(message);
    setText(message.content);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const reactToMessage = async (
    message: CircleMessage,
    emoji: string
  ) => {
    if (!token) return;

    setSelectedMessage(null);

    const updated = await api<CircleMessage>(
      `/circles/message/${message.message_id}/react`,
      {
        method: "POST",
        token,
        body: { emoji },
      }
    );

    setMessages((current) =>
      current.map((item) =>
        item.message_id === updated.message_id
          ? { ...item, ...updated }
          : item
      )
    );
  };

  const deleteMessage = async (message: CircleMessage) => {
    if (!token) return;

    setSelectedMessage(null);

    await api(`/circles/message/${message.message_id}`, {
      method: "DELETE",
      token,
    });

    setMessages((current) =>
      current.filter(
        (item) => item.message_id !== message.message_id
      )
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[
          styles.safe,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <Animated.View
        entering={FadeInDown.duration(420).springify().damping(18)}
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={[
            styles.headerBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather
            name="chevron-left"
            size={24}
            color={colors.foreground}
          />
        </TouchableOpacity>

        <View style={styles.circleAvatar}>
          <Avatar
            uri={circle?.photo || undefined}
            name={circle?.name || "Circle"}
            size={48}
          />
        </View>

        <View style={styles.headerInfo}>
          <NxText
            numberOfLines={1}
            style={{
              color: colors.foreground,
              fontSize: 17,
              fontFamily: fonts.bodySemi,
            }}
          >
            {circle?.name || "Circle"}
          </NxText>

          <View style={styles.headerMetaRow}>
            <View
              style={[
                styles.metaChip,
                { backgroundColor: colors.surface },
              ]}
            >
              <Feather
                name="users"
                size={10}
                color={colors.primary}
              />
              <NxText
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  color: colors.mutedFg,
                  fontFamily: fonts.bodySemi,
                }}
              >
                {circle?.member_count || 0}
              </NxText>
            </View>

            <View
              style={[
                styles.metaChip,
                { backgroundColor: colors.surface },
              ]}
            >
              <Feather
                name={circle?.privacy === "private" ? "lock" : "globe"}
                size={10}
                color={colors.primary}
              />
              <NxText
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  color: colors.mutedFg,
                  fontFamily: fonts.bodySemi,
                }}
              >
                {circle?.privacy === "private" ? "Private" : "Public"}
              </NxText>
            </View>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowCircleMenu(true)}
          style={[
            styles.headerBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather
            name="more-horizontal"
            size={21}
            color={colors.foreground}
          />
        </TouchableOpacity>
      </Animated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <LinearGradient
        colors={
          (circle?.theme || "default") === "default"
            ? [colors.background, colors.background]
            : (CIRCLE_THEMES.find(
                (theme) => theme.id === circle?.theme
              )?.colors || [colors.background, colors.background]) as any
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.message_id}
        contentContainerStyle={[
          styles.list,
          messages.length === 0 && styles.emptyList,
        ]}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => {
          const isMe = item.sender_id === user?.user_id;
          let swipeableRef: Swipeable | null = null;

          return (
            <Swipeable

              ref={(ref) => {
                swipeableRef = ref;
              }}
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
                    <Feather
                      name="corner-up-left"
                      size={18}
                      color={colors.onPrimary}
                    />
                  </View>
                </View>
              )}
              onSwipeableOpen={(direction) => {
                if (direction === "left") {
                  swipeableRef?.close();
                  startReply(item);
                }
              }}
            >
              <Animated.View
              entering={isMe ? FadeInRight.duration(320).springify() : FadeInDown.duration(320).springify()}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.springify().damping(18)}
              style={[
                styles.messageRow,
                {
                  justifyContent: isMe
                    ? "flex-end"
                    : "flex-start",
                },
              ]}
            >
              {!isMe ? (
                <Avatar
                  uri={item.sender?.profile_picture}
                  name={item.sender?.display_name || "Member"}
                  size={28}
                />
              ) : null}

              <View
                style={[
                  styles.messageWrap,
                  !isMe && { marginLeft: 8 },
                ]}
              >
                {!isMe ? (
                  <NxText
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      fontFamily: fonts.bodySemi,
                      marginLeft: 4,
                      marginBottom: 3,
                    }}
                  >
                    {item.sender?.display_name || "Member"}
                  </NxText>
                ) : null}

                <Pressable
                  onLongPress={() => setSelectedMessage(item)}
                  delayLongPress={280}
                  style={[
                    styles.bubble,
                    {
                      backgroundColor:
                        (circle?.theme || "default") === "default"
                          ? isMe
                            ? colors.bubbleSent
                            : colors.bubbleRecv
                          : isMe
                            ? "rgba(255,255,255,0.28)"
                            : "rgba(0,0,0,0.22)",
                      borderWidth:
                        (circle?.theme || "default") === "default" ? 0 : 1,
                      borderColor:
                        (circle?.theme || "default") === "default"
                          ? "transparent"
                          : "rgba(255,255,255,0.20)",
                      borderBottomRightRadius: isMe ? 5 : 19,
                      borderBottomLeftRadius: isMe ? 19 : 5,
                    },
                  ]}
                >
                  {item.reply_to ? (() => {
                    const repliedMessage = messages.find(
                      (message) => message.message_id === item.reply_to
                    );

                    return repliedMessage ? (
                      <View
                        style={[
                          styles.replyInsideBubble,
                          {
                            borderLeftColor: colors.primary,
                            backgroundColor: isMe
                              ? "rgba(255,255,255,0.12)"
                              : colors.background,
                          },
                        ]}
                      >
                        <NxText
                          numberOfLines={1}
                          style={{
                            color: colors.primary,
                            fontSize: 11,
                            fontFamily: fonts.bodySemi,
                          }}
                        >
                          {repliedMessage.sender_id === user?.user_id
                            ? "You"
                            : repliedMessage.sender?.display_name || "Member"}
                        </NxText>

                        <NxText
                          numberOfLines={1}
                          style={{
                            marginTop: 2,
                            fontSize: 12,
                            opacity: 0.72,
                            color: isMe
                              ? colors.bubbleSentFg
                              : colors.bubbleRecvFg,
                          }}
                        >
                          {repliedMessage.content}
                        </NxText>
                      </View>
                    ) : null;
                  })() : null}

                  {item.kind === "voice" && item.media ? (
                    <VoiceBubble
                      mediaUri={item.media}
                      duration={item.content}
                      messageId={item.message_id}
                      isMe={isMe}
                    />
                  ) : item.kind === "video" && item.media ? (
                    <View>
                      <CircleVideo uri={item.media} />

                      {item.content ? (
                        <NxText
                          style={{
                            color: isMe
                              ? colors.bubbleSentFg
                              : colors.bubbleRecvFg,
                            fontSize: 15,
                            lineHeight: 20,
                            marginTop: 5,
                          }}
                        >
                          {item.content}
                        </NxText>
                      ) : null}
                    </View>
                  ) : item.kind === "image" && item.media ? (
                    <View>
                      <Image
                        source={{ uri: item.media }}
                        resizeMode="cover"
                        style={{
                          width: 230,
                          height: 230,
                          borderRadius: 16,
                        }}
                      />

                      {item.content ? (
                        <NxText
                          style={{
                            color: isMe
                              ? colors.bubbleSentFg
                              : colors.bubbleRecvFg,
                            fontSize: 15,
                            lineHeight: 20,
                            marginTop: 7,
                          }}
                        >
                          {item.content}
                        </NxText>
                      ) : null}
                    </View>
                  ) : (
                    <NxText
                      style={{
                        color: isMe
                          ? colors.bubbleSentFg
                          : colors.bubbleRecvFg,
                        fontSize: 15,
                        lineHeight: 20,
                      }}
                    >
                      {item.content}
                    </NxText>
                  )}

                  <NxText
                    style={{
                      alignSelf: "flex-end",
                      marginTop: 0,
                      fontSize: 9,
                      opacity: 0.62,
                      color: isMe
                        ? colors.bubbleSentFg
                        : colors.bubbleRecvFg,
                    }}
                  >
                    {dayjs(item.created_at).format("HH:mm")}
                  </NxText>
                </Pressable>

                {item.reactions && item.reactions.length > 0 ? (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 4,
                      marginTop: 4,
                      alignSelf: isMe ? "flex-end" : "flex-start",
                    }}
                  >
                    {Array.from(
                      new Set(item.reactions.map((reaction) => reaction.emoji))
                    ).map((emoji) => {
                      const count = item.reactions!.filter(
                        (reaction) => reaction.emoji === emoji
                      ).length;

                      return (
                        <View
                          key={emoji}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderRadius: 12,
                            backgroundColor: colors.surface,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: colors.border,
                          }}
                        >
                          <NxText style={{ fontSize: 14 }}>{emoji}</NxText>
                          {count > 1 ? (
                            <NxText
                              style={{
                                fontSize: 10,
                                marginLeft: 3,
                                color: colors.mutedFg,
                              }}
                            >
                              {count}
                            </NxText>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </Animated.View>
            </Swipeable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.surface },
              ]}
            >
              <Feather
                name="users"
                size={28}
                color={colors.primary}
              />
            </View>

            <NxText
              variant="titleSm"
              style={{ marginTop: 14 }}
            >
              Start the Circle
            </NxText>

            <NxText
              variant="bodySm"
              style={{
                color: colors.mutedFg,
                textAlign: "center",
                marginTop: 5,
              }}
            >
              Send the first message to everyone here.
            </NxText>
          </View>
        }
      />
      </LinearGradient>

        {replyingTo ? (
          <View
            style={[
              styles.replyComposerPreview,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.replyComposerLine,
                { backgroundColor: colors.primary },
              ]}
            />

            <View style={{ flex: 1 }}>
              <NxText
                numberOfLines={1}
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontFamily: fonts.bodySemi,
                }}
              >
                Replying to{" "}
                {replyingTo.sender_id === user?.user_id
                  ? "yourself"
                  : replyingTo.sender?.display_name || "Member"}
              </NxText>

              <NxText
                numberOfLines={1}
                style={{
                  color: colors.mutedFg,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {replyingTo.content}
              </NxText>
            </View>

            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              style={styles.replyComposerClose}
            >
              <Feather name="x" size={19} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>
        ) : null}

        {pendingMedia && recState !== "recording" ? (
          <View
            style={{
              paddingHorizontal: 12,
              paddingTop: 8,
              backgroundColor: colors.background,
            }}
          >
            <View style={{ alignSelf: "flex-start" }}>
              {pendingMediaKind === "video" ? (
                <CircleVideo uri={pendingMedia!} preview />
              ) : (
                <Image
                  source={{ uri: pendingMedia! }}
                  resizeMode="cover"
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 12,
                  }}
                />
              )}

              <TouchableOpacity
                onPress={() => setPendingMedia(null)}
                activeOpacity={0.7}
                style={{
                  position: "absolute",
                  top: -7,
                  right: -7,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.foreground,
                }}
              >
                <Feather
                  name="x"
                  size={15}
                  color={colors.background}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            {
              backgroundColor:
                (circle?.theme || "default") === "default"
                  ? colors.background
                  : "rgba(0,0,0,0.22)",
              borderTopColor:
                (circle?.theme || "default") === "default"
                  ? colors.border
                  : "rgba(255,255,255,0.18)",
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowAttachMenu(true)}
            activeOpacity={0.7}
            style={[
              styles.roundBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather
              name="plus"
              size={21}
              color={colors.foreground}
            />
          </TouchableOpacity>

          {recState !== "recording" ? (
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
              value={text}
              onChangeText={setText}
              placeholder="Message Circle"
              placeholderTextColor={colors.mutedFg}
              multiline
              style={[
                styles.input,
                { color: colors.foreground },
              ]}
            />

            <TouchableOpacity
              activeOpacity={0.65}
              onPress={() => {
                if (showEmojiPicker) {
                  setShowEmojiPicker(false);
                  setTimeout(() => inputRef.current?.focus(), 50);
                } else {
                  Keyboard.dismiss();
                  inputRef.current?.blur();
                  setTimeout(() => setShowEmojiPicker(true), 80);
                }
              }}
              style={{
                width: 30,
                height: 30,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather
                name="smile"
                size={20}
                color={colors.mutedFg}
              />
            </TouchableOpacity>
          </View>
          ) : null}

          {recState === "recording" ? (
            <>
              <TouchableOpacity
                onPress={recCancel}
                activeOpacity={0.7}
                style={styles.voiceCancelBtn}
              >
                <Feather name="x" size={20} color={colors.danger} />
              </TouchableOpacity>

              <View
                style={styles.voiceTimer}
                {...micPanResponder.panHandlers}
              >
                <View
                  style={[
                    styles.voiceRecordingDot,
                    { backgroundColor: colors.danger },
                  ]}
                />
                <NxText
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontFamily: fonts.bodySemi,
                  }}
                >
                  {`${Math.floor(recElapsed / 60000)}:${String(
                    Math.floor((recElapsed % 60000) / 1000)
                  ).padStart(2, "0")}`}
                </NxText>

                <NxText
                  numberOfLines={1}
                  style={{
                    color: colors.mutedFg,
                    fontSize: 11,
                    marginLeft: 8,
                  }}
                >
                  ← Slide to cancel
                </NxText>
              </View>

              <TouchableOpacity
                disabled={sending}
                onPress={handleMicRelease}
                activeOpacity={0.72}
                style={[
                  styles.sendBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                {sending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.onPrimary}
                  />
                ) : (
                  <Feather
                    name="send"
                    size={17}
                    color={colors.onPrimary}
                  />
                )}
              </TouchableOpacity>
            </>
          ) : text.trim() || pendingMedia || editingMessage ? (
            <TouchableOpacity
              disabled={sending}
              onPress={sendMessage}
              activeOpacity={0.72}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
              ]}
            >
              {sending ? (
                <ActivityIndicator
                  size="small"
                  color={colors.onPrimary}
                />
              ) : (
                <Feather
                  name="send"
                  size={17}
                  color={colors.onPrimary}
                />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              disabled={sending}
              onPress={handleMicPress}
              activeOpacity={0.72}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
              ]}
            >
              <Feather
                name="mic"
                size={18}
                color={colors.onPrimary}
              />
            </TouchableOpacity>
          )}
        </View>

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
              setText((current) => current + emoji.emoji);
            }}
            enableSearchBar
            enableRecentlyUsed
            hideHeader
          />
        </View>
      ) : null}
      </KeyboardAvoidingView>

      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <Pressable
          style={[
            styles.messageActionOverlay,
            { backgroundColor: colors.overlay },
          ]}
          onPress={() => setShowAttachMenu(false)}
        >
          <Pressable
            style={[
              styles.attachSheet,
              {
                backgroundColor: colors.backgroundElevated,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <TouchableOpacity
              style={styles.attachOption}
              onPress={() => pickMedia("image")}
            >
              <View
                style={[
                  styles.attachIcon,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Feather name="image" size={22} color={colors.primary} />
              </View>
              <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>
                Photo
              </NxText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOption}
              onPress={() => pickMedia("video")}
            >
              <View
                style={[
                  styles.attachIcon,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Feather name="video" size={22} color={colors.primary} />
              </View>
              <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>
                Video
              </NxText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable
          style={[styles.messageActionOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setSelectedMessage(null)}
        >
          <Pressable
            style={[
              styles.messageActionSheet,
              {
                backgroundColor: colors.backgroundElevated,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.reactionRow}>
              {["❤️", "👍", "😂", "😮", "😢", "🔥"].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  activeOpacity={0.65}
                  onPress={() =>
                    selectedMessage &&
                    reactToMessage(selectedMessage, emoji)
                  }
                  style={styles.reactionBtn}
                >
                  <NxText style={styles.reactionEmoji}>{emoji}</NxText>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                activeOpacity={0.65}
                onPress={() => {
                  setReactionTarget(selectedMessage);
                  setSelectedMessage(null);
                  setShowAllReactionEmojis(true);
                }}
                style={styles.reactionBtn}
              >
                <Feather name="plus" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.messageActionDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.messageActionRow}
              onPress={() => selectedMessage && startReply(selectedMessage)}
            >
              <Feather name="corner-up-left" size={20} color={colors.foreground} />
              <NxText style={[styles.messageActionText, { color: colors.foreground }]}>
                Reply
              </NxText>
            </TouchableOpacity>

            {selectedMessage?.sender_id === user?.user_id ? (
              <>
                <TouchableOpacity
                  style={styles.messageActionRow}
                  onPress={() => selectedMessage && startEdit(selectedMessage)}
                >
                  <Feather name="edit-3" size={20} color={colors.foreground} />
                  <NxText style={[styles.messageActionText, { color: colors.foreground }]}>
                    Edit
                  </NxText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.messageActionRow}
                  onPress={() => selectedMessage && deleteMessage(selectedMessage)}
                >
                  <Feather name="trash-2" size={20} color={colors.danger} />
                  <NxText style={[styles.messageActionText, { color: colors.danger }]}>
                    Delete
                  </NxText>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAllReactionEmojis}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllReactionEmojis(false)}
      >
        <Pressable
          style={[
            styles.messageActionOverlay,
            { backgroundColor: colors.overlay },
          ]}
          onPress={() => setShowAllReactionEmojis(false)}
        >
          <Pressable
            style={{
              height: 420,
              marginTop: "auto",
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
            onPress={() => {}}
          >
            <EmojiKeyboard
              onEmojiSelected={(emoji) => {
                if (reactionTarget) {
                  reactToMessage(reactionTarget, emoji.emoji);
                }
                setReactionTarget(null);
                setShowAllReactionEmojis(false);
              }}
              enableSearchBar
              enableRecentlyUsed
              hideHeader
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showCircleMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCircleMenu(false)}
      >
        <Pressable
          style={[styles.menuOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setShowCircleMenu(false)}
        >
          <Animated.View
            entering={FadeInDown.duration(280).springify().damping(20)}
            style={[
              styles.menuSheet,
              {
                backgroundColor: colors.backgroundElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <Pressable onPress={() => {}}>
              <View
                style={[
                  styles.sheetHandle,
                  { backgroundColor: colors.borderStrong },
                ]}
              />

              <View style={styles.sheetHero}>
                <View
                  style={[
                    styles.sheetAvatarRing,
                    { borderColor: colors.primary },
                  ]}
                >
                  <Avatar
                    uri={circle?.photo || undefined}
                    name={circle?.name || "Circle"}
                    size={52}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <NxText
                    numberOfLines={1}
                    style={{
                      color: colors.foreground,
                      fontSize: 18,
                      fontFamily: fonts.bodySemi,
                    }}
                  >
                    {circle?.name || "Circle"}
                  </NxText>

                  <NxText
                    style={{
                      color: colors.mutedFg,
                      fontSize: 12,
                      marginTop: 3,
                    }}
                  >
                    {circle?.member_count || 0} members ·{" "}
                    {circle?.privacy === "private" ? "Private" : "Public"}
                  </NxText>
                </View>
              </View>

              <View style={styles.quickActions}>
                {[
                  ["info", "Info"],
                  ["users", "Members"],
                  ["user-plus", "Invite"],
                  ["link", "Link"],
                ].map(([icon, label]) => (
                  <TouchableOpacity
                    key={label}
                    activeOpacity={0.72}
                    onPress={() => {
                      if (label === "Info") {
                        setShowCircleMenu(false);
                        router.push({
                          pathname: "/circles/[id]/info",
                          params: { id },
                        });
                      }

                      if (label === "Members") {
                        setShowCircleMenu(false);
                        router.push({
                          pathname: "/circles/[id]/members",
                          params: { id },
                        });
                      }

                      if (label === "Invite") {
                        setShowCircleMenu(false);
                        router.push({
                          pathname: "/circles/[id]/invite",
                          params: { id },
                        });
                      }

                      if (label === "Link") {
                        setShowCircleMenu(false);
                        Share.share({
                          message: `Join ${circle?.name || "this Circle"} on XYTEEE Nexus\nhttps://xyteee.com/circles/${id}`,
                        });
                      }
                    }}
                    style={styles.quickAction}
                  >
                    <View
                      style={[
                        styles.quickActionIcon,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name={icon as any}
                        size={19}
                        color={colors.primary}
                      />
                    </View>
                    <NxText
                      style={{
                        color: colors.foreground,
                        fontSize: 11,
                        marginTop: 7,
                        fontFamily: fonts.bodySemi,
                      }}
                    >
                      {label}
                    </NxText>
                  </TouchableOpacity>
                ))}
              </View>

              <View
                style={[
                  styles.menuCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => {
                    setShowCircleMenu(false);
                    setShowThemePicker(true);
                  }}
                >
                  <Feather name="droplet" size={19} color={colors.primary} />
                  <NxText style={[styles.menuRowText, { color: colors.foreground }]}>
                    Theme
                  </NxText>
                  <Feather name="chevron-right" size={18} color={colors.mutedFg} />
                </TouchableOpacity>

                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => {
                    setShowCircleMenu(false);
                    router.push({
                      pathname: "/circles/[id]/media",
                      params: { id },
                    });
                  }}
                >
                  <Feather name="image" size={19} color={colors.primary} />
                  <NxText style={[styles.menuRowText, { color: colors.foreground }]}>
                    Shared media
                  </NxText>
                  <Feather name="chevron-right" size={18} color={colors.mutedFg} />
                </TouchableOpacity>

                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                <TouchableOpacity style={styles.menuRow}>
                  <Feather name="bell" size={19} color={colors.primary} />
                  <NxText style={[styles.menuRowText, { color: colors.foreground }]}>
                    Notifications
                  </NxText>
                  <Feather name="chevron-right" size={18} color={colors.mutedFg} />
                </TouchableOpacity>

                {circle?.my_role === "owner" || circle?.my_role === "admin" ? (
                  <>
                    <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity style={styles.menuRow}>
                      <Feather name="shield" size={19} color={colors.primary} />
                      <NxText style={[styles.menuRowText, { color: colors.foreground }]}>
                        Admin controls
                      </NxText>
                      <Feather name="chevron-right" size={18} color={colors.mutedFg} />
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        visible={showThemePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <Pressable
          style={[styles.messageActionOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setShowThemePicker(false)}
        >
          <Pressable
            style={[
              styles.themeSheet,
              {
                backgroundColor: colors.backgroundElevated,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.themeHeader}>
              <View>
                <NxText style={[styles.themeTitle, { color: colors.foreground }]}>
                  Circle Theme
                </NxText>
                <NxText style={{ color: colors.mutedFg, fontSize: 12, marginTop: 3 }}>
                  Everyone in this Circle will see it
                </NxText>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowThemePicker(false)}
                style={[
                  styles.themeCloseBtn,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.themeGrid}>
              {CIRCLE_THEMES.map((theme) => {
                const active = (circle?.theme || "classic") === theme.id;

                return (
                  <TouchableOpacity
                    key={theme.id}
                    activeOpacity={0.78}
                    disabled={themeBusy}
                    onPress={() => changeCircleTheme(theme.id)}
                    style={[
                      styles.themeOption,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={theme.colors as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.themePreview}
                    >
                      {active ? (
                        <View style={styles.themeCheck}>
                          <Feather name="check" size={15} color="#fff" />
                        </View>
                      ) : null}
                    </LinearGradient>

                    <NxText
                      numberOfLines={1}
                      style={[
                        styles.themeName,
                        {
                          color: active
                            ? colors.primary
                            : colors.foreground,
                        },
                      ]}
                    >
                      {theme.name}
                    </NxText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {themeBusy ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginTop: 14 }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  circleAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 9,
    overflow: "hidden",
  },
  headerInfo: {
    flex: 1,
    marginLeft: 11,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  metaChip: {
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 18,
  },
  emptyList: {
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 7,
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
  messageWrap: {
    maxWidth: "74%",
  },
  bubble: {
    paddingHorizontal: 9,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 17,
  },
  replyInsideBubble: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 6,
    minWidth: 150,
  },
  replyComposerPreview: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyComposerLine: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: 10,
  },
  replyComposerClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  textField: {
    flex: 1,
    minHeight: 38,
    maxHeight: 108,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    minHeight: 24,
    maxHeight: 96,
    padding: 0,
    marginRight: 8,
  },
  voiceCancelBtn: {
    width: 34,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceTimer: {
    flex: 1,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  voiceRecordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  messageActionOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  messageActionSheet: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: 8,
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  reactionBtn: {
    width: 46,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: {
    fontSize: 25,
    lineHeight: 36,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  messageActionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  messageActionRow: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  messageActionText: {
    marginLeft: 15,
    fontSize: 15,
    fontFamily: fonts.bodySemi,
  },
  attachSheet: {
    position: "absolute",
    left: 14,
    bottom: 72,
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  attachOption: {
    width: 72,
    alignItems: "center",
    gap: 7,
  },
  attachIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  menuOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  menuSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHero: {
    flexDirection: "row",
    alignItems: "center",
  },
  sheetAvatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 20,
  },
  quickAction: {
    width: "23%",
    alignItems: "center",
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  menuRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  menuRowText: {
    flex: 1,
    marginLeft: 13,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
  themeSheet: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  themeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  themeTitle: {
    fontSize: 19,
    fontFamily: fonts.bodySemi,
  },
  themeCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  themeOption: {
    width: "31%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 5,
  },
  themePreview: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  themeCheck: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeName: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 2,
    fontFamily: fonts.bodySemi,
  },
});
