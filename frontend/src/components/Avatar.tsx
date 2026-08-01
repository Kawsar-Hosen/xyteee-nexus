import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import {
  frameColors,
  achievementColor,
} from "@/src/components/premium";
import { ProfileFrame } from "@/src/components/ProfileFrame";
import { AchievementBadge } from "@/src/components/AchievementBadge";

const initials = (name?: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  const s = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  return s.toUpperCase();
};

export function Avatar({
  uri,
  name,
  size = 44,
  ring,
  online,
  onlineStatus = "online",
  frame,
  achievement,
  animation,
  animationSpeed,
  animationIntensity,
}: {
  uri?: string;
  name?: string;
  size?: number;
  ring?: boolean;
  online?: boolean;
  onlineStatus?: "online" | "idle" | "dnd" | "invisible";
  frame?: string | null;
  achievement?: string | null;
  animation?: string | null;
  animationSpeed?: string | null;
  animationIntensity?: string | null;
}) {
  const { colors } = useTheme();
  const outerSize = ring ? size + 6 : size;
  const frameC = frameColors(frame);
  const framePad = frameC ? Math.max(3, Math.round(size * 0.1)) : 0;
  const containerSize = outerSize + framePad * 2;

  const inner = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceHigh,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <NxText style={{ color: colors.primary, fontSize: size * 0.4, fontFamily: "PlayfairDisplay-Bold" }}>
        {initials(name) || "N"}
      </NxText>
    </View>
  );

  const achievementBadge =
    achievement && achievementColor(achievement) ? (
      <View style={{ position: "absolute", left: -1.5, bottom: -1.5 }}>
        <AchievementBadge level={achievement} size={size * 0.34} />
      </View>
    ) : null;

  const onlineDot =
    online && onlineStatus !== "invisible" ? (
      <View
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: (size * 0.28) / 2,
          backgroundColor:
            onlineStatus === "idle"
              ? "#F0B232"
              : onlineStatus === "dnd"
              ? "#F23F43"
              : colors.online,
          borderWidth: 2,
          borderColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {onlineStatus === "dnd" ? (
          <View
            style={{
              width: size * 0.13,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.background,
            }}
          />
        ) : null}
      </View>
    ) : null;

  const core = (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 0,
        borderColor: ring ? colors.primary : "transparent",
      }}
    >
      {inner}
      {achievementBadge}
      {onlineDot}
    </View>
  );

  if (!frameC || !frame) return core;

  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ProfileFrame
        size={containerSize}
        hole={outerSize}
        frame={frame}
        animation={animation || "glow"}
        animationSpeed={animationSpeed}
        animationIntensity={animationIntensity}
        style={StyleSheet.absoluteFillObject}
      />
      {core}
    </View>
  );
}

export const _styles = StyleSheet.create({});
