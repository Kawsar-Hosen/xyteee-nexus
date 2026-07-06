/**
 * VoiceBubble — NATIVE implementation.
 * Shows the waveform UI. Playback alerts user to install expo-audio.
 * The web implementation (VoiceBubble.web.tsx) is used for web builds.
 */
import React, { useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, Alert } from "react-native";
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

const BAR_COUNT = 28;

export function VoiceBubble({
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

  const handlePlay = () => {
    Alert.alert("Voice Playback", "Install expo-audio to enable voice message playback on mobile.");
  };

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <TouchableOpacity onPress={handlePlay} style={[styles.playBtn, { backgroundColor: tint + "22" }]}>
        <Feather name="play" size={20} color={tint} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={styles.bars}>
          {bars.map((h, i) => (
            <StaticBar key={i} height={h} tint={tint} />
          ))}
        </View>
        <NxText style={[styles.dur, { color: tint }]}>{fmt(durSec)}</NxText>
      </View>
    </View>
  );
}

function StaticBar({ height, tint }: { height: number; tint: string }) {
  const h = useSharedValue(height);
  useEffect(() => { h.value = withTiming(height, { duration: 300 }); }, [height, h]);
  const style = useAnimatedStyle(() => ({ height: h.value * 28, opacity: 0.45 }));
  return <Animated.View style={[styles.bar, { backgroundColor: tint }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, borderWidth: 1, gap: 10, minWidth: 200, maxWidth: 280 },
  playBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bars: { flexDirection: "row", alignItems: "center", gap: 2, height: 28 },
  bar: { width: 3, borderRadius: 2 },
  dur: { fontSize: 11, fontFamily: fonts.bodySemi, marginTop: 3 },
});
