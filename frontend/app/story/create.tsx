import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  TextInput,
  ActivityIndicator,
  Switch,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const TEXT_COLORS = [
  "#FFFFFF", "#FF3B30", "#FF9500", "#FFCC00",
  "#34C759", "#64D2FF", "#0A84FF", "#BF5AF2",
  "#000000", "#FF2D55", "#A2845E", "#30D158",
];

const TEXT_FONTS = [
  { label: "Modern", family: fonts.bodySemi },
  { label: "Classic", family: "serif" },
  { label: "Bold", family: fonts.bodySemi },
  { label: "Soft", family: fonts.bodyMedium },
  { label: "Mono", family: "monospace" },
  { label: "Sans", family: "sans-serif" },
  { label: "Condensed", family: "sans-serif-condensed" },
  { label: "Light", family: fonts.body },
  { label: "Display", family: fonts.display },
  { label: "Nexus", family: fonts.bodySemi },
];

export default function StoryCreate() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [media, setMedia] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [mediaError, setMediaError] = useState<string | null>(null);

  const videoPlayer = useVideoPlayer(
    mediaKind === "video" && media ? media : null,
    (player) => {
      player.loop = true;
      player.play();
    }
  );
  const [caption, setCaption] = useState("");
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [fontIndex, setFontIndex] = useState(0);
  const [textSize, setTextSize] = useState(28);
  const [showTextTools, setShowTextTools] = useState(false);
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [customColor, setCustomColor] = useState("#FFFFFF");

  const mediaScale = useRef(new Animated.Value(1)).current;
  const mediaTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const mediaScaleValue = useRef(1);
  const mediaTranslateValue = useRef({ x: 0, y: 0 });
  const mediaGestureStart = useRef({
    x: 0,
    y: 0,
    scale: 1,
    distance: 0,
  });

  const touchDistance = (touches: any[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const mediaPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches;
        mediaGestureStart.current = {
          x: mediaTranslateValue.current.x,
          y: mediaTranslateValue.current.y,
          scale: mediaScaleValue.current,
          distance: touchDistance(touches),
        };
      },

      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches || [];

        if (touches.length === 2) {
          const distance = touchDistance(touches);

          if (mediaGestureStart.current.distance <= 0) {
            mediaGestureStart.current.distance = distance;
            mediaGestureStart.current.scale = mediaScaleValue.current;
          } else if (distance > 0) {
            const ratio = distance / mediaGestureStart.current.distance;
            const nextScale = Math.max(
              0.1,
              Math.min(10, mediaGestureStart.current.scale * ratio)
            );

            mediaScaleValue.current = nextScale;
            mediaScale.setValue(nextScale);
          }

          return;
        }

        if (touches.length === 1 && mediaGestureStart.current.distance <= 0) {
          const next = {
            x: mediaGestureStart.current.x + gesture.dx,
            y: mediaGestureStart.current.y + gesture.dy,
          };

          mediaTranslateValue.current = next;
          mediaTranslate.setValue(next);
        }
      },

      onPanResponderEnd: (event) => {
        const touches = event.nativeEvent.touches || [];

        if (touches.length < 2) {
          mediaGestureStart.current.distance = 0;
          mediaGestureStart.current.scale = mediaScaleValue.current;
          mediaGestureStart.current.x = mediaTranslateValue.current.x;
          mediaGestureStart.current.y = mediaTranslateValue.current.y;
        }
      },

      onPanResponderRelease: () => {
        mediaTranslateValue.current = {
          x: (mediaTranslate as any).x.__getValue(),
          y: (mediaTranslate as any).y.__getValue(),
        };
        mediaScaleValue.current = (mediaScale as any).__getValue();
      },
    })
  ).current;

  const captionPosition = useRef(
    new Animated.ValueXY({
      x: SCREEN_W * 0.08,
      y: SCREEN_H * 0.38,
    })
  ).current;

  const dragStart = useRef({ x: SCREEN_W * 0.08, y: SCREEN_H * 0.38 });

  const captionPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !editingCaption,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !editingCaption && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),

      onPanResponderGrant: () => {
        captionPosition.stopAnimation((value) => {
          dragStart.current = value;
        });
      },

      onPanResponderMove: (_, gesture) => {
        const nextX = Math.max(
          8,
          Math.min(SCREEN_W - 248, dragStart.current.x + gesture.dx)
        );

        const nextY = Math.max(
          105,
          Math.min(SCREEN_H - 250, dragStart.current.y + gesture.dy)
        );

        captionPosition.setValue({ x: nextX, y: nextY });
      },

      onPanResponderRelease: () => {
        captionPosition.stopAnimation((value) => {
          dragStart.current = value;
        });
      },
    })
  ).current;

  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "failed">("idle");

  const pick = async (type: "image" | "video" | "all" = "all") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const mediaTypes =
      type === "image"
        ? ImagePicker.MediaTypeOptions.Images
        : type === "video"
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.All;

    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      base64: type !== "video",
      quality: 0.82,
      videoMaxDuration: 300,
    });

    if (r.canceled || !r.assets?.[0]) return;

    const asset = r.assets[0];
    const isVideo = asset.type === "video";

    setMediaError(null);

    if (isVideo) {
      const maxVideoBytes = 20 * 1024 * 1024;

      if (typeof asset.fileSize === "number" && asset.fileSize > maxVideoBytes) {
        setMedia(null);
        setMediaKind("image");
        setMediaError("Video must be 20 MB or smaller.");
        return;
      }
    }

    setMediaKind(isVideo ? "video" : "image");

    if (isVideo) {
      setMedia(asset.uri);
    } else if (asset.base64) {
      setMedia(`data:image/jpeg;base64,${asset.base64}`);
    } else {
      setMedia(asset.uri);
    }
  };

  const publish = async () => {
    if (!media || !token) return;

    let finalTextPosition = {
      x: SCREEN_W * 0.08,
      y: SCREEN_H * 0.38,
    };

    await new Promise<void>((resolve) => {
      captionPosition.stopAnimation((value) => {
        finalTextPosition = value;
        resolve();
      });
    });

    setBusy(true);
    setUploadStatus("uploading");
    try {
      await api("/stories", {
        method: "POST",
        body: {
          kind: mediaKind,
          media,
          caption,
          is_private: priv,
          text_x: finalTextPosition.x / SCREEN_W,
          text_y: finalTextPosition.y / SCREEN_H,
          text_color: textColor,
          text_size: textSize,
          font_index: fontIndex,
          media_scale: mediaScaleValue.current,
          media_x: mediaTranslateValue.current.x / SCREEN_W,
          media_y: mediaTranslateValue.current.y / SCREEN_H,
        },
        token,
      });
      setUploadStatus("success");
      setTimeout(() => router.back(), 900);
    } catch (error) {
      setUploadStatus("failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Full-screen canvas ─────────────────────────────────────────── */}
      <View
        testID="story-pick"
        style={styles.canvas}
      >
        {media ? (
          <Animated.View
            {...mediaPan.panHandlers}
            style={[
              StyleSheet.absoluteFillObject,
              {
                transform: [
                  { translateX: mediaTranslate.x },
                  { translateY: mediaTranslate.y },
                  { scale: mediaScale },
                ],
              },
            ]}
          >
            {mediaKind === "video" ? (
              <>
                <VideoView
                  player={videoPlayer}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="contain"
                  nativeControls={false}
                  pointerEvents="none"
                />
                <View
                  {...mediaPan.panHandlers}
                  style={StyleSheet.absoluteFillObject}
                />
              </>
            ) : (
              <Image
                source={{ uri: media }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="contain"
              />
            )}
          </Animated.View>
        ) : (
          /* Premium empty state */
          <View style={styles.emptyState}>
            <View style={styles.createGlow}>
              <View style={styles.plusRing}>
                <Feather name="plus" size={34} color="#fff" />
              </View>
            </View>

            <NxText style={styles.emptyTitle}>Create your story</NxText>
            <NxText style={styles.emptyHint}>
              Share a moment with your Nexus
            </NxText>

            <View style={styles.mediaChoices}>
              <TouchableOpacity
                style={styles.mediaChoice}
                activeOpacity={0.82}
                onPress={() => pick("image")}
              >
                <View style={styles.choiceIcon}>
                  <Feather name="image" size={20} color="#fff" />
                </View>
                <View style={styles.choiceTextWrap}>
                  <NxText style={styles.choiceTitle}>Photo</NxText>
                  <NxText style={styles.choiceHint} numberOfLines={1}>Gallery</NxText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mediaChoice}
                activeOpacity={0.82}
                onPress={() => pick("video")}
              >
                <View style={styles.choiceIcon}>
                  <Feather name="video" size={20} color="#fff" />
                </View>
                <View style={styles.choiceTextWrap}>
                  <NxText style={styles.choiceTitle}>Video</NxText>
                  <NxText style={styles.choiceHint} numberOfLines={1}>Gallery</NxText>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.expirePill}>
              <Feather name="clock" size={13} color="rgba(255,255,255,0.62)" />
              <NxText style={styles.expireText}>Disappears after 24 hours</NxText>
            </View>
          </View>
        )}

        {/* Gradient overlays */}
        <LinearGradient
          colors={["rgba(0,0,0,0.72)", "transparent"]}
          style={styles.topGrad}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.88)"]}
          style={styles.bottomGrad}
          pointerEvents="none"
        />
      </View>

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity
          testID="story-close"
          onPress={() => router.back()}
          style={styles.glassBtn}
        >
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>

        <NxText style={styles.topTitle}>New Story</NxText>

        <TouchableOpacity
          onPress={media ? () => pick("all") : undefined}
          style={[styles.glassBtn, !media && { opacity: 0 }]}
         
        >
          <Feather name="image" size={18} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Movable story text ─────────────────────────────────────── */}
      {media ? (
        <>
          <Animated.View
            {...captionPan.panHandlers}
            style={[
              styles.captionFloating,
              {
                transform: captionPosition.getTranslateTransform(),
              },
            ]}
          >
            {editingCaption ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "position" : undefined}
              >
                <TextInput
                  testID="story-caption"
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Type something…"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  multiline
                  autoFocus
                  onBlur={() => {
                    setEditingCaption(false);
                    setShowTextTools(!!caption);
                  }}
                  style={[
                    styles.captionInput,
                    {
                      color: textColor,
                      fontSize: textSize,
                      lineHeight: Math.round(textSize * 1.25),
                      fontFamily: TEXT_FONTS[fontIndex].family,
                    },
                  ]}
                />
              </KeyboardAvoidingView>
            ) : caption ? (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => setShowTextTools((v) => !v)}
                onLongPress={() => {
                  setEditingCaption(true);
                  setShowTextTools(true);
                }}
                delayLongPress={450}
                style={styles.captionDisplay}
              >
                <Text
                  style={[
                    styles.captionText,
                    {
                      color: textColor,
                      fontSize: textSize,
                      lineHeight: Math.round(textSize * 1.25),
                      fontFamily: TEXT_FONTS[fontIndex].family,
                    },
                  ]}
                >
                  {caption}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => {
                  setEditingCaption(true);
                  setShowTextTools(true);
                }}
                style={styles.captionPlaceholderRow}
              >
                <Feather
                  name="type"
                  size={14}
                  color="rgba(255,255,255,0.6)"
                />
                <NxText style={styles.captionPlaceholder}>Add text</NxText>
              </TouchableOpacity>
            )}
          </Animated.View>

          {showTextTools && media ? (
            <View style={styles.textTools}>
              <View style={styles.sizeRow}>
                <NxText style={styles.sizeSmall}>A</NxText>

                <View style={styles.sizeTrack}>
                  {[18, 22, 26, 30, 34, 38, 42, 48].map((size) => (
                    <TouchableOpacity
                      key={size}
                      onPress={() => setTextSize(size)}
                      style={[
                        styles.sizeDot,
                        textSize === size && styles.sizeDotActive,
                      ]}
                    />
                  ))}
                </View>

                <NxText style={styles.sizeLarge}>A</NxText>
              </View>

              <View style={styles.fontHeader}>
                <NxText style={styles.fontPreview}>
                  {TEXT_FONTS[fontIndex].label}
                </NxText>
              </View>

              <View style={styles.fontRow}>
                {TEXT_FONTS.map((font, index) => (
                  <TouchableOpacity
                    key={`${font.label}-${index}`}
                    onPress={() => setFontIndex(index)}
                    style={[
                      styles.fontChoice,
                      fontIndex === index && styles.fontChoiceActive,
                    ]}
                  >
                    <NxText
                      numberOfLines={1}
                      style={[
                        styles.fontChoiceText,
                        { fontFamily: font.family },
                      ]}
                    >
                      {font.label}
                    </NxText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.colorRow}>
                {TEXT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => {
                      setTextColor(color);
                      setShowCustomColor(false);
                    }}
                    style={[
                      styles.colorChoice,
                      { backgroundColor: color },
                      textColor === color && styles.colorChoiceActive,
                    ]}
                  />
                ))}

                <TouchableOpacity
                  onPress={() => setShowCustomColor((v) => !v)}
                  style={styles.customColorBtn}
                >
                  <Feather name="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {showCustomColor ? (
                <View style={styles.customColorBox}>
                  <View
                    style={[
                      styles.customColorPreview,
                      { backgroundColor: customColor },
                    ]}
                  />

                  <TextInput
                    value={customColor}
                    onChangeText={(value) => {
                      const next = value.toUpperCase();
                      setCustomColor(next);

                      if (/^#[0-9A-F]{6}$/.test(next)) {
                        setTextColor(next);
                      }
                    }}
                    autoCapitalize="characters"
                    maxLength={7}
                    placeholder="#FF1493"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.hexInput}
                  />

                  <TouchableOpacity
                    onPress={() => {
                      if (/^#[0-9A-F]{6}$/.test(customColor)) {
                        setTextColor(customColor);
                        setShowCustomColor(false);
                      }
                    }}
                    style={styles.hexDone}
                  >
                    <Feather name="check" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <NxText style={styles.dragHint}>
                {editingCaption
                  ? "Choose font, size and color"
                  : "Hold and drag the text anywhere"}
              </NxText>
            </View>
          ) : null}
        </>
      ) : null}

      {mediaError ? (
        <View style={styles.mediaError}>
          <Feather name="alert-circle" size={15} color="#fff" />
          <NxText style={styles.mediaErrorText}>{mediaError}</NxText>
        </View>
      ) : null}

      {/* ── Bottom controls ─────────────────────────────────────────────── */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.bottomRow}>
          {/* Thumbnail of selected image */}
          {media ? (
            <TouchableOpacity onPress={() => pick("all")} style={styles.thumb}>
              {mediaKind === "image" ? (
                <Image source={{ uri: media }} style={StyleSheet.absoluteFillObject} />
              ) : (
                <View style={styles.videoThumb}>
                  <Feather name="play" size={18} color="#fff" />
                </View>
              )}
              <View style={styles.thumbOverlay}>
                <Feather name="edit-2" size={10} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Privacy pill */}
          <TouchableOpacity
            style={styles.privPill}
            onPress={() => setPriv((p) => !p)}
            activeOpacity={0.8}
          >
            <Feather
              name={priv ? "lock" : "globe"}
              size={13}
              color="rgba(255,255,255,0.9)"
            />
            <NxText style={styles.privLabel}>
              {priv ? "Friends only" : "Everyone"}
            </NxText>
          </TouchableOpacity>

          {/* Switch */}
          <Switch
            testID="story-private-toggle"
            value={priv}
            onValueChange={setPriv}
            trackColor={{ true: colors.primary, false: "rgba(255,255,255,0.25)" }}
            thumbColor="#fff"
            style={{ marginRight: 6 }}
          />

          {/* Share button */}
          <TouchableOpacity
            testID="story-publish"
            disabled={!media || busy}
            onPress={publish}
            style={[
              styles.shareBtn,
              { backgroundColor: media && !busy ? colors.primary : "rgba(255,255,255,0.18)" },
            ]}
          >
            {uploadStatus === "uploading" ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <NxText style={styles.shareText}>Uploading...</NxText>
              </>
            ) : uploadStatus === "success" ? (
              <>
                <Feather name="check" size={15} color="#fff" />
                <NxText style={styles.shareText}>Success</NxText>
              </>
            ) : uploadStatus === "failed" ? (
              <>
                <Feather name="alert-circle" size={15} color="#fff" />
                <NxText style={styles.shareText}>Failed</NxText>
              </>
            ) : (
              <>
                <Feather name="send" size={15} color="#fff" />
                <NxText style={styles.shareText}>Share</NxText>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  videoThumb: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaError: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 105,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(190,35,45,0.94)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  mediaErrorText: {
    color: "#fff",
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    marginLeft: 8,
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emptyState: {
    width: "100%",
    paddingHorizontal: 24,
    alignItems: "center",
  },
  createGlow: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  plusRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 25,
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  emptyHint: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 14,
    marginTop: 7,
    textAlign: "center",
  },
  mediaChoices: {
    width: "100%",
    maxWidth: 430,
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },
  mediaChoice: {
    flex: 1,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.075)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  mediaChoiceMuted: {
    opacity: 0.55,
  },
  choiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  choiceTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: fonts.bodySemi,
  },
  choiceHint: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    marginTop: 2,
  },
  expirePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  expireText: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
  },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 180 },
  bottomGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: 240 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  topTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  captionFloating: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 240,
    alignItems: "center",
    zIndex: 30,
    elevation: 30,
  },
  captionInput: {
    color: "#fff",
    fontSize: 24,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: 240,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  captionDisplay: {
    maxWidth: 240,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  captionText: {
    fontSize: 24,
    lineHeight: 31,
    textAlign: "center",
  },
  captionPlaceholderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  captionPlaceholder: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
  textTools: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 104,
    zIndex: 40,
    elevation: 40,
    backgroundColor: "rgba(12,12,16,0.96)",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sizeSmall: {
    color: "#fff",
    fontSize: 14,
  },
  sizeLarge: {
    color: "#fff",
    fontSize: 25,
  },
  sizeTrack: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  sizeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  sizeDotActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  fontHeader: {
    alignItems: "center",
    marginBottom: 8,
  },
  fontPreview: {
    color: "#fff",
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
  fontRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  fontChoice: {
    width: "18.5%",
    minWidth: 0,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  fontChoiceActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "#fff",
  },
  fontChoiceText: {
    color: "#fff",
    fontSize: 10,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  colorChoice: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
  },
  colorChoiceActive: {
    borderWidth: 3,
    borderColor: "#fff",
    transform: [{ scale: 1.12 }],
  },
  customColorBtn: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  customColorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 8,
  },
  customColorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  hexInput: {
    flex: 1,
    height: 38,
    color: "#fff",
    fontSize: 15,
    fontFamily: "monospace",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  hexDone: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  dragHint: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
    fontFamily: fonts.bodyMedium,
  },
  bottomSafe: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: 28,
    paddingTop: 12,
    gap: 8,
  },
  thumb: {
    width: 42,
    height: 58,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  privPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  privLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  shareText: {
    color: "#fff",
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
});
