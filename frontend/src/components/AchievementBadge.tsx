import React from "react";
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Circle, G, Path } from "react-native-svg";

import { ACHIEVEMENTS } from "./premium";
import { resolveIconPath } from "./badgePaths";

export const ACHIEVEMENT_GRADIENTS: Record<string, [string, string, string]> = {
  bronze: ["#F3D3AE", "#CD7F32", "#7A4A21"],
  silver: ["#FFFFFF", "#C0C0C0", "#7E8C98"],
  gold: ["#FFF3C4", "#F0C044", "#A67C08"],
  platinum: ["#E6FAFF", "#7DD3FC", "#2563EB"],
  diamond: ["#FFFFFF", "#B9F2FF", "#60A5FA"],
};

const LEVEL_ICON: Record<string, string> = {
  bronze: "star-four-points",
  silver: "star-four-points",
  gold: "star-four-points",
  platinum: "star-four-points",
  diamond: "diamond",
};

export function AchievementBadge({
  level,
  size,
  glow = true,
}: {
  level: string;
  size: number;
  glow?: boolean;
}) {
  const grad = ACHIEVEMENT_GRADIENTS[level] || ACHIEVEMENT_GRADIENTS.gold;
  const accent = grad[1];
  const { d, cx, cy, scale } = resolveIconPath(LEVEL_ICON[level] || "star-four-points");

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`achGrad-${level}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={grad[0]} />
          <Stop offset="0.55" stopColor={grad[1]} />
          <Stop offset="1" stopColor={grad[2]} />
        </LinearGradient>
        <LinearGradient id={`achEdge-${level}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.3" />
        </LinearGradient>
        <RadialGradient id={`achGloss-${level}`} cx="0.32" cy="0.28" r="0.75">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Circle cx="32" cy="32" r="30" fill={`url(#achEdge-${level})`} />
      <Circle cx="32" cy="32" r="28.5" fill={`url(#achGrad-${level})`} />
      <Circle cx="32" cy="32" r="28.5" fill={`url(#achGloss-${level})`} />

      {glow ? (
        <Circle cx="32" cy="32" r="32" stroke={accent} strokeWidth="2.5" strokeOpacity="0.55" fill="none" />
      ) : null}

      <G transform={`translate(32,32) scale(${scale * 0.92}) translate(${-cx},${-cy})`}>
        <Path d={d} fill="rgba(6,6,10,0.35)" transform="translate(0,1.6)" />
        <Path d={d} fill="#FFFFFF" />
      </G>
    </Svg>
  );
}
