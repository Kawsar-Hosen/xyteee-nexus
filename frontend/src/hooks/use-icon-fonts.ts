// Icon font loader for Expo apps. Fonts are loaded from a CDN on all platforms.
// Web: react-native-vector-icons autolinking doesn't generate @font-face CSS
// in production builds, so we explicitly load via expo-font from CDN.
// Native: TTF bytes come back 0 from Metro's asset resolver on Android,
// so CDN is used there too.
// ICON_VECTOR_VERSION must match @expo/vector-icons in package.json.
// Usage: const [loaded, error] = useIconFonts();

import { useFonts } from "expo-font";

const ICON_VECTOR_VERSION = "15.1.1";

// short internal fontName (what the library queries) -> CDN .ttf file name
const ICON_FAMILIES: Record<string, string> = {
  anticon: "AntDesign",
  entypo: "Entypo",
  evilicons: "EvilIcons",
  feather: "Feather",
  FontAwesome: "FontAwesome",
  Fontisto: "Fontisto",
  foundation: "Foundation",
  ionicons: "Ionicons",
  "material-community": "MaterialCommunityIcons",
  material: "MaterialIcons",
  octicons: "Octicons",
  "simple-line-icons": "SimpleLineIcons",
  zocial: "Zocial",
  // FontAwesome5 style variants (key = `FontAwesome5Free-<style>`)
  "FontAwesome5Free-Regular": "FontAwesome5_Regular",
  "FontAwesome5Free-Solid": "FontAwesome5_Solid",
  "FontAwesome5Free-Brand": "FontAwesome5_Brands",
  // FontAwesome6 style variants (key = `FontAwesome6Free-<style>`)
  "FontAwesome6Free-Regular": "FontAwesome6_Regular",
  "FontAwesome6Free-Solid": "FontAwesome6_Solid",
  "FontAwesome6Free-Brand": "FontAwesome6_Brands",
};

const cdnUrl = (file: string): string =>
  `https://cdn.jsdelivr.net/npm/@expo/vector-icons@${ICON_VECTOR_VERSION}/build/vendor/react-native-vector-icons/Fonts/${file}.ttf`;

const iconFontMap = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ICON_FAMILIES).map(([key, file]) => [key, cdnUrl(file)]),
  );

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts(
    // Expo Go: load from CDN. Web: also load from CDN because
    // react-native-vector-icons autolinking doesn't generate @font-face
    // CSS in production web builds. Native non-Expo Go: CDN as well
    // (TTF bytes come back 0 from Metro on Android dev).
    iconFontMap(),
  );
