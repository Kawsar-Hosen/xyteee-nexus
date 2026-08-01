/**
 * VoiceBubble — WEB implementation using HTML5 Audio.
 * This file is automatically chosen by Metro/Expo for web builds.
 */
import React, { useEffect, useRef, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
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

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function parseDuration(d: string) {
  const parts = d.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

const BAR_COUNT = 28;

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
  const [playing, setPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(() => parseDuration(duration || "0:00") * 1000);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = seededBars(messageId, BAR_COUNT);
  const tint = isMe ? colors.onPrimary : colors.primary;
  const bg = isMe ? colors.primary : colors.surface;
  const border = isMe ? "transparent" : colors.border;

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = new Audio(mediaUri);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDurMs(audio.duration * 1000);
    audio.ontimeupdate = () => setPosMs(audio.currentTime * 1000);
    audio.onended = () => { setPlaying(false); setPosMs(0); };
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const progress = durMs > 0 ? Math.min(posMs / durMs, 1) : 0;
  const fillIdx = Math.floor(progress * BAR_COUNT);

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: tint + "22" }]}>
        <Feather name={playing ? "pause" : "play"} size={20} color={tint} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={styles.bars}>
          {bars.map((h, i) => (
            <AnimatedBar key={i} height={h} filled={i <= fillIdx} playing={playing} tint={tint} delay={i * 40} />
          ))}
        </View>
        <NxText style={[styles.dur, { color: tint }]}>
          {playing && posMs > 0 ? fmt(posMs) : fmt(durMs)}
        </NxText>
      </View>
    </View>
  );
}

function AnimatedBar({ height, filled, playing, tint, delay }: { height: number; filled: boolean; playing: boolean; tint: string; delay: number }) {
  const scale = useSharedValue(height);
  useEffect(() => {
    if (playing) {
      scale.value = withRepeat(
        withSequence(
          withTiming(height * 1.3, { duration: 300 + (delay % 200) }),
          withTiming(height * 0.6, { duration: 300 + (delay % 150) })
        ), -1, true
      );
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(height, { duration: 200 });
    }
  }, [playing, height, delay, scale]);
  const style = useAnimatedStyle(() => ({ height: scale.value * 28, opacity: filled ? 1 : 0.35 }));
  return <Animated.View style={[styles.bar, { backgroundColor: tint }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, borderWidth: 1, gap: 10, minWidth: 200, maxWidth: 280 },
  playBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bars: { flexDirection: "row", alignItems: "center", gap: 2, height: 28 },
  bar: { width: 3, borderRadius: 2 },
  dur: { fontSize: 11, fontFamily: fonts.bodySemi, marginTop: 3 },
});
