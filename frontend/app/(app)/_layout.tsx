import React, { lazy, Suspense, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { AIChatProvider } from "@/src/context/AIChatContext";
import { spacing } from "@/src/theme";

const AIChatBox = lazy(() => import("@/src/components/AIChatBox").then(m => ({ default: m.AIChatBox })));

type Tab = { key: string; path: string; icon: keyof typeof Feather.glyphMap; label: string };

const TABS: Tab[] = [
  { key: "feed", path: "/(app)/feed", icon: "home", label: "Feed" },
  { key: "search", path: "/(app)/search", icon: "compass", label: "Find" },
  { key: "nexus", path: "/(app)/nexus", icon: "zap", label: "Nexus" },
  { key: "friends", path: "/(app)/friends", icon: "heart", label: "Bonds" },
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
                    isCenter && styles.centerItem,
                  ]}
                >
                  {isCenter ? (
                    <DockDot
                      active={isActive}
                      isCenter={isCenter}
                      color={colors.primary}
                      onPrimary={colors.onPrimary}
                      fg={colors.foreground}
                      muted={colors.mutedFg}
                      icon={t.icon}
                    />
                  ) : (
                    <View
                      style={[
                        styles.tabPill,
                        {
                          backgroundColor: isActive ? colors.surfaceHigh : "transparent",
                          borderColor: isActive ? `${colors.primary}22` : "transparent",
                        },
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
                      <NxText
                        variant="caption"
                        style={{ color: isActive ? colors.foreground : colors.mutedFg, marginTop: 3 }}
                      >
                        {t.label}
                      </NxText>
                      <View
                        style={[
                          styles.tabIndicator,
                          { backgroundColor: isActive ? colors.primary : "transparent" },
                        ]}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </BlurView>
        </View>
        <View style={{ height: Math.max(insets.bottom, 8) }} />
      </SafeAreaView>
    </View>
    </AIChatProvider>
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
    transform: [{ scale: withSpring(active ? 1.12 : 1, { damping: 15 }) }],
  }));

  if (isCenter) {
    return (
      <Animated.View style={[styles.centerWrap, style]}>
        <View style={[styles.centerGlow, { backgroundColor: color }]} />
        <View style={[styles.centerDot, { backgroundColor: color }]}>
          <Feather name={icon} size={20} color={onPrimary} />
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[styles.dot, style, active && { backgroundColor: `${color}1F` }]}>
      <Feather
        name={icon}
        size={20}
        color={active ? color : muted}
        strokeWidth={active ? 2.4 : 2}
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
  dockShell: { width: "100%", alignItems: "center", paddingHorizontal: spacing.lg },
  dockBg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: 32,
    borderWidth: 1,
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  dockItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  centerItem: { transform: [{ translateY: -8 }] },
  tabPill: {
    minWidth: 58,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIndicator: {
    width: 16,
    height: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  dot: { width: 42, height: 34, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  centerWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  centerGlow: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.28,
    transform: [{ scale: 1.25 }],
  },
  centerDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
