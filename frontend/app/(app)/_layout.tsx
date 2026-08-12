import React, { lazy, Suspense, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { AIChatProvider } from "@/src/context/AIChatContext";

const AIChatBox = lazy(() => import("@/src/components/AIChatBox").then(m => ({ default: m.AIChatBox })));

type Tab = {
  key: string;
  path: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconFilled: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
};

const TABS: Tab[] = [
  { key: "feed", path: "/(app)/feed", icon: "home-outline", iconFilled: "home", label: "Feed" },
  { key: "search", path: "/(app)/search", icon: "compass-outline", iconFilled: "compass", label: "Find" },
  { key: "reels", path: "/(app)/reels", icon: "movie-open-outline", iconFilled: "movie-open", label: "Reels" },
  { key: "friends", path: "/(app)/friends", icon: "heart-outline", iconFilled: "heart", label: "Bonds" },
  { key: "profile", path: "/(app)/profile", icon: "account-outline", iconFilled: "account", label: "You" },
];

export default function AppLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();

  const active = useMemo(() => {
    const found = TABS.find((t) => path?.includes(`/${t.key}`));
    return found?.key || "feed";
  }, [path]);

  return (
    <AIChatProvider>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      {/* AI chat overlay — rendered above all content */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        <Suspense fallback={null}>
          <AIChatBox />
        </Suspense>
      </View>
      <View style={styles.dockWrap} pointerEvents="box-none">
        <View
          style={[
            styles.dockBg,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {TABS.map((t) => {
            const isActive = active === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                testID={`tab-${t.key}`}
                activeOpacity={0.7}
                onPress={() => router.replace(t.path as any)}
                style={styles.dockItem}
              >
                <DockIcon
                  active={isActive}
                  icon={t.icon}
                  iconFilled={t.iconFilled}
                  color={colors.primary}
                  muted={colors.mutedFg}
                />
                <NxText
                  variant="caption"
                  style={{
                    color: isActive ? colors.foreground : colors.mutedFg,
                    fontWeight: isActive ? "600" : "400",
                    fontSize: 10.5,
                    marginTop: 2,
                  }}
                >
                  {t.label}
                </NxText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
    </AIChatProvider>
  );
}

function DockIcon({
  active,
  icon,
  iconFilled,
  color,
  muted,
}: {
  active: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconFilled: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  muted: string;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(active ? -1.5 : 0, { damping: 16 }) }],
  }));

  return (
    <Animated.View
      style={[
        styles.iconPill,
        { backgroundColor: active ? `${color}1A` : "transparent" },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={active ? iconFilled : icon}
        size={22}
        color={active ? color : muted}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  dockBg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    width: "100%",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dockItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  iconPill: {
    width: 46,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
