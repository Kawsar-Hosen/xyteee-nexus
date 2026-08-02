// Icon font loader for Expo apps.
// Web: only load the 2 families actually used (Feather + MaterialCommunityIcons).
// Loading all 19 families from CDN causes timeouts on web.
// Native: load all families from CDN (Metro asset resolver returns 0 bytes on Android).
// ICON_VECTOR_VERSION must match @expo/vector-icons in package.json.
// Usage: const [loaded, error] = useIconFonts();

import { Platform } from "react-native";
import { useFonts } from "expo-font";

const ICON_VECTOR_VERSION = "15.1.1";

// short internal fontName (what the library queries) -> CDN .ttf file name
const ALL_ICON_FAMILIES: Record<string, string> = {
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
  "FontAwesome5Free-Regular": "FontAwesome5_Regular",
  "FontAwesome5Free-Solid": "FontAwesome5_Solid",
  "FontAwesome5Free-Brand": "FontAwesome5_Brands",
  "FontAwesome6Free-Regular": "FontAwesome6_Regular",
  "FontAwesome6Free-Solid": "FontAwesome6_Solid",
  "FontAwesome6Free-Brand": "FontAwesome6_Brands",
};

// Only the 2 families actually imported in the codebase
const WEB_ICON_FAMILIES: Record<string, string> = {
  feather: "Feather",
  "material-community": "MaterialCommunityIcons",
};

const cdnUrl = (file: string): string =>
  `https://cdn.jsdelivr.net/npm/@expo/vector-icons@${ICON_VECTOR_VERSION}/build/vendor/react-native-vector-icons/Fonts/${file}.ttf`;

const buildFontMap = (families: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(families).map(([key, file]) => [key, cdnUrl(file)]),
  );

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts(
    Platform.OS === "web"
      ? buildFontMap(WEB_ICON_FAMILIES)
      : buildFontMap(ALL_ICON_FAMILIES),
  );
