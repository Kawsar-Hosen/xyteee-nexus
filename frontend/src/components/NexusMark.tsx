import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";

/**
 * NexusMark – original XYTEEE Nexus brand mark.
 * Composed of two rotated squares + a center dot to form a diamond crest,
 * so it doesn't resemble any existing chat app's icon.
 */
export function NexusMark({ size = 56, style }: { size?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  const s = size;
  return (
    <View style={[{ width: s, height: s, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          width: s * 0.72,
          height: s * 0.72,
          borderWidth: 2,
          borderColor: colors.primary,
          borderRadius: s * 0.14,
          transform: [{ rotate: "45deg" }],
          position: "absolute",
        }}
      />
      <View
        style={{
          width: s * 0.42,
          height: s * 0.42,
          borderWidth: 2,
          borderColor: colors.primary,
          borderRadius: s * 0.08,
          transform: [{ rotate: "45deg" }],
          position: "absolute",
        }}
      />
      <View
        style={{
          width: s * 0.14,
          height: s * 0.14,
          borderRadius: s * 0.07,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}

export function NexusWordmark({ size = 22, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const c = color || colors.foreground;
  return (
    <View style={styles.wordmark}>
      {/* separated to allow style */}
      <NexusMark size={size * 1.15} />
      <View style={{ width: 10 }} />
      <View>
        <View>
          {/* Use React Native Text via inline import */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: "row", alignItems: "center" },
});
