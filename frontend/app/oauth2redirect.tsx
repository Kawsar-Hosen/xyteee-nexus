import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { spacing } from "@/src/theme";

WebBrowser.maybeCompleteAuthSession();

export default function OAuth2Redirect() {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.primary} />
      <NxText variant="bodySm" style={{ marginTop: spacing.md }}>
        Finishing sign-in…
      </NxText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#070709",
  },
});
