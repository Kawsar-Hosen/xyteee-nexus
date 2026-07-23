import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { AIChatBox } from "@/src/components/AIChatBox";
import { spacing } from "@/src/theme";

type Tab = { key: string; path: string; icon: keyof typeof Feather.glyphMap; label: string };

const TABS: Tab[] = [
  { key: "feed", path: "/(app)/feed", icon: "layers", label: "Feed" },
  { key: "search", path: "/(app)/search", icon: "search", label: "Find" },
  { key: "nexus", path: "/(app)/nexus", icon: "plus", label: "Nexus" },
  { key: "friends", path: "/(app)/friends", icon: "users", label: "Bonds" },
  { key: "profile", path: "/(app)/profile", icon: "user", label: "You" },
];

export default function AppLayout() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();

  const active = useMemo(() => {
    const found = TABS.find((t) => path?.includes(`/${t.key}`));
    return found?.key || "feed";
  }, [path]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <AIChatBox />
      <SafeAreaView edges={["bottom"]} style={styles.dockWrap} pointerEvents="box-none">
        <View style={styles.dockShell} pointerEvents="box-none">
          <BlurView
            intensity={Platform.OS === "ios" ? 60 : 30}
            tint={mode === "dark" ? "dark" : "light"}
            style={[styles.dockBg, { backgroundColor: colors.glass, borderColor: colors.border }]}
          >
            {TABS.map((t) => {
              const isActive = active === t.key;
              const isCenter = t.key === "nexus";
              return (
                <TouchableOpacity
                  key={t.key}
                  testID={`tab-${t.key}`}
                  activeOpacity={0.8}
                  onPress={() => router.replace(t.path as any)}
                  style={[
                    styles.dockItem,
                    isCenter && { transform: [{ translateY: -12 }] },
                  ]}
                >
                  <DockDot
                    active={isActive}
                    isCenter={isCenter}
                    color={colors.primary}
                    onPrimary={colors.onPrimary}
                    fg={colors.foreground}
                    muted={colors.mutedFg}
                    icon={t.icon}
                  />
                  {!isCenter && (
                    <NxText
                      variant="caption"
                      style={{ color: isActive ? colors.primary : colors.mutedFg, marginTop: 4 }}
                    >
                      {t.label}
                    </NxText>
                  )}
                </TouchableOpacity>
              );
            })}
          </BlurView>
        </View>
        <View style={{ height: Math.max(insets.bottom, 8) }} />
      </SafeAreaView>
    </View>
  );
}

function DockDot({
  active,
  isCenter,
  color,
  onPrimary,
  fg,
  muted,
  icon,
}: {
  active: boolean;
  isCenter: boolean;
  color: string;
  onPrimary: string;
  fg: string;
  muted: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(active ? 1.06 : 1, { damping: 15 }) }],
  }));

  if (isCenter) {
    return (
      <Animated.View style={[styles.centerDot, { backgroundColor: color }, style]}>
        <Feather name={icon} size={22} color={onPrimary} />
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[styles.dot, style]}>
      <Feather name={icon} size={20} color={active ? color : muted} />
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
  dockShell: { width: "100%", alignItems: "center", paddingHorizontal: spacing.lg },
  dockBg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 32,
    borderWidth: 1,
    width: "100%",
    maxWidth: 460,
    overflow: "hidden",
  },
  dockItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  centerDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
