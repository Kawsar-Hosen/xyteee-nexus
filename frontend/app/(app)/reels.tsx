import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Share,
  Text,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import { MediaPicker, type MediaTab } from "@/src/components/MediaPicker";
import { klipyMedia, klipyStickerMedia, type KlipyGif } from "@/src/api/klipy";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { uploadFile } from "@/src/api/upload";
import {
  reelsFeed,
  userReels,
  likeReel,
  unlikeReel,
  viewReel,
  addReelComment,
  getReelComments,
  deleteReelComment,
  createReel,
  deleteReel,
  type Reel,
  type ReelComment,
} from "@/src/api/reels";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, spacing, radii } from "@/src/theme";
import { DOCK_PAD } from "@/src/theme/layout";

dayjs.extend(relativeTime);

const { height: WINDOW_H } = Dimensions.get("window");

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function formatTime(iso: string): string {
  return dayjs(iso).fromNow();
}

export default function Reels() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ mine?: string }>();
  const { subscribe } = useWs();
  const { width, height } = useWindowDimensions();
  const mineMode = params.mine === "1";

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsFor, setCommentsFor] = useState<Reel | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [shareFor, setShareFor] = useState<Reel | null>(null);

  const pageRef = useRef(0);
  const listRef = useRef<FlatList<Reel>>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  const activeReel = reels[activeIndex];
  const myStats = mineMode
    ? {
        uploads: reels.length,
        views: reels.reduce((sum, reel) => sum + reel.view_count, 0),
        likes: reels.reduce((sum, reel) => sum + reel.like_count, 0),
      }
    : null;

  const load = useCallback(
    async (refresh: boolean) => {
      if (!token) return;
      if (mineMode) {
        if (!user?.user_id) return;
        if (refresh) setRefreshing(true);
        else setLoadingMore(true);
        try {
          const r = await userReels(token, user.user_id);
          setReels(r.reels || []);
          setHasMore(false);
          pageRef.current = 0;
        } catch (e: any) {
          console.warn("[reels] load mine failed:", e?.message || e);
        } finally {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
        return;
      }
      if (refresh) {
        setRefreshing(true);
        pageRef.current = 0;
      } else {
        setLoadingMore(true);
      }
      try {
        const r = await reelsFeed(token, 10, pageRef.current);
        const items = r.reels || [];
        setReels((prev) => (refresh ? items : [...prev, ...items]));
        setHasMore(r.has_more);
        pageRef.current += 1;
      } catch (e: any) {
        console.warn("[reels] load failed:", e?.message || e);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [mineMode, token, user?.user_id]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  // Realtime: new likes & comments on the currently visible reel.
  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "reel_like" && e.user_id !== user?.user_id) {
        setReels((prev) =>
          prev.map((r) =>
            r.reel_id === e.reel_id
              ? { ...r, like_count: r.like_count + 1 }
              : r
          )
        );
      }
      if (e.type === "reel_comment") {
        setReels((prev) =>
          prev.map((r) =>
            r.reel_id === e.reel_id
              ? { ...r, comment_count: r.comment_count + 1 }
              : r
          )
        );
      }
      if (e.type === "reel_new" && e.user_id !== user?.user_id) {
        load(true);
      }
    });
  }, [subscribe, user?.user_id, load]);

  // Record a view once per reel.
  useEffect(() => {
    if (!token || !activeReel) return;
    if (viewedRef.current.has(activeReel.reel_id)) return;
    viewedRef.current.add(activeReel.reel_id);
    viewReel(token, activeReel.reel_id).catch(() => {});
  }, [token, activeReel]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) {
      const idx = viewableItems[0]?.index;
      if (typeof idx === "number") setActiveIndex(idx);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const toggleLike = useCallback(
    async (reel: Reel) => {
      if (!token) return;
      const next = !reel.is_liked;
      setReels((prev) =>
        prev.map((r) =>
          r.reel_id === reel.reel_id
            ? { ...r, is_liked: next, like_count: r.like_count + (next ? 1 : -1) }
            : r
        )
      );
      try {
        if (next) await likeReel(token, reel.reel_id);
        else await unlikeReel(token, reel.reel_id);
      } catch (e: any) {
        console.warn("[reels] like failed:", e?.message || e);
      }
    },
    [token]
  );

  const handleDelete = useCallback(
    async (reel: Reel) => {
      if (!token || !reel.is_mine) return;
      try {
        await deleteReel(token, reel.reel_id);
        setReels((prev) => prev.filter((r) => r.reel_id !== reel.reel_id));
      } catch (e: any) {
        console.warn("[reels] delete failed:", e?.message || e);
      }
    },
    [token]
  );

  const shareReel = useCallback((reel: Reel) => {
    setShareFor(reel);
  }, []);

  const onUploadDone = useCallback(
    (created: Reel) => {
      setReels((prev) => [created, ...prev]);
      setShowUpload(false);
      if (listRef.current) listRef.current.scrollToOffset({ offset: 0, animated: true });
    },
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Reel; index: number }) => (
      <ReelCard
        reel={item}
        active={index === activeIndex}
        height={height}
        width={width}
        onLike={() => toggleLike(item)}
        onComment={() => setCommentsFor(item)}
        onShare={() => shareReel(item)}
        onProfile={() =>
          router.push(
            item.is_mine ? "/(app)/profile" : `/user/${item.author?.username || item.user_id}`
          )
        }
        onDelete={() => handleDelete(item)}
      />
    ),
    [activeIndex, height, width, toggleLike, shareReel, handleDelete, router]
  );

  const emptyState = loading ? null : (
    <View style={styles.empty}>
      <MaterialCommunityIcons name="movie-play-outline" size={44} color="#8B8D98" />
      <NxText variant="titleSm" style={{ color: "#F1EFE7", marginTop: 12 }}>
        No reels yet
      </NxText>
      <NxText variant="bodySm" style={{ color: "#8B8D98", textAlign: "center", marginTop: 6 }}>
        Record your first moment or pull one from your gallery.
      </NxText>
      <TouchableOpacity
        style={styles.emptyCta}
        onPress={() => setShowUpload(true)}
      >
        <NxText style={{ fontFamily: fonts.bodySemi, color: "#070709" }}>Create a Reel</NxText>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <FlatList
        ref={listRef}
        data={reels}
        renderItem={renderItem}
        keyExtractor={(r) => r.reel_id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!mineMode && hasMore && !loadingMore) load(false);
        }}
        ListEmptyComponent={emptyState}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        style={{ flex: 1 }}
      />
      {loadingMore ? (
        <View pointerEvents="none" style={styles.loadingMoreOverlay}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}

      {/* Top bar */}
      <View style={styles.topBar}>
        <NxText style={[styles.topTitle, { fontFamily: fonts.bodySemi }]}>{mineMode ? "My Reels" : "Reels"}</NxText>
        <TouchableOpacity testID="reels-upload" onPress={() => setShowUpload(true)} style={styles.camBtn} hitSlop={8}>
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {myStats ? (
        <View pointerEvents="none" style={styles.myStatsBar}>
          <View style={styles.myStatsPill}>
            <NxText style={styles.myStatsValue}>{formatCount(myStats.uploads)}</NxText>
            <NxText style={styles.myStatsLabel}>uploads</NxText>
          </View>
          <View style={styles.myStatsPill}>
            <NxText style={styles.myStatsValue}>{formatCount(myStats.views)}</NxText>
            <NxText style={styles.myStatsLabel}>views</NxText>
          </View>
          <View style={styles.myStatsPill}>
            <NxText style={styles.myStatsValue}>{formatCount(myStats.likes)}</NxText>
            <NxText style={styles.myStatsLabel}>likes</NxText>
          </View>
        </View>
      ) : null}

      <UploadSheet
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        onDone={onUploadDone}
      />

      <ShareSheet
        reel={shareFor}
        onClose={() => setShareFor(null)}
      />

      <CommentsSheet
        reel={commentsFor}
        onClose={() => setCommentsFor(null)}
      />
    </View>
  );
}

function ReelCard({
  reel,
  active,
  height,
  width,
  onLike,
  onComment,
  onShare,
  onProfile,
  onDelete,
}: {
  reel: Reel;
  active: boolean;
  height: number;
  width: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onProfile: () => void;
  onDelete: () => void;
}) {
  const heartScale = useSharedValue(0);
  const lastTapRef = useRef(0);

  const player = useVideoPlayer(active ? reel.video_url : null, (p) => {
    p.loop = true;
    p.muted = false;
    p.volume = 1;
    p.play();
  });

  useEffect(() => {
    if (active) {
      try {
        player.play();
      } catch {}
    } else {
      try {
        player.pause();
      } catch {}
    }
  }, [active, player]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value > 0 ? 1 : 0,
  }));

  const burstHeart = () => {
    heartScale.value = 0;
    heartScale.value = withSequence(
      withSpring(1.25, { damping: 12 }),
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 180 })
    );
    if (!reel.is_liked) onLike();
  };

  const handleDisplayTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      burstHeart();
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <View style={{ height, width }}>
      {active ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : null}
      {!active && reel.thumbnail_url ? (
        <ExpoImage
          source={{ uri: reel.thumbnail_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          pointerEvents="none"
        />
      ) : null}

      {/* TikTok-style double tap: like with a visible heart burst. */}
      <View style={StyleSheet.absoluteFill}>
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={handleDisplayTap}
          onLongPress={() => {}}
          delayLongPress={9999}
        />
      </View>

      {/* Double-tap heart */}
      <Animated.View style={[styles.heartBurst, heartStyle]} pointerEvents="none">
        <MaterialCommunityIcons name="heart" size={64} color="#FF2D55" />
      </Animated.View>

      {/* Bottom gradient + info */}
      <View style={styles.bottomWrap} pointerEvents="box-none">
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.48)"]}
          locations={[0, 0.48, 1]}
          style={styles.gradient}
        />
        <View style={styles.bottomRow}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <TouchableOpacity onPress={onProfile} style={styles.authorRow}>
              <Avatar
                uri={reel.author?.profile_picture}
                size={34}
                name={reel.author?.display_name || reel.author?.username || "?"}
              />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <NxText style={{ color: "#FFFFFF", fontFamily: fonts.bodySemi, fontSize: 15 }}>
                    @{reel.author?.username || "xyteee"}
                  </NxText>
                  {reel.author?.badge_type ? <VerifiedBadge size={14} badgeType={reel.author.badge_type} /> : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <Feather name="eye" size={11} color="rgba(255,255,255,0.7)" />
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginLeft: 4 }}>
                    {formatCount(reel.view_count)} views
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginLeft: 8 }}>
                    {formatTime(reel.created_at)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            {reel.caption ? (
              <NxText
                style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 20, marginTop: 10 }}
                numberOfLines={2}
              >
                {reel.caption}
              </NxText>
            ) : null}
            <TouchableOpacity style={styles.musicRow} onPress={onShare}>
              <MaterialCommunityIcons name="music" size={14} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 12, marginLeft: 6 }} numberOfLines={1}>
                original sound — {reel.author?.display_name || reel.author?.username || "xyteee"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action rail */}
          <View style={styles.actionRail}>
            <TouchableOpacity onPress={onProfile} style={[styles.railItem, styles.profileRailItem]}>
              <View style={styles.avatarRing}>
                <Avatar
                  uri={reel.author?.profile_picture}
                  size={44}
                  name={reel.author?.display_name || reel.author?.username || "?"}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onLike}
              style={styles.railItem}
              testID="reel-like"
            >
              <MaterialCommunityIcons
                name={reel.is_liked ? "heart" : "heart-outline"}
                size={34}
                color={reel.is_liked ? "#FF2D55" : "#FFFFFF"}
              />
              <Text style={styles.railLabel}>{formatCount(reel.like_count)}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onComment} style={styles.railItem} testID="reel-comment">
              <MaterialCommunityIcons name="comment-text-outline" size={32} color="#FFFFFF" />
              <Text style={styles.railLabel}>{formatCount(reel.comment_count)}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onShare} style={styles.railItem} testID="reel-share">
              <Feather name="send" size={28} color="#FFFFFF" />
              <Text style={styles.railLabel}>Share</Text>
            </TouchableOpacity>

            {reel.is_mine ? (
              <TouchableOpacity onPress={onDelete} style={styles.railItem} testID="reel-delete">
                <MaterialCommunityIcons name="delete-outline" size={30} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function UploadSheet({
  visible,
  onClose,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (reel: Reel) => void;
}) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const videoPlayer = useVideoPlayer(videoUri ? videoUri : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 90,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    setVideoUri(asset.uri);
    setMime(asset.mimeType);
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 90,
      allowsEditing: true,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    setVideoUri(asset.uri);
    setMime(asset.mimeType);
  };

  const publish = async () => {
    if (!token || !videoUri || busy) return;
    setBusy(true);
    setProgress("Uploading to R2…");
    try {
      const url = await uploadFile(videoUri, "reels", token, undefined, mime);
      setProgress("Publishing…");
      const created = await createReel(token, {
        video_url: url,
        caption: caption.trim(),
        visibility,
      });
      onDone(created);
    } catch (e: any) {
      setProgress(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setVideoUri(null);
      setMime(undefined);
      setCaption("");
      setVisibility("public");
      setProgress("");
      setBusy(false);
    }
  }, [visible]);

  const visOptions: { key: typeof visibility; label: string; icon: any }[] = [
    { key: "public", label: "Everyone", icon: "globe" },
    { key: "friends", label: "Bonds", icon: "heart" },
    { key: "private", label: "Only me", icon: "lock" },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.sheetRoot, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="upload-backdrop" />
          <View style={[styles.uploadSheet, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <NxText variant="titleSm">New Reel</NxText>
              <TouchableOpacity onPress={onClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.surfaceHigh }]}>
                <Feather name="x" size={18} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>

            {!videoUri ? (
              <View style={styles.sourceRow}>
                <TouchableOpacity
                  testID="upload-record"
                  onPress={recordVideo}
                  disabled={busy}
                  style={[styles.sourceCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <View style={[styles.sourceIcon, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name="video-outline" size={26} color={colors.onPrimary} />
                  </View>
                  <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, marginTop: 10 }}>
                    Record
                  </NxText>
                  <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>
                    Use camera
                  </NxText>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="upload-pick"
                  onPress={pickVideo}
                  disabled={busy}
                  style={[styles.sourceCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <View style={[styles.sourceIcon, { backgroundColor: colors.surfaceHigh }]}>
                    <Feather name="image" size={24} color={colors.primary} />
                  </View>
                  <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, marginTop: 10 }}>
                    Gallery
                  </NxText>
                  <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>
                    Up to 90s
                  </NxText>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[styles.videoPreview, { borderColor: colors.border }]}>
                  <VideoView
                    player={videoPlayer}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                  />
                  <TouchableOpacity
                    onPress={pickVideo}
                    style={styles.repickBtn}
                    hitSlop={6}
                  >
                    <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption…"
                  placeholderTextColor={colors.mutedFg}
                  maxLength={300}
                  multiline
                  style={[styles.captionInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />

                <View style={styles.visRow}>
                  {visOptions.map((o) => {
                    const active = visibility === o.key;
                    return (
                      <TouchableOpacity
                        key={o.key}
                        onPress={() => setVisibility(o.key)}
                        style={[
                          styles.visChip,
                          {
                            backgroundColor: active ? colors.primary : colors.surfaceHigh,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Feather name={o.icon} size={14} color={active ? colors.onPrimary : colors.mutedFg} />
                        <NxText
                          style={{
                            fontSize: 12,
                            fontFamily: fonts.bodySemi,
                            color: active ? colors.onPrimary : colors.mutedFg,
                            marginLeft: 6,
                          }}
                        >
                          {o.label}
                        </NxText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {progress ? (
                  <NxText variant="caption" style={{ color: colors.primary, textAlign: "center", marginTop: 8 }}>
                    {progress}
                  </NxText>
                ) : null}

                <TouchableOpacity
                  testID="upload-publish"
                  onPress={publish}
                  disabled={busy}
                  style={[styles.publishBtn, { backgroundColor: busy ? colors.surfaceHigh : colors.primary }]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 15 }}>
                      Publish
                    </NxText>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ShareFriend = {
  user_id: string;
  username?: string;
  display_name?: string;
  profile_picture?: string;
};

function ShareSheet({
  reel,
  onClose,
}: {
  reel: Reel | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [friends, setFriends] = useState<ShareFriend[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});

  const open = !!reel;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSentTo({});
      setSendingTo(null);
      return;
    }
    if (!token) return;
    let alive = true;
    setLoading(true);
    api<{ friends: ShareFriend[] }>("/friends", { token })
      .then((r) => {
        if (alive) setFriends(r.friends || []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, token]);

  const filtered = query.trim()
    ? friends.filter((f) => {
        const q = query.trim().toLowerCase();
        return (
          (f.username || "").toLowerCase().includes(q) ||
          (f.display_name || "").toLowerCase().includes(q)
        );
      })
    : friends;

  const sendToFriend = async (friend: ShareFriend) => {
    if (!token || !reel || sendingTo || sentTo[friend.user_id]) return;
    setSendingTo(friend.user_id);
    try {
      const r = await api<{ conversation: { conversation_id: string } }>("/chats/open", {
        method: "POST",
        body: { user_id: friend.user_id },
        token,
      });
      const conversation_id = r.conversation.conversation_id;
      await api("/chats/message", {
        method: "POST",
        body: {
          conversation_id,
          kind: "video",
          media: reel.video_url,
          content: reel.caption?.trim()
            ? reel.caption.trim()
            : `Reel by @${reel.author?.username || "xyteee"}`,
        },
        token,
      });
      setSentTo((prev) => ({ ...prev, [friend.user_id]: true }));
    } catch (e: any) {
      console.warn("[reels] share to chat failed:", e?.message || e);
    } finally {
      setSendingTo(null);
    }
  };

  const systemShare = () => {
    if (!reel) return;
    const msg = `${reel.caption || "Check out this reel"} — @${reel.author?.username || "xyteee"}\n${reel.video_url}`;
    try {
      Share.share({ message: msg });
    } catch {
      // no-op on unsupported platforms
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.sheetRoot, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="share-backdrop" />
        <View style={[styles.uploadSheet, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
          <View style={styles.sheetHeader}>
            <NxText variant="titleSm">Share to</NxText>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.surfaceHigh }]}>
              <Feather name="x" size={18} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>

          <View style={[styles.shareSearch, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedFg} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search friends…"
              placeholderTextColor={colors.mutedFg}
              style={{ flex: 1, marginLeft: 8, color: colors.foreground, fontFamily: fonts.body, fontSize: 14, paddingVertical: 0 }}
            />
          </View>

          {loading ? (
            <View style={{ paddingVertical: 30, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ paddingVertical: 26, alignItems: "center" }}>
              <NxText variant="bodySm" style={{ color: colors.mutedFg }}>
                {friends.length === 0 ? "No friends to share with yet." : "No matches."}
              </NxText>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(f) => f.user_id}
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const sent = sentTo[item.user_id];
                const busy = sendingTo === item.user_id;
                return (
                  <TouchableOpacity
                    testID={`share-friend-${item.user_id}`}
                    onPress={() => sendToFriend(item)}
                    disabled={busy || sent}
                    style={styles.shareRow}
                  >
                    <Avatar
                      uri={item.profile_picture}
                      size={42}
                      name={item.display_name || item.username || "?"}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, fontSize: 15 }}>
                        {item.display_name || item.username || "User"}
                      </NxText>
                      {item.username ? (
                        <NxText variant="caption" style={{ color: colors.mutedFg }}>
                          @{item.username}
                        </NxText>
                      ) : null}
                    </View>
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : sent ? (
                      <View style={[styles.shareSentPill, { backgroundColor: colors.primary }]}>
                        <Feather name="check" size={13} color={colors.onPrimary} />
                        <NxText style={{ color: colors.onPrimary, fontSize: 12, fontFamily: fonts.bodySemi, marginLeft: 4 }}>
                          Sent
                        </NxText>
                      </View>
                    ) : (
                      <View style={[styles.shareSendPill, { borderColor: colors.primary }]}>
                        <NxText style={{ color: colors.primary, fontSize: 12, fontFamily: fonts.bodySemi }}>
                          Send
                        </NxText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            testID="share-system"
            onPress={systemShare}
            style={[styles.shareSystemBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Feather name="share-2" size={18} color={colors.foreground} />
            <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, marginLeft: 10 }}>
              Share via…
            </NxText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CommentsSheet({
  reel,
  onClose,
}: {
  reel: Reel | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const { subscribe } = useWs();
  const { height } = useWindowDimensions();
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReelComment | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const reelId = reel?.reel_id;

  const loadComments = useCallback(async () => {
    if (!token || !reelId) return;
    setLoading(true);
    try {
      const r = await getReelComments(token, reelId);
      setComments(r.comments || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [token, reelId]);

  useEffect(() => {
    if (reelId) {
      setComments([]);
      setText("");
      setReplyingTo(null);
      setShowMediaPicker(false);
      loadComments();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [reelId, loadComments]);

  useEffect(() => {
    if (!reelId) return;
    return subscribe((e) => {
      if (e.type === "reel_comment" && e.reel_id === reelId) {
        setComments((prev) => [...prev, e.comment]);
      }
    });
  }, [subscribe, reelId]);

  const send = async () => {
    const content = text.trim();
    if (!token || !reelId || !content || sending) return;
    setSending(true);
    try {
      const created = await addReelComment(token, reelId, {
        content,
        kind: "text",
        parent_comment_id: replyingTo?.comment_id || null,
      });
      setComments((prev) => [...prev, created]);
      setText("");
      setReplyingTo(null);
    } catch (e: any) {
      console.warn("[reels] comment failed:", e?.message || e);
    } finally {
      setSending(false);
    }
  };

  const sendMediaComment = async (item: KlipyGif, tab: MediaTab) => {
    if (!token || !reelId || sending) return;
    const media = tab === "sticker" ? klipyStickerMedia(item) : klipyMedia(item);
    if (!media) return;
    setSending(true);
    try {
      const created = await addReelComment(token, reelId, {
        kind: tab,
        media: media.url,
        content: JSON.stringify({ title: item.title, w: media.width, h: media.height }),
        parent_comment_id: replyingTo?.comment_id || null,
      });
      setComments((prev) => [...prev, created]);
      setReplyingTo(null);
      setShowMediaPicker(false);
    } catch (e: any) {
      console.warn("[reels] media comment failed:", e?.message || e);
    } finally {
      setSending(false);
    }
  };

  const remove = async (commentId: string) => {
    if (!token || !reelId) return;
    try {
      await deleteReelComment(token, reelId, commentId);
      setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
    } catch {}
  };

  const repliesByParent = comments.reduce<Record<string, ReelComment[]>>((acc, comment) => {
    if (!comment.parent_comment_id) return acc;
    if (!acc[comment.parent_comment_id]) acc[comment.parent_comment_id] = [];
    acc[comment.parent_comment_id].push(comment);
    return acc;
  }, {});
  const topLevelComments = comments.filter((comment) => !comment.parent_comment_id);

  const renderComment = (item: ReelComment, isReply = false) => {
    const kind = item.kind || "text";
    const replies = repliesByParent[item.comment_id] || [];
    return (
      <View key={item.comment_id} style={isReply ? styles.replyWrap : undefined}>
        <View style={styles.commentRow}>
          <Avatar
            uri={item.user?.profile_picture}
            size={isReply ? 28 : 34}
            name={item.user?.display_name || item.user?.username || "?"}
          />
          <View style={[styles.commentBubble, { backgroundColor: colors.surface }]}> 
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <NxText style={{ fontSize: 12.5, fontFamily: fonts.bodySemi, color: colors.foreground }}>
                @{item.user?.username || "xyteee"}
              </NxText>
              {item.user?.badge_type ? <VerifiedBadge size={11} badgeType={item.user.badge_type} /> : null}
              <Text style={{ fontSize: 10.5, color: colors.mutedFg, marginLeft: 2 }}>
                {dayjs(item.created_at).format("MMM D")}
              </Text>
            </View>
            {kind === "gif" || kind === "sticker" ? (
              <ExpoImage
                source={{ uri: item.media }}
                style={kind === "sticker" ? styles.commentSticker : styles.commentGif}
                contentFit="contain"
              />
            ) : (
              <NxText style={{ fontSize: 14, color: colors.foreground, marginTop: 3, lineHeight: 19 }}>
                {item.content}
              </NxText>
            )}
            <TouchableOpacity
              onPress={() => {
                setReplyingTo(item);
                setTimeout(() => inputRef.current?.focus(), 80);
              }}
              style={{ alignSelf: "flex-start", marginTop: 7 }}
            >
              <NxText style={{ color: colors.mutedFg, fontSize: 12, fontFamily: fonts.bodySemi }}>Reply</NxText>
            </TouchableOpacity>
          </View>
          {item.is_mine ? (
            <TouchableOpacity onPress={() => remove(item.comment_id)} hitSlop={8} style={{ padding: 6 }}>
              <Feather name="trash-2" size={15} color={colors.mutedFg} />
            </TouchableOpacity>
          ) : null}
        </View>
        {replies.map((reply) => renderComment(reply, true))}
      </View>
    );
  };

  return (
    <Modal
      visible={!!reel}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheetRoot, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="comments-backdrop" />
          <View
            style={[
              styles.commentsSheet,
              { backgroundColor: colors.backgroundElevated, borderColor: colors.border, maxHeight: height * 0.7 },
            ]}
          >
            <View style={styles.sheetHeader}>
              <NxText variant="titleSm">{reel ? formatCount(reel.comment_count) : 0} comments</NxText>
              <TouchableOpacity onPress={onClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.surfaceHigh }]}>
                <Feather name="x" size={18} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {loading ? (
                <View style={{ padding: 30, alignItems: "center" }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : comments.length === 0 ? (
                <View style={{ padding: 36, alignItems: "center" }}>
                  <MaterialCommunityIcons name="comment-text-outline" size={32} color={colors.mutedFg} />
                  <NxText variant="bodySm" style={{ color: colors.mutedFg, marginTop: 10 }}>
                    No comments yet. Be the first.
                  </NxText>
                </View>
              ) : (
                  <FlatList
                  data={topLevelComments}
                  keyExtractor={(c) => c.comment_id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => renderComment(item)}
                />
              )}
            </View>

            {replyingTo ? (
              <View style={[styles.replyBanner, { borderTopColor: colors.border, backgroundColor: colors.surface }]}> 
                <NxText variant="caption" style={{ color: colors.mutedFg, flex: 1 }}>
                  Replying to @{replyingTo.user?.username || "xyteee"}
                </NxText>
                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <Feather name="x" size={16} color={colors.mutedFg} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[styles.commentInputRow, { borderTopColor: colors.border, backgroundColor: colors.backgroundElevated }]}> 
              <Avatar
                uri={user?.profile_picture}
                size={32}
                name={user?.display_name || user?.username || "?"}
              />
              <TouchableOpacity
                onPress={() => setShowMediaPicker(true)}
                style={[styles.commentMediaBtn, { backgroundColor: colors.surfaceHigh }]}
                hitSlop={6}
              >
                <MaterialCommunityIcons name="sticker-emoji" size={18} color={colors.mutedFg} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={replyingTo ? "Write a reply…" : "Add a comment…"}
                placeholderTextColor={colors.mutedFg}
                multiline
                maxLength={500}
                style={[styles.commentInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
              <TouchableOpacity
                onPress={send}
                disabled={!text.trim() || sending}
                style={[
                  styles.sendBtn,
                  { backgroundColor: text.trim() && !sending ? colors.primary : colors.surfaceHigh },
                ]}
                hitSlop={6}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Feather name="send" size={16} color={text.trim() ? colors.onPrimary : colors.mutedFg} />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <MediaPicker
            visible={showMediaPicker}
            onClose={() => setShowMediaPicker(false)}
            onSelect={sendMediaComment}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "web" ? 12 : 52,
    zIndex: 20,
  },
  topTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    letterSpacing: 0.5,
  },
  camBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  myStatsBar: {
    position: "absolute",
    top: Platform.OS === "web" ? 58 : 98,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    gap: 8,
    zIndex: 20,
  },
  myStatsPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.34)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  myStatsValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: fonts.bodySemi,
  },
  myStatsLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10.5,
    marginTop: 1,
  },
  loadingMoreOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: DOCK_PAD + 14,
    alignItems: "center",
    zIndex: 15,
  },
  bottomWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: DOCK_PAD - 24,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
  },
  bottomRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingBottom: 16,
    paddingTop: 8,
    alignItems: "flex-end",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  musicRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  actionRail: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingLeft: 8,
  },
  railItem: {
    alignItems: "center",
    marginBottom: 18,
  },
  profileRailItem: {
    marginBottom: 22,
  },
  railLabel: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 4,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    padding: 2,
  },
  heartBurst: {
    position: "absolute",
    top: "38%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  empty: {
    flex: 1,
    height: WINDOW_H,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyCta: {
    marginTop: 18,
    backgroundColor: "#CFA876",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  uploadSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 30 : spacing.lg,
  },
  commentsSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  sourceCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  shareSearch: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: spacing.sm,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  shareSendPill: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  shareSentPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  shareSystemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radii.pill,
    height: 48,
    marginTop: spacing.md,
  },
  videoPreview: {
    height: 280,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  repickBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  captionInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    minHeight: 64,
    maxHeight: 110,
    fontSize: 14,
    fontFamily: fonts.body,
    textAlignVertical: "top",
  },
  visRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.md,
  },
  visChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  publishBtn: {
    marginTop: spacing.md,
    height: 50,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  commentBubble: {
    flex: 1,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  replyWrap: {
    marginLeft: 44,
    marginTop: -4,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentGif: {
    width: 180,
    height: 130,
    marginTop: 8,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  commentSticker: {
    width: 118,
    height: 118,
    marginTop: 8,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  commentMediaBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  commentInput: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 90,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
