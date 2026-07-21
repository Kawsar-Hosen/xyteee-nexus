/**
 * VoiceBubble — NATIVE implementation.
 * Shows the waveform UI and handles playback.
 * The web implementation (VoiceBubble.web.tsx) is used for web builds.
 */
import React, { useEffect, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { NxText } from "./NxText";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts } from "@/src/theme";

function seededBars(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    bars.push(0.25 + ((h & 0xff) / 255) * 0.75);
  }
  return bars;
}

function parseDuration(d: string) {
  const parts = d.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

const BAR_COUNT = 40;

export function VoiceBubble({
  mediaUri,
  duration,
  messageId,
  isMe,
}: {
  mediaUri: string;
  duration?: string;
  messageId: string;
  isMe: boolean;
}) {
  const { colors } = useTheme();
  const bars = seededBars(messageId, BAR_COUNT);
  const tint = isMe ? colors.onPrimary : colors.primary;
  const bg = isMe ? colors.primary : colors.surface;
  const border = isMe ? "transparent" : colors.border;
  const durSec = parseDuration(duration || "0:00");

  // If the media is a base64 data URL (sent from the recorder), we must write it
  // to a temporary file first — expo-audio cannot play data: URIs on Android.
  const [localUri, setLocalUri] = useState<string>("");
  useEffect(() => {
    if (!mediaUri) return;
    if (mediaUri.startsWith("data:audio/")) {
      // Extract base64 payload (everything after the comma)
      const commaIdx = mediaUri.indexOf(",");
      if (commaIdx === -1) return;
      const b64 = mediaUri.slice(commaIdx + 1);
      const ext = mediaUri.includes("audio/m4a") ? "m4a" : "aac";
      const path = `${FileSystem.cacheDirectory}voice_${messageId}.${ext}`;
      FileSystem.writeAsStringAsync(path, b64, {
        encoding: FileSystem.EncodingType.Base64,
      })
        .then(() => setLocalUri(path))
        .catch(() => setLocalUri(mediaUri)); // fallback
    } else {
      setLocalUri(mediaUri);
    }
  }, [mediaUri, messageId]);

  const player = useAudioPlayer(localUri);
  const status = useAudioPlayerStatus(player);
  const totalDuration = status.duration || durSec || 1;
  const progress = Math.min(
    1,
    Math.max(0, (status.currentTime || 0) / totalDuration)
  );

  const handlePlay = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <TouchableOpacity onPress={handlePlay} style={[styles.playBtn, { backgroundColor: tint + "22" }]}>
        <Feather name={status.playing ? "pause" : "play"} size={20} color={tint} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={styles.bars}>
          {bars.map((h, i) => (
            <StaticBar
              key={i}
              height={h}
              tint={tint}
              active={i / bars.length <= progress}
            />
          ))}
        </View>
        <NxText style={[styles.dur, { color: tint }]}>
          {fmt(
            status.playing
              ? Math.max(0, Math.ceil(totalDuration - (status.currentTime || 0)))
              : durSec
          )}
        </NxText>
      </View>
    </View>
  );
}

function StaticBar({
  height,
  tint,
  active,
}: {
  height: number;
  tint: string;
  active: boolean;
}) {
  const h = useSharedValue(height);
  useEffect(() => { h.value = withTiming(height, { duration: 300 }); }, [height, h]);
  const style = useAnimatedStyle(() => ({
    height: h.value * 28,
    opacity: withTiming(active ? 1 : 0.35, { duration: 120 }),
  }));

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: tint }, style]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    width: 220,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1.5,
    height: 24,
  },
  bar: {
    flex: 1,
    minWidth: 2,
    maxWidth: 3,
    borderRadius: 2,
  },
  dur: {
    fontSize: 10,
    fontFamily: fonts.bodySemi,
    marginTop: 1,
  },
});
