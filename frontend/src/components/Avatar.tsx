import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";

const initials = (name?: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  const s = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  return s.toUpperCase();
};

export function Avatar({
  uri,
  name,
  size = 44,
  ring,
  online,
}: {
  uri?: string;
  name?: string;
  size?: number;
  ring?: boolean;
  online?: boolean;
}) {
  const { colors } = useTheme();
  const outerSize = ring ? size + 6 : size;

  const inner = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceHigh,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <NxText style={{ color: colors.primary, fontSize: size * 0.4, fontFamily: "PlayfairDisplay-Bold" }}>
        {initials(name) || "N"}
      </NxText>
    </View>
  );

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 0,
        borderColor: ring ? colors.primary : "transparent",
      }}
    >
      {inner}
      {online ? (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: (size * 0.28) / 2,
            backgroundColor: colors.online,
            borderWidth: 2,
            borderColor: colors.background,
          }}
        />
      ) : null}
    </View>
  );
}

export const _styles = StyleSheet.create({});
