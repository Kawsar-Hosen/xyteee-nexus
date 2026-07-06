import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts } from "@/src/theme";

type Variant = "display" | "displaySm" | "title" | "titleSm" | "body" | "bodySm" | "label" | "caption";

export function NxText({ variant = "body", style, ...rest }: TextProps & { variant?: Variant }) {
  const { colors } = useTheme();
  const map: Record<Variant, any> = {
    display: { fontFamily: "PlayfairDisplay-Bold", fontSize: 36, lineHeight: 42, color: colors.foreground },
    displaySm: { fontFamily: "PlayfairDisplay-Bold", fontSize: 26, lineHeight: 32, color: colors.foreground },
    title: { fontFamily: "PlayfairDisplay-Bold", fontSize: 22, lineHeight: 28, color: colors.foreground },
    titleSm: { fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 22, color: colors.foreground },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.foreground },
    bodySm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.mutedFg },
    label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 16, color: colors.mutedFg, letterSpacing: 0.6, textTransform: "uppercase" },
    caption: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.mutedFg },
  };
  return <Text {...rest} style={[map[variant], style]} />;
}

export const nxStyles = StyleSheet.create({});
