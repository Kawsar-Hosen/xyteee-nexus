/**
 * XYTEEE Nexus theme tokens.
 * Luxury / MD3 hybrid — Obsidian + Liquid Gold.
 */

export type ThemeMode = "dark" | "light";

export const palette = {
  dark: {
    background: "#070709",
    backgroundElevated: "#0F0F14",
    surface: "#121217",
    surfaceHigh: "#1B1B22",
    foreground: "#F1EFE7",
    mutedFg: "#8B8D98",
    primary: "#CFA876", // liquid gold
    primaryDeep: "#9B6A38",
    onPrimary: "#070709",
    secondary: "#1E1E24",
    accent: "#2A2A35",
    border: "#2A2A35",
    borderStrong: "#3A3A47",
    danger: "#E05D50",
    success: "#7DC48A",
    online: "#7DC48A",
    bubbleSent: "#CFA876",
    bubbleSentFg: "#070709",
    bubbleRecv: "#1E1E24",
    bubbleRecvFg: "#F1EFE7",
    overlay: "rgba(0,0,0,0.6)",
    glass: "rgba(15,15,20,0.72)",
  },
  light: {
    background: "#FAFAFA",
    backgroundElevated: "#FFFFFF",
    surface: "#F1EFEA",
    surfaceHigh: "#E9E7E1",
    foreground: "#0A0A0A",
    mutedFg: "#6B6B75",
    primary: "#9B6A38",
    primaryDeep: "#6E4A25",
    onPrimary: "#FAFAFA",
    secondary: "#E5E4E0",
    accent: "#E5E4E0",
    border: "#DCDCD6",
    borderStrong: "#C4C3BE",
    danger: "#8A2C21",
    success: "#3B7F4F",
    online: "#3B7F4F",
    bubbleSent: "#9B6A38",
    bubbleSentFg: "#FAFAFA",
    bubbleRecv: "#E5E4E0",
    bubbleRecvFg: "#0A0A0A",
    overlay: "rgba(0,0,0,0.55)",
    glass: "rgba(250,250,250,0.82)",
  },
};

export type ThemePalette = typeof palette.dark;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const fonts = {
  display: "PlayfairDisplay",
  displayItalic: "PlayfairDisplay-Italic",
  body: "Outfit",
  bodyMedium: "Outfit-Medium",
  bodySemi: "Outfit-SemiBold",
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};
