import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Switch,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

const { height: SCREEN_H } = Dimensions.get("window");

export default function StoryCreate() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [media, setMedia] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.72,
    });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    setMedia(`data:image/jpeg;base64,${r.assets[0].base64}`);
  };

  const publish = async () => {
    if (!media || !token) return;
    setBusy(true);
    try {
      await api("/stories", {
        method: "POST",
        body: { kind: "image", media, caption, is_private: priv },
        token,
      });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Full-screen canvas ─────────────────────────────────────────── */}
      <TouchableOpacity
        testID="story-pick"
        onPress={media ? undefined : pick}
        activeOpacity={media ? 1 : 0.85}
        style={styles.canvas}
      >
        {media ? (
          <Image
            source={{ uri: media }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          /* Empty state */
          <View style={styles.emptyState}>
            <View style={styles.plusRing}>
              <Feather name="plus" size={38} color="#fff" />
            </View>
            <NxText style={styles.emptyTitle}>Add a photo</NxText>
            <NxText style={styles.emptyHint}>Stories disappear in 24 hours</NxText>
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
      </TouchableOpacity>

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
          onPress={media ? pick : undefined}
          style={[styles.glassBtn, !media && { opacity: 0 }]}
         
        >
          <Feather name="image" size={18} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Caption overlay (tappable on image) ────────────────────────── */}
      {media ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setEditingCaption(true)}
          style={styles.captionTapZone}
         
        >
          {editingCaption ? (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "position" : undefined}>
              <TextInput
                testID="story-caption"
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a caption…"
                placeholderTextColor="rgba(255,255,255,0.55)"
                multiline
                autoFocus
                onBlur={() => setEditingCaption(false)}
                style={styles.captionInput}
              />
            </KeyboardAvoidingView>
          ) : caption ? (
            <View style={styles.captionDisplay}>
              <NxText style={styles.captionText}>{caption}</NxText>
            </View>
          ) : (
            <View style={styles.captionPlaceholderRow}>
              <Feather name="type" size={14} color="rgba(255,255,255,0.6)" />
              <NxText style={styles.captionPlaceholder}>  Add a caption</NxText>
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      {/* ── Bottom controls ─────────────────────────────────────────────── */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.bottomRow}>
          {/* Thumbnail of selected image */}
          {media ? (
            <TouchableOpacity onPress={pick} style={styles.thumb}>
              <Image source={{ uri: media }} style={StyleSheet.absoluteFillObject} />
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
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
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
  canvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0d0d0d",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { alignItems: "center", gap: 14 },
  plusRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.3,
  },
  emptyHint: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
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
  captionTapZone: {
    position: "absolute",
    top: SCREEN_H * 0.38,
    left: spacing.xl,
    right: spacing.xl,
    alignItems: "center",
  },
  captionInput: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "PlayfairDisplay-Bold",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 240,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  captionDisplay: {
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  captionText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "PlayfairDisplay-Bold",
    textAlign: "center",
  },
  captionPlaceholderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  captionPlaceholder: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
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
