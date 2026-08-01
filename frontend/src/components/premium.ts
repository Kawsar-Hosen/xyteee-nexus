/**
 * Premium profile system config — badges, custom icons, animated frames,
 * achievement levels. Shared by VerifiedBadge, Avatar and the Admin Panel.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FRAME_STYLES } from "./frameLibrary";

export type BadgeType = "blue" | "gold" | "gray";

export const BADGE_COLORS: Record<string, string> = {
  blue: "#1D9BF0",
  gold: "#C9A227",
  gray: "#829AAB",
};

export const BADGE_ICONS: Record<string, string> = {
  "check-decagram": "check-decagram",
  crown: "crown",
  star: "star",
  fire: "fire",
  "diamond-stone": "diamond-stone",
  gem: "gem",
  "shield-star": "shield-star",
  trophy: "trophy",
  heart: "heart",
  flash: "flash",
};

export const BADGE_ICON_LABELS: Record<string, string> = {
  "check-decagram": "Verified",
  crown: "Crown",
  star: "Star",
  fire: "Flame",
  "diamond-stone": "Diamond",
  gem: "Gem",
  "shield-star": "Shield",
  trophy: "Trophy",
  heart: "Heart",
  flash: "Bolt",
};

export type ProfileFrameId = string;

export {
  FRAME_LIBRARY,
  FRAME_IDS,
  FRAME_STYLES,
  FRAME_THEMES,
} from "./frameLibrary";
export type {
  FrameDef,
  FrameShape,
  FrameShapeKind,
  FrameOrnament,
  FrameOrnamentKind,
} from "./frameLibrary";

export type ProfileAnimationId =
  | "off"
  | "glow"
  | "pulse"
  | "rotate"
  | "sparkle"
  | "aura"
  | "orbit"
  | "particles"
  | "shimmer"
  | "rainbow"
  | "neon"
  | "fire"
  | "lightning"
  | "frost"
  | "magic"
  | "butterfly"
  | "sakura"
  | "roses"
  | "golden"
  | "snow"
  | "hearts"
  | "stars"
  | "galaxy"
  | "meteor"
  | "ripple"
  | "crystal"
  | "phoenix"
  | "dragon"
  | "angel"
  | "shadow"
  | "holographic"
  | "custom";

export type ProfileAnimationConfig = {
  label: string;
  icon: string;
  description: string;
  group?: string;
};

export const PROFILE_ANIMATIONS: Record<string, ProfileAnimationConfig> = {
  off: { label: "Off", icon: "pause", description: "Static frame, no animation" },
  // Core
  glow: { label: "Glow", icon: "weather-sunset", description: "Soft breathing glow around the ring", group: "Core" },
  pulse: { label: "Pulse", icon: "heart-pulse", description: "Steady heartbeat ring expansion", group: "Core" },
  rotate: { label: "Rotate", icon: "rotate-3d-variant", description: "Ring slowly rotates with the beads", group: "Core" },
  sparkle: { label: "Sparkle", icon: "star-four-points", description: "Frame twinkles like a star", group: "Core" },
  shimmer: { label: "Shimmer", icon: "white-balance-sunny", description: "Bright highlight sweeps around the ring", group: "Core" },
  neon: { label: "Neon Flicker", icon: "lightbulb-on-outline", description: "Neon tube flicker with color cycling", group: "Core" },
  // Aura
  aura: { label: "Aura", icon: "orbit-variant", description: "Radiant pulsing halo around the frame", group: "Aura" },
  shadow: { label: "Dark Shadow", icon: "moon-waning-crescent", description: "Breathing dark edge / shadow aura", group: "Aura" },
  crystal: { label: "Crystal Shine", icon: "diamond-stone", description: "Sharp prismatic beam sweep", group: "Aura" },
  holographic: { label: "Holographic", icon: "shimmer", description: "Iridescent color-shifting overlay", group: "Aura" },
  rainbow: { label: "Rainbow Shift", icon: "chart-arc", description: "Ring cycles through rainbow hues", group: "Aura" },
  // Elements
  fire: { label: "Fire Flames", icon: "fire", description: "Flickering flames rise from the bottom", group: "Elements" },
  lightning: { label: "Electric Lightning", icon: "lightning-bolt", description: "Jagged bolts flash around the ring", group: "Elements" },
  frost: { label: "Ice Frost", icon: "snowflake-variant", description: "Frosty crystals shimmer over the frame", group: "Elements" },
  snow: { label: "Snow", icon: "weather-snowy-heavy", description: "Soft snowflakes drift downward", group: "Elements" },
  phoenix: { label: "Phoenix Fire", icon: "fire-circle", description: "Golden-orange embers rise like rebirth", group: "Elements" },
  dragon: { label: "Dragon Aura", icon: "snake", description: "Mystical green flame aura", group: "Elements" },
  ripple: { label: "Water Ripple", icon: "water-outline", description: "Expanding ripples from the center", group: "Elements" },
  // Cosmic
  orbit: { label: "Orbit", icon: "orbit", description: "Orbs circle the ring in orbit", group: "Cosmic" },
  stars: { label: "Stars", icon: "star", description: "Twinkling stars around the frame", group: "Cosmic" },
  galaxy: { label: "Galaxy Rotation", icon: "weather-night", description: "Spinning spiral of cosmic dust", group: "Cosmic" },
  meteor: { label: "Meteor", icon: "star-shooting", description: "Shooting meteors streak across", group: "Cosmic" },
  // Living & Particles
  particles: { label: "Floating Particles", icon: "dots-hexagon", description: "Gentle motes drift upward", group: "Living" },
  magic: { label: "Magic Dust", icon: "auto-fix", description: "Enchanted golden dust shimmers", group: "Living" },
  golden: { label: "Golden Particles", icon: "gold", description: "Luxurious gold particles rise", group: "Living" },
  butterfly: { label: "Butterfly Flight", icon: "butterfly", description: "Butterflies flutter around the ring", group: "Living" },
  sakura: { label: "Sakura Petals", icon: "flower", description: "Pink petals fall softly", group: "Living" },
  roses: { label: "Floating Roses", icon: "flower-poppy", description: "Rose blossoms drift upward", group: "Living" },
  hearts: { label: "Hearts", icon: "heart", description: "Hearts float up lovingly", group: "Living" },
  // Divine
  angel: { label: "Angel Light", icon: "weather-sunny", description: "Heavenly light rays and radiance", group: "Divine" },
  // Custom
  custom: { label: "Custom FX", icon: "palette", description: "Tasteful glow + shimmer + orbit mix", group: "Custom" },
};

export const PROFILE_ANIMATION_IDS = Object.keys(PROFILE_ANIMATIONS);

export const ANIMATION_GROUPS = [
  "Core",
  "Aura",
  "Elements",
  "Cosmic",
  "Living",
  "Divine",
  "Custom",
];

export type AnimationSpeedId = "slow" | "normal" | "fast";
export type AnimationIntensityId = "low" | "medium" | "high";

export const ANIMATION_SPEEDS: Record<AnimationSpeedId, { label: string; multiplier: number }> = {
  slow: { label: "Slow", multiplier: 1.6 },
  normal: { label: "Normal", multiplier: 1 },
  fast: { label: "Fast", multiplier: 0.55 },
};

export const ANIMATION_SPEED_IDS: AnimationSpeedId[] = ["slow", "normal", "fast"];

export const ANIMATION_INTENSITIES: Record<AnimationIntensityId, { label: string; multiplier: number }> = {
  low: { label: "Low", multiplier: 0.55 },
  medium: { label: "Medium", multiplier: 1 },
  high: { label: "High", multiplier: 1.5 },
};

export const ANIMATION_INTENSITY_IDS: AnimationIntensityId[] = ["low", "medium", "high"];

export type AchievementId = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export const ACHIEVEMENTS: Record<
  AchievementId,
  { color: string; label: string; icon: string }
> = {
  bronze: { color: "#CD7F32", label: "Bronze", icon: "medal" },
  silver: { color: "#C0C0C0", label: "Silver", icon: "medal" },
  gold: { color: "#F4C430", label: "Gold", icon: "medal" },
  platinum: { color: "#7DD3FC", label: "Platinum", icon: "medal" },
  diamond: { color: "#B9F2FF", label: "Diamond", icon: "shield-star" },
};

export const ACHIEVEMENT_IDS: AchievementId[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
];

export function badgeIconName(icon?: string | null): string {
  return icon && BADGE_ICONS[icon] ? icon : "check-decagram";
}

export function frameColors(frame?: string | null): [string, string, string] | null {
  if (!frame) return null;
  return FRAME_STYLES[frame as ProfileFrameId]?.colors || null;
}

export function achievementColor(level?: string | null): string | null {
  if (!level) return null;
  return ACHIEVEMENTS[level as AchievementId]?.color || null;
}

export function badgeExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return exp <= Date.now();
}

export type PremiumUser = {
  badge_type?: string | null;
  badge_icon?: string | null;
  badge_expires_at?: string | null;
  profile_frame?: string | null;
  achievement_level?: string | null;
  profile_animation?: string | null;
  profile_animation_speed?: string | null;
  profile_animation_intensity?: string | null;
  profile_animation_expires_at?: string | null;
};

export { MaterialCommunityIcons };
