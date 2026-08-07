import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts } from "@/src/theme";

export function CoverWatermark() {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]}>
      <LinearGradient
        colors={[colors.surfaceHigh, colors.surface, colors.background]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Text
        style={[
          styles.watermark,
          { color: colors.foreground },
        ]}
        numberOfLines={1}
      >
        XYTEEE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  watermark: {
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 10,
    opacity: 0.14,
    textAlign: "center",
  },
});
