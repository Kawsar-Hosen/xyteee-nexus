import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Circle, G, Path, Rect, Ellipse } from "react-native-svg";
import type { SharedValue } from "react-native-reanimated";

import {
  FRAME_STYLES,
  ANIMATION_SPEEDS,
  ANIMATION_INTENSITIES,
  type AnimationSpeedId,
  type AnimationIntensityId,
  type FrameShape,
  type FrameOrnament,
} from "./premium";
import { resolveIconPath } from "./badgePaths";

const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);
const AG = Animated.createAnimatedComponent(G);
const ARect = Animated.createAnimatedComponent(Rect);

const GLOW_EASE = Easing.inOut(Easing.ease);

const PERIODS: Record<string, number> = {
  glow: 2600,
  pulse: 1300,
  rotate: 5000,
  sparkle: 2400,
  aura: 3000,
  orbit: 4600,
  particles: 5000,
  shimmer: 3200,
  rainbow: 4000,
  neon: 1600,
  fire: 2400,
  lightning: 1700,
  frost: 2800,
  magic: 4600,
  butterfly: 6200,
  sakura: 7200,
  roses: 7200,
  golden: 5000,
  snow: 7200,
  hearts: 7000,
  stars: 3600,
  galaxy: 10000,
  meteor: 4400,
  ripple: 3800,
  crystal: 3600,
  phoenix: 4600,
  dragon: 4200,
  angel: 7200,
  shadow: 3200,
  holographic: 5200,
  custom: 4200,
};

const HUES = ["#FF3D5A", "#FFB300", "#3DDB57", "#1F8AFF", "#A55BFF", "#FF3D5A"];
const HOLO = ["#FF6BD6", "#7DF9FF", "#B08CFF", "#FFF7AE", "#FF6BD6"];
const NEON_COLORS = ["#22D3EE", "#E879F9", "#22D3EE"];

function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ringDots(count: number, radius: number): Array<[number, number]> {
  return Array.from({ length: count }).map((_, i) => {
    const a = (i / count) * Math.PI * 2;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
}

function pt(c: number, a: number, r: number): [number, number] {
  return [c + Math.cos(a) * r, c + Math.sin(a) * r];
}

function pathStr(pts: Array<[number, number]>, close = true): string {
  const body = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(" ");
  return close ? body + " Z" : body;
}

const SHAPE_CACHE: Record<string, { d: string | null; pts: Array<[number, number]> }> = {};

function shapePath(shape: FrameShape, c: number, ringR: number, ringW: number) {
  const key = `${shape.kind}|${shape.n}|${shape.r1 ?? 0}|${shape.rot ?? 0}|${Math.round(ringR * 10)}|${Math.round(ringW * 10)}`;
  const hit = SHAPE_CACHE[key];
  if (hit) return hit;
  const kind = shape.kind;
  const n = shape.n;
  const rot = (shape.rot ?? 0) * (Math.PI / 180);
  let d: string | null = null;
  let pts: Array<[number, number]> = [];

  if (kind === "ring") {
    pts = ringPoints(n, c, ringR, rot);
  } else if (kind === "poly") {
    const verts: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) verts.push(pt(c, rot + (i * Math.PI * 2) / n, ringR));
    d = pathStr(verts);
    pts = verts;
  } else if (kind === "star" || kind === "spike") {
    const r1 = (shape.r1 ?? 0.62) * ringR;
    const verts: Array<[number, number]> = [];
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n;
      const r = i % 2 === 0 ? ringR : r1;
      verts.push(pt(c, a, r));
    }
    d = pathStr(verts);
    pts = verts.filter((_, i) => i % 2 === 0);
  } else if (kind === "scallop" || kind === "wave") {
    const amp = kind === "scallop" ? 0.1 : 0.06;
    const m = n * 16;
    const verts: Array<[number, number]> = [];
    for (let i = 0; i <= m; i++) {
      const a = (i / m) * Math.PI * 2;
      const r = ringR * (1 + amp * Math.cos(n * a + rot));
      verts.push(pt(c, a, r));
    }
    d = pathStr(verts, false);
    pts = [];
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k - rot) / n;
      pts.push(pt(c, a, ringR * (1 + amp)));
    }
  } else if (kind === "gear") {
    const step = (Math.PI * 2) / n;
    const half = step * 0.2;
    const verts: Array<[number, number]> = [];
    const tips: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * step;
      verts.push(pt(c, a0 - half, ringR * 1.05));
      verts.push(pt(c, a0 + half, ringR * 1.05));
      verts.push(pt(c, a0 + step / 2 + half, ringR * 0.95));
      verts.push(pt(c, a0 + step / 2 - half, ringR * 0.95));
      tips.push(pt(c, a0, ringR * 1.05));
    }
    d = pathStr(verts);
    pts = tips;
  } else if (kind === "squircle") {
    const m = 96;
    const verts: Array<[number, number]> = [];
    for (let i = 0; i <= m; i++) {
      const a = (i / m) * Math.PI * 2;
      const ca = Math.abs(Math.cos(a));
      const sa = Math.abs(Math.sin(a));
      const r = ringR / Math.pow(ca * ca + sa * sa, 0.25);
      verts.push(pt(c, a, r));
    }
    d = pathStr(verts, false);
    pts = [];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      pts.push(pt(c, a, ringR * 1.05));
    }
  }

  const result = { d, pts };
  SHAPE_CACHE[key] = result;
  return result;
}

function ringPoints(count: number, c: number, radius: number, rot: number): Array<[number, number]> {
  return Array.from({ length: count }).map((_, i) => {
    const a = rot + (i / count) * Math.PI * 2;
    return pt(c, a, radius);
  });
}

function topArc(c: number, ringR: number, ringW: number): string {
  const a0 = -115 * (Math.PI / 180);
  const a1 = -65 * (Math.PI / 180);
  const r = ringR * 0.8;
  const pts: Array<[number, number]> = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * (a1 - a0);
    pts.push(pt(c, a, r));
  }
  return pathStr(pts, false);
}

function renderOrnament(
  orn: FrameOrnament,
  pts: Array<[number, number]>,
  c: number,
  ringR: number,
  ringW: number,
  colors: [string, string, string],
  accent: string,
  glow: string
) {
  if (!pts || pts.length === 0) return null;
  const k = orn.kind;
  return (
    <G>
      {pts.map(([px, py], i) => {
        const a = Math.atan2(py - c, px - c);
        if (k === "gems") {
          const g = Math.max(1.2, ringW * 0.32);
          const d = `M ${px} ${py - g} L ${px + g * 0.72} ${py} L ${px} ${py + g} L ${px - g * 0.72} ${py} Z`;
          return (
            <G key={i}>
              <Path d={d} fill={accent} stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={0.6} strokeLinejoin="round" />
              <Circle cx={px} cy={py - g * 0.35} r={g * 0.16} fill="#FFFFFF" opacity={0.85} />
            </G>
          );
        }
        if (k === "beads") {
          const r = Math.max(1, ringW * 0.16 * (orn.scale ?? 1));
          return (
            <G key={i}>
              <Circle cx={px} cy={py + r * 0.4} r={r} fill="#000000" opacity={0.25} />
              <Circle cx={px} cy={py} r={r} fill={accent} stroke={colors[0]} strokeWidth={0.5} />
              <Circle cx={px - r * 0.3} cy={py - r * 0.3} r={r * 0.25} fill="#FFFFFF" opacity={0.8} />
            </G>
          );
        }
        if (k === "dashes") {
          const x1 = c + Math.cos(a) * ringR * 0.72;
          const y1 = c + Math.sin(a) * ringR * 0.72;
          const x2 = c + Math.cos(a) * ringR * 1.1;
          const y2 = c + Math.sin(a) * ringR * 1.1;
          return (
            <Path
              key={i}
              d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`}
              stroke={accent}
              strokeWidth={Math.max(1, ringW * 0.13)}
              strokeLinecap="round"
            />
          );
        }
        if (k === "rays") {
          const x1 = c + Math.cos(a) * ringR * 0.45;
          const y1 = c + Math.sin(a) * ringR * 0.45;
          const x2 = c + Math.cos(a) * ringR * 1.25;
          const y2 = c + Math.sin(a) * ringR * 1.25;
          return (
            <Path
              key={i}
              d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`}
              stroke={glow}
              strokeOpacity={0.55}
              strokeWidth={Math.max(0.8, ringW * 0.09)}
              strokeLinecap="round"
            />
          );
        }
        if (k === "dots") {
          const mid = a + Math.PI / pts.length;
          const r = Math.max(0.9, ringW * 0.12 * (orn.scale ?? 1));
          const dx = c + Math.cos(mid) * ringR;
          const dy = c + Math.sin(mid) * ringR;
          return (
            <Circle key={i} cx={dx} cy={dy} r={r} fill={colors[0]} stroke={accent} strokeWidth={0.5} />
          );
        }
        if (k === "leaves") {
          const rx = Math.max(1.2, ringW * 0.42);
          const ry = rx * 0.45;
          return (
            <G key={i} rotation={(a * 180) / Math.PI + 90} origin={`${px}, ${py}`}>
              <Ellipse cx={px} cy={py} rx={rx} ry={ry} fill={accent} fillOpacity={0.85} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.5} />
            </G>
          );
        }
        return null;
      })}
    </G>
  );
}

export function ProfileFrame({
  size,
  hole,
  frame,
  animation,
  animationSpeed = "normal",
  animationIntensity = "medium",
  style,
}: {
  size: number;
  hole: number;
  frame: string;
  animation?: string | null;
  animationSpeed?: string | null;
  animationIntensity?: string | null;
  style?: any;
}) {
  const def = FRAME_STYLES[frame] || FRAME_STYLES.gold;
  const colors = def.colors;
  const glow = def.glow;
  const accent = def.accent;
  const shape: FrameShape = def.shape;
  const ornament: FrameOrnament = def.ornament;

  const c = size / 2;
  const outerR = size / 2 - 0.75;
  const innerR = hole / 2;
  const ringR = (outerR + innerR) / 2;
  const ringW = Math.max(2.5, outerR - innerR);

  const geom = shapePath(shape, c, ringR, ringW);
  const glowGeom = shapePath(shape, c, ringR + ringW * 0.55, ringW);
  const edgeGeom = shapePath(shape, c, innerR + ringW * 0.4, ringW);
  const ornPts =
    shape.kind === "ring"
      ? ringPoints(ornament.count ?? 12, c, ringR, 0)
      : geom.pts;

  let anim = animation || "off";
  if (anim === "spin") anim = "rotate";
  if (anim === "shine") anim = "shimmer";

  const speedM = ANIMATION_SPEEDS[(animationSpeed as AnimationSpeedId) || "normal"]?.multiplier ?? 1;
  const intensityM = ANIMATION_INTENSITIES[(animationIntensity as AnimationIntensityId) || "medium"]?.multiplier ?? 1;
  const duration = Math.max(400, Math.round((PERIODS[anim] ?? 3000) * speedM));

  const t = useSharedValue(0);

  useEffect(() => {
    if (anim === "off") {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.linear }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, [anim, duration, t]);

  const frameStyle = useAnimatedStyle(() => {
    const b = (Math.sin(t.value * Math.PI * 2) + 1) / 2;
    if (anim === "rotate") {
      return { transform: [{ rotate: `${t.value * 360}deg` }] };
    }
    if (anim === "pulse") {
      const p = Math.abs(Math.sin(t.value * Math.PI * 2));
      return { transform: [{ scale: 1 + p * 0.12 * intensityM }] };
    }
    if (anim === "neon") {
      const f = (Math.sin(t.value * Math.PI * 2 * 7) + Math.sin(t.value * Math.PI * 2 * 11 + 1.3) + 2) / 4;
      return { opacity: 0.55 + 0.45 * f };
    }
    if (anim === "sparkle") {
      const s = Math.sin(t.value * Math.PI * 2);
      return {
        opacity: interpolate(s, [-1, 0, 1], [0.7, 0.45, 1]),
        transform: [{ scale: 1 + Math.abs(s) * 0.03 * intensityM }],
      };
    }
    if (anim === "off") return { opacity: 1, transform: [{ scale: 1 }] };
    return {
      opacity: 1,
      transform: [{ scale: 1 }],
    };
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, frameStyle]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id={`pfGrad-${frame}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="0.5" stopColor={colors[1]} />
              <Stop offset="1" stopColor={colors[2]} />
            </LinearGradient>
            <LinearGradient id={`pfGlow-${frame}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={glow} stopOpacity="0.9" />
              <Stop offset="0.5" stopColor={glow} stopOpacity="0.45" />
              <Stop offset="1" stopColor={glow} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {/* outer glow */}
          {shape.kind === "ring" ? (
            <Circle
              cx={c}
              cy={c}
              r={ringR + ringW * 0.55}
              stroke={`url(#pfGlow-${frame})`}
              strokeWidth={ringW * 0.9}
              strokeOpacity={0.28}
              fill="none"
            />
          ) : (
            <Path
              d={glowGeom.d!}
              stroke={`url(#pfGlow-${frame})`}
              strokeWidth={ringW * 0.8}
              strokeOpacity={0.3}
              strokeLinejoin="round"
              fill="none"
            />
          )}

          {/* main gradient ring */}
          {shape.kind === "ring" ? (
            <Circle
              cx={c}
              cy={c}
              r={ringR}
              stroke={`url(#pfGrad-${frame})`}
              strokeWidth={ringW}
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <Path
              d={geom.d!}
              stroke={`url(#pfGrad-${frame})`}
              strokeWidth={ringW}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* top highlight arc */}
          <Path
            d={topArc(c, ringR, ringW)}
            stroke="#FFFFFF"
            strokeOpacity={0.45}
            strokeWidth={Math.max(1, ringW * 0.16)}
            strokeLinecap="round"
            fill="none"
          />

          {/* inner accent edge */}
          {shape.kind === "ring" ? (
            <Circle
              cx={c}
              cy={c}
              r={innerR + ringW * 0.4}
              stroke={colors[0]}
              strokeOpacity={0.65}
              strokeWidth={1}
              fill="none"
            />
          ) : (
            <Path
              d={edgeGeom.d!}
              stroke={colors[0]}
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeLinejoin="round"
              fill="none"
            />
          )}

          {/* decorative ornaments */}
          {renderOrnament(ornament, ornPts, c, ringR, ringW, colors, accent, glow)}
        </Svg>
      </Animated.View>

      <FXLayers
        anim={anim}
        t={t}
        size={size}
        hole={hole}
        colors={colors}
        intensity={intensityM}
      />
    </View>
  );
}

function shineArc(c: number, ringR: number): string {
  const arcY = c - Math.sqrt(Math.max(0, ringR * ringR - ringR * ringR * 0.55 * 0.55));
  return (
    `M ${c - ringR * 0.55} ${arcY}` +
    ` A ${ringR} ${ringR} 0 0 1 ${c + ringR * 0.55} ${arcY}`
  );
}

type FXProps = {
  anim: string;
  t: SharedValue<number>;
  size: number;
  hole: number;
  colors: string[];
  intensity: number;
};

function FXLayers({ anim, t, size, hole, colors, intensity }: FXProps) {
  if (anim === "off") return null;
  const c = size / 2;
  const outerR = size / 2 - 0.75;
  const innerR = hole / 2;
  const ringR = (outerR + innerR) / 2;
  const ringW = Math.max(2.5, outerR - innerR);
  const acc = colors[1];
  const k = Math.max(0.4, Math.min(1.4, size / 96));
  const fxCount = (base: number) => Math.max(3, Math.round(base * k));

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {anim === "glow" && <GlowFX t={t} size={size} outerR={outerR} ringW={ringW} colors={colors} intensity={intensity} />}
      {anim === "aura" && <AuraFX t={t} size={size} c={c} outerR={outerR} ringW={ringW} colors={colors} intensity={intensity} />}
      {anim === "shadow" && <ShadowFX t={t} size={size} c={c} outerR={outerR} ringW={ringW} intensity={intensity} />}
      {anim === "orbit" && <OrbitFX t={t} size={size} c={c} ringR={ringR} acc={acc} count={fxCount(3)} intensity={intensity} />}
      {anim === "sparkle" && <SparkleFX t={t} size={size} c={c} ringR={ringR} acc={acc} count={fxCount(5)} intensity={intensity} />}
      {anim === "particles" && <ParticlesFX t={t} size={size} c={c} colors={colors} count={fxCount(9)} intensity={intensity} />}
      {anim === "golden" && <ParticlesFX t={t} size={size} c={c} colors={["#FFE9A8", "#FFD700", "#FFF3C4"]} count={fxCount(11)} intensity={intensity} />}
      {anim === "magic" && <ParticlesFX t={t} size={size} c={c} colors={["#E9D8FF", "#D8B4FE", "#FFF6D8"]} count={fxCount(8)} intensity={intensity} />}
      {anim === "snow" && <ParticlesFX t={t} size={size} c={c} colors={["#FFFFFF", "#D6F3FF", "#9BD8FF"]} count={fxCount(9)} fall intensity={intensity} />}
      {anim === "fire" && <FireFX t={t} size={size} c={c} count={fxCount(6)} intensity={intensity} />}
      {anim === "phoenix" && <FireFX t={t} size={size} c={c} count={fxCount(7)} intensity={intensity} phoenix />}
      {anim === "dragon" && <FireFX t={t} size={size} c={c} count={fxCount(6)} intensity={intensity} dragon />}
      {anim === "lightning" && <LightningFX t={t} size={size} c={c} count={fxCount(3)} intensity={intensity} />}
      {anim === "frost" && <FrostFX t={t} size={size} c={c} ringR={ringR} count={fxCount(5)} intensity={intensity} />}
      {anim === "hearts" && <FloatGlyphsFX t={t} size={size} c={c} glyph="heart" color="#FF5C8A" count={fxCount(6)} intensity={intensity} rise />}
      {anim === "roses" && <FloatGlyphsFX t={t} size={size} c={c} glyph="flower" color="#FF7BAC" count={fxCount(5)} intensity={intensity} rise />}
      {anim === "sakura" && <FloatGlyphsFX t={t} size={size} c={c} glyph="flower" color="#FFB6D8" count={fxCount(6)} intensity={intensity} fall />}
      {anim === "butterfly" && <ButterflyFX t={t} size={size} c={c} ringR={ringR} count={2} intensity={intensity} />}
      {anim === "stars" && <SparkleFX t={t} size={size} c={c} ringR={ringR} acc={acc} count={fxCount(6)} intensity={intensity} stars />}
      {anim === "galaxy" && <GalaxyFX t={t} size={size} c={c} ringR={ringR} intensity={intensity} />}
      {anim === "meteor" && <MeteorFX t={t} size={size} c={c} count={2} intensity={intensity} />}
      {anim === "ripple" && <RippleFX t={t} size={size} c={c} acc={acc} intensity={intensity} />}
      {anim === "shimmer" && <BeamSweep t={t} size={size} c={c} ringR={ringR} ringW={ringW} color="#FFFFFF" width={0.42} count={1} intensity={intensity} />}
      {anim === "crystal" && <BeamSweep t={t} size={size} c={c} ringR={ringR} ringW={ringW} color="#FFFFFF" width={0.28} count={2} intensity={intensity} />}
      {anim === "rainbow" && <HueFX t={t} size={size} c={c} ringR={ringR} ringW={ringW} palette={HUES} intensity={intensity} />}
      {anim === "neon" && <NeonFX t={t} size={size} c={c} ringR={ringR} ringW={ringW} intensity={intensity} />}
      {anim === "holographic" && <HoloFX t={t} size={size} c={c} ringR={ringR} ringW={ringW} intensity={intensity} />}
      {anim === "angel" && <AngelFX t={t} size={size} c={c} ringR={ringR} ringW={ringW} intensity={intensity} />}
      {anim === "custom" && (
        <CustomFX t={t} size={size} c={c} ringR={ringR} ringW={ringW} colors={colors} intensity={intensity} />
      )}
    </View>
  );
}

function GlowFX({ t, size, outerR, ringW, colors, intensity }: { t: SharedValue<number>; size: number; outerR: number; ringW: number; colors: string[]; intensity: number }) {
  const c = size / 2;
  const g = useAnimatedProps(() => {
    const b = (Math.sin(t.value * Math.PI * 2) + 1) / 2;
    return {
      r: outerR + ringW * (0.3 + 0.6 * b),
      strokeOpacity: (0.2 + 0.5 * b) * intensity,
    };
  });
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <ACircle animatedProps={g} cx={c} cy={c} stroke={colors[1]} strokeWidth={ringW * 0.8} fill="none" />
    </Svg>
  );
}

function AuraFX({ t, size, c, outerR, ringW, colors, intensity }: { t: SharedValue<number>; size: number; c: number; outerR: number; ringW: number; colors: string[]; intensity: number }) {
  const g1 = useAnimatedProps(() => {
    const b = (Math.sin(t.value * Math.PI * 2) + 1) / 2;
    return { r: outerR + ringW * (0.4 + 1.1 * b), strokeOpacity: (0.18 + 0.5 * b) * intensity };
  });
  const g2 = useAnimatedProps(() => {
    const b = (Math.sin(t.value * Math.PI * 2 + 1.6) + 1) / 2;
    return { r: outerR + ringW * (0.4 + 1.1 * b), strokeOpacity: (0.18 + 0.5 * b) * intensity };
  });
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <ACircle animatedProps={g1} cx={c} cy={c} stroke={colors[0]} strokeWidth={ringW * 0.7} fill="none" />
      <ACircle animatedProps={g2} cx={c} cy={c} stroke={colors[2]} strokeWidth={ringW * 0.7} fill="none" />
    </Svg>
  );
}

function ShadowFX({ t, size, c, outerR, ringW, intensity }: { t: SharedValue<number>; size: number; c: number; outerR: number; ringW: number; intensity: number }) {
  const g = useAnimatedProps(() => {
    const b = (Math.sin(t.value * Math.PI * 2) + 1) / 2;
    return { strokeOpacity: (0.35 + 0.45 * b) * intensity };
  });
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <ACircle animatedProps={g} cx={c} cy={c} r={outerR + ringW * 0.7} stroke="#0B0E1A" strokeWidth={ringW * 1.1} fill="none" />
    </Svg>
  );
}

function OrbitFX({ t, size, c, ringR, acc, count, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; acc: string; count: number; intensity: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <Orb key={i} t={t} index={i} count={count} c={c} ringR={ringR} acc={acc} intensity={intensity} />
      ))}
    </Svg>
  );
}

function Orb({ t, index, count, c, ringR, acc, intensity }: { t: SharedValue<number>; index: number; count: number; c: number; ringR: number; acc: string; intensity: number }) {
  const p = useAnimatedProps(() => {
    const ang = t.value * Math.PI * 2 + (index / count) * Math.PI * 2;
    return {
      cx: c + Math.cos(ang) * ringR,
      cy: c + Math.sin(ang) * ringR,
      opacity: 0.5 + 0.5 * intensity,
    };
  });
  return <ACircle animatedProps={p} r={Math.max(2, ringR * 0.09)} fill={acc} />;
}

function SparkleFX({ t, size, c, ringR, acc, count, intensity, stars }: { t: SharedValue<number>; size: number; c: number; ringR: number; acc: string; count: number; intensity: number; stars?: boolean }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <GlyphFX
          key={i}
          t={t}
          index={i}
          count={count}
          glyph={stars ? "star" : "star-four-points"}
          color={stars ? "#FFF6D8" : acc}
          size={size * 0.14}
          box={size}
          c={c}
          radius={ringR}
          mode="twinkle"
          speed={stars ? 1.2 : 1}
          sway={stars ? 1.6 : 2}
          intensity={intensity}
        />
      ))}
    </Svg>
  );
}

function ParticlesFX({ t, size, c, colors, count, intensity, fall }: { t: SharedValue<number>; size: number; c: number; colors: string[]; count: number; intensity: number; fall?: boolean }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <ParticleDot
          key={i}
          t={t}
          index={i}
          count={count}
          size={size}
          color={colors[i % colors.length]}
          fall={fall}
          intensity={intensity}
        />
      ))}
    </Svg>
  );
}

function ParticleDot({ t, index, count, size, color, fall, intensity }: { t: SharedValue<number>; index: number; count: number; size: number; color: string; fall?: boolean; intensity: number }) {
  const p = useAnimatedProps(() => {
    const ph = (t.value + index / count) % 1;
    const y = fall ? ph * size : size - ph * size;
    const x = size / 2 + Math.sin(ph * Math.PI * 2 * 1.8 + index * 1.7) * size * 0.3;
    const o = Math.sin(ph * Math.PI);
    return {
      cx: x,
      cy: y,
      r: Math.max(1, size * 0.02) + o * size * 0.012 * intensity,
      opacity: Math.max(0, o) * Math.min(1, 0.55 + 0.45 * intensity),
    };
  });
  return <ACircle animatedProps={p} fill={color} />;
}

function FireFX({ t, size, c, count, intensity, phoenix, dragon }: { t: SharedValue<number>; size: number; c: number; count: number; intensity: number; phoenix?: boolean; dragon?: boolean }) {
  const colors = phoenix ? ["#FFD700", "#FF8C42", "#FF5E3A"] : dragon ? ["#4DFF88", "#0FA3A3", "#B8FFC9"] : ["#FF8C42", "#FFB347", "#FF3D00"];
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <GlyphFX
          key={i}
          t={t}
          index={i}
          count={count}
          glyph="fire"
          color={colors[i % colors.length]}
          size={size * 0.2}
          box={size}
          c={c}
          mode="rise"
          speed={phoenix ? 0.8 : dragon ? 0.9 : 1}
          sway={phoenix ? 1 : 1.4}
          intensity={intensity}
        />
      ))}
    </Svg>
  );
}

function FloatGlyphsFX({ t, size, c, glyph, color, count, intensity, rise, fall }: { t: SharedValue<number>; size: number; c: number; glyph: string; color: string; count: number; intensity: number; rise?: boolean; fall?: boolean }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <GlyphFX
          key={i}
          t={t}
          index={i}
          count={count}
          glyph={glyph}
          color={color}
          size={size * 0.18}
          box={size}
          c={c}
          mode={rise ? "rise" : "fall"}
          speed={0.8}
          sway={1.6}
          intensity={intensity}
        />
      ))}
    </Svg>
  );
}

function ButterflyFX({ t, size, c, ringR, count, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; count: number; intensity: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <GlyphFX
          key={i}
          t={t}
          index={i}
          count={count}
          glyph="butterfly"
          color={i === 0 ? "#FF7BAC" : "#7DD3FC"}
          size={size * 0.16}
          box={size}
          c={c}
          radius={ringR}
          mode="flutter"
          speed={0.7}
          intensity={intensity}
        />
      ))}
    </Svg>
  );
}

function LightningFX({ t, size, c, count, intensity }: { t: SharedValue<number>; size: number; c: number; count: number; intensity: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <BoltGlyph key={i} t={t} index={i} count={count} size={size} c={c} intensity={intensity} />
      ))}
    </Svg>
  );
}

function BoltGlyph({ t, index, count, size, c, intensity }: { t: SharedValue<number>; index: number; count: number; size: number; c: number; intensity: number }) {
  const { d, cx, cy } = resolveIconPath("flash");
  const p = useAnimatedProps(() => {
    const ph = (t.value + index * 0.11) % 1;
    const on = ph < 0.18;
    const o = on ? (ph < 0.05 ? 0.95 : 0.5) * intensity : 0;
    const ang = (index / count) * Math.PI * 2 + Math.sin(t.value * Math.PI * 2 * 3) * 0.3;
    const rr = size * 0.42;
    const x = c + Math.cos(ang) * rr;
    const y = c + Math.sin(ang) * rr;
    const rot = (ang * 180) / Math.PI + 90;
    const s = size * 0.16 / 512;
    return { transform: `translate(${x},${y}) rotate(${rot}) scale(${s}) translate(${-cx},${-cy})`, opacity: Math.max(0, Math.min(1, o)) };
  });
  return (
    <AG animatedProps={p}>
      <APath d={d} fill="#E8F6FF" />
    </AG>
  );
}

function FrostFX({ t, size, c, ringR, count, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; count: number; intensity: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => (
        <GlyphFX
          key={i}
          t={t}
          index={i}
          count={count}
          glyph="snowflake"
          color="#D6F3FF"
          size={size * 0.15}
          box={size}
          c={c}
          radius={ringR}
          mode="twinkle"
          speed={0.8}
          sway={2.4}
          intensity={intensity}
        />
      ))}
    </Svg>
  );
}

function GalaxyFX({ t, size, c, ringR, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; intensity: number }) {
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360}deg` }] }));
  const dots = ringDots(16, ringR);
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, rot]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        {dots.map((_, i) => {
          const r = ringR * (0.5 + (i % 3) * 0.22);
          const a = (i / dots.length) * Math.PI * 2 + (i % 2) * 0.4;
          const x = c + Math.cos(a) * r;
          const y = c + Math.sin(a) * r;
          const rr = i % 2 ? size * 0.012 : size * 0.018;
          return <Circle key={i} cx={x} cy={y} r={rr} fill={i % 3 === 0 ? "#C7B8FF" : "#8A7BFF"} opacity={0.5 + 0.5 * intensity} />;
        })}
        <Circle cx={c} cy={c} r={ringR * 0.16} fill="#F0EAFF" opacity={0.7} />
      </Svg>
    </Animated.View>
  );
}

function MeteorFX({ t, size, c, count, intensity }: { t: SharedValue<number>; size: number; c: number; count: number; intensity: number }) {
  const p = useAnimatedProps(() => {
    const ph = (t.value + 0.5) % 1;
    const on = ph < 0.3;
    const o = on ? Math.sin((ph / 0.3) * Math.PI) * intensity : 0;
    const x = lerp(size * 0.05, size * 0.95, ph * 1.4 - 0.2);
    const y = lerp(size * 0.05, size * 0.95, ph * 1.4 - 0.2);
    return {
      d: `M ${x} ${y} L ${x - size * 0.14} ${y - size * 0.14}`,
      opacity: Math.max(0, o),
    };
  });
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }, (_, i) => (
        <APath key={i} animatedProps={p} stroke="#FFF3C4" strokeWidth={Math.max(1.5, size * 0.018)} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

function RippleFX({ t, size, c, acc, intensity }: { t: SharedValue<number>; size: number; c: number; acc: string; intensity: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      {[0, 1, 2].map((i) => (
        <RippleRing key={i} t={t} index={i} size={size} c={c} acc={acc} intensity={intensity} />
      ))}
    </Svg>
  );
}

function RippleRing({ t, index, size, c, acc, intensity }: { t: SharedValue<number>; index: number; size: number; c: number; acc: string; intensity: number }) {
  const p = useAnimatedProps(() => {
    const ph = (t.value + index / 3) % 1;
    return {
      r: interpolate(ph, [0, 1], [size * 0.06, size * 0.48]),
      strokeOpacity: (1 - ph) * 0.5 * intensity,
    };
  });
  return <ACircle animatedProps={p} cx={c} cy={c} stroke={acc} strokeWidth={Math.max(1, size * 0.015)} fill="none" />;
}

function BeamSweep({ t, size, c, ringR, ringW, color, width, count, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; ringW: number; color: string; width: number; count: number; intensity: number }) {
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360}deg` }] }));
  const arc = shineArc(c, ringR);
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, rot]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        {Array.from({ length: count }).map((_, i) => (
          <Path
            key={i}
            d={arc}
            stroke={color}
            strokeOpacity={0.9 * Math.min(1, intensity)}
            strokeWidth={ringW * width}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(${(i * 180) / count} ${c} ${c})`}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

function HueFX({ t, size, c, ringR, ringW, palette, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; ringW: number; palette: string[]; intensity: number }) {
  const pts = palette.map((_, i) => i / (palette.length - 1));
  const p = useAnimatedProps(() => ({
    stroke: interpolateColor(t.value, pts, palette),
    strokeOpacity: 0.85 * Math.min(1, intensity),
  }));
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <ACircle animatedProps={p} cx={c} cy={c} r={ringR} strokeWidth={ringW * 0.8} fill="none" />
    </Svg>
  );
}

function NeonFX({ t, size, c, ringR, ringW, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; ringW: number; intensity: number }) {
  const p = useAnimatedProps(() => {
    const f = (Math.sin(t.value * Math.PI * 2 * 7) + Math.sin(t.value * Math.PI * 2 * 11 + 1.3) + 2) / 4;
    return {
      stroke: interpolateColor(t.value, [0, 0.5, 1], NEON_COLORS),
      strokeOpacity: (0.4 + 0.6 * f) * intensity,
    };
  });
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <ACircle animatedProps={p} cx={c} cy={c} r={ringR} strokeWidth={ringW * 0.55} fill="none" />
    </Svg>
  );
}

function HoloFX({ t, size, c, ringR, ringW, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; ringW: number; intensity: number }) {
  const pts = HOLO.map((_, i) => i / (HOLO.length - 1));
  const ring = useAnimatedProps(() => ({
    stroke: interpolateColor(t.value, pts, HOLO),
    strokeOpacity: 0.7 * Math.min(1, intensity),
  }));
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360}deg` }] }));
  return (
    <>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <ACircle animatedProps={ring} cx={c} cy={c} r={ringR} strokeWidth={ringW * 0.8} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFillObject, rot]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
          <ARect x={c - size * 0.28} y={c - size * 0.36} width={size * 0.09} height={size * 0.72} fill="#7DF9FF" opacity={0.14} rx={2} />
          <ARect x={c + size * 0.19} y={c - size * 0.36} width={size * 0.09} height={size * 0.72} fill="#FF6BD6" opacity={0.14} rx={2} />
        </Svg>
      </Animated.View>
    </>
  );
}

function AngelFX({ t, size, c, ringR, ringW, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; ringW: number; intensity: number }) {
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360}deg` }] }));
  const g = useAnimatedProps(() => {
    const b = (Math.sin(t.value * Math.PI * 2) + 1) / 2;
    return { strokeOpacity: (0.15 + 0.4 * b) * intensity };
  });
  const rays = Array.from({ length: 8 }).map((_, i) => (i / 8) * Math.PI * 2);
  return (
    <>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <ACircle animatedProps={g} cx={c} cy={c} r={ringR} stroke="#FFF3C4" strokeWidth={ringW * 0.4} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFillObject, rot]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
          {rays.map((a, i) => {
            const x1 = c + Math.cos(a) * ringR * 0.7;
            const y1 = c + Math.sin(a) * ringR * 0.7;
            const x2 = c + Math.cos(a) * ringR * 1.15;
            const y2 = c + Math.sin(a) * ringR * 1.15;
            return <Path key={i} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#FFF6D8" strokeWidth={Math.max(1, ringR * 0.03)} strokeOpacity={0.5 * Math.min(1, intensity)} strokeLinecap="round" />;
          })}
        </Svg>
      </Animated.View>
    </>
  );
}

function CustomFX({ t, size, c, ringR, ringW, colors, intensity }: { t: SharedValue<number>; size: number; c: number; ringR: number; ringW: number; colors: string[]; intensity: number }) {
  const glow = useAnimatedProps(() => {
    const b = (Math.sin(t.value * Math.PI * 2) + 1) / 2;
    return { strokeOpacity: (0.2 + 0.45 * b) * intensity };
  });
  return (
    <>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <ACircle animatedProps={glow} cx={c} cy={c} r={ringR + ringW * 0.7} stroke={colors[1]} strokeWidth={ringW * 0.7} fill="none" />
        <Orb t={t} index={0} count={3} c={c} ringR={ringR} acc={colors[0]} intensity={intensity} />
      </Svg>
      <BeamSweep t={t} size={size} c={c} ringR={ringR} ringW={ringW} color="#FFFFFF" width={0.35} count={1} intensity={intensity} />
    </>
  );
}

function GlyphFX({
  t, index, count, glyph, color, size, box, c, radius, mode, speed = 1, sway = 2, intensity,
}: {
  t: SharedValue<number>;
  index: number;
  count: number;
  glyph: string;
  color: string;
  size: number;
  box: number;
  c: number;
  radius?: number;
  mode: "rise" | "fall" | "orbit" | "twinkle" | "flutter";
  speed?: number;
  sway?: number;
  intensity: number;
}) {
  const { d, cx, cy } = resolveIconPath(glyph);
  const s = size / 512;
  const p = useAnimatedProps(() => {
    const ph = (t.value * speed + index / count) % 1;
    let x = c;
    let y = c;
    let rot = 0;
    let o = 1;
    let sx = 1;
    let sy = 1;
    if (mode === "rise") {
      y = box - ph * box;
      x = c + Math.sin(ph * Math.PI * 2 * sway + index * 1.7) * box * 0.3;
      o = Math.sin(ph * Math.PI);
    } else if (mode === "fall") {
      y = ph * box - size * 0.5;
      x = c + Math.sin(ph * Math.PI * 2 * sway + index * 1.3) * box * 0.32;
      o = Math.sin(ph * Math.PI);
      rot = ph * 360;
    } else if (mode === "orbit") {
      const ang = ph * Math.PI * 2 + (index / count) * Math.PI * 2;
      x = c + Math.cos(ang) * (radius ?? box * 0.4);
      y = c + Math.sin(ang) * (radius ?? box * 0.4);
      rot = (ang * 180) / Math.PI + 90;
      o = 0.7 + 0.3 * Math.sin(ph * Math.PI * 2 * sway);
    } else if (mode === "flutter") {
      const ang = ph * Math.PI * 2 + (index / count) * Math.PI * 2;
      x = c + Math.cos(ang) * (radius ?? box * 0.42);
      y = c + Math.sin(ang) * (radius ?? box * 0.42);
      rot = (ang * 180) / Math.PI - 90;
      sx = 0.5 + 0.5 * Math.abs(Math.sin(ph * Math.PI * 2 * 4));
      o = 0.85;
    } else {
      const ang = (index / count) * Math.PI * 2;
      x = c + Math.cos(ang) * (radius ?? box * 0.42);
      y = c + Math.sin(ang) * (radius ?? box * 0.42);
      const tw = (Math.sin(ph * Math.PI * 2 * sway) + 1) / 2;
      o = 0.15 + 0.85 * tw;
      rot = ph * 360;
    }
    return {
      transform: `translate(${x},${y}) rotate(${rot}) scale(${s * sx},${s * sy}) translate(${-cx},${-cy})`,
      opacity: Math.max(0, Math.min(1, o * Math.min(1, 0.5 + 0.5 * intensity))),
    };
  });
  return (
    <AG animatedProps={p}>
      <APath d={d} fill={color} />
    </AG>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});

