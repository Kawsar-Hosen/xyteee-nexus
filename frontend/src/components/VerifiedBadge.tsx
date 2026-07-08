import React, { useState } from "react";
import { View, StyleSheet, Modal, Pressable, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { fonts, spacing } from "@/src/theme";

export type BadgeType = "blue" | "gold" | "gray";

const BADGE_CONFIG: Record<
  BadgeType,
  { color: string; label: string; title: string; description: string }
> = {
  blue: {
    color: "#1D9BF0",
    label: "Blue",
    title: "Verified Account",
    description: "This account has been verified by XYTEEE Nexus as authentic.",
  },
  gold: {
    color: "#F4C430",
    label: "Gold",
    title: "Notable Account",
    description: "This notable account has been officially recognized by XYTEEE Nexus.",
  },
  gray: {
    color: "#829AAB",
    label: "Gray",
    title: "Official Account",
    description: "This is an official account verified by XYTEEE Nexus.",
  },
};

export const BADGE_LABELS: { type: BadgeType; label: string }[] =
  Object.entries(BADGE_CONFIG).map(([type, cfg]) => ({
    type: type as BadgeType,
    label: cfg.label,
  }));

export function VerifiedBadge({
  badgeType,
  verifiedSince,
  showInfo = false,
  size = 16,
  style,
}: {
  badgeType?: string | null;
  verifiedSince?: string | null;
  showInfo?: boolean;
  size?: number;
  style?: any;
}) {
  const { colors } = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);

  if (!badgeType) return null;

  const cfg = BADGE_CONFIG[badgeType as BadgeType];
  if (!cfg) return null;

  if (!showInfo) {
    return (
      <View style={[styles.wrap, style]}>
        <MaterialCommunityIcons
          name="check-decagram"
          size={size}
          color={cfg.color}
        />
      </View>
    );
  }

  const verifiedDate = verifiedSince
    ? new Date(verifiedSince).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Verification date unavailable";

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setInfoOpen(true)}
        style={[styles.wrap, style]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${cfg.title} information`}
      >
        <MaterialCommunityIcons
          name="check-decagram"
          size={size}
          color={cfg.color}
        />
      </TouchableOpacity>

      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setInfoOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.badgeCircle,
                { backgroundColor: `${cfg.color}18` },
              ]}
            >
              <MaterialCommunityIcons
                name="check-decagram"
                size={44}
                color={cfg.color}
              />
            </View>

            <NxText style={styles.infoHeading}>Verified Info</NxText>

            <NxText
              style={[
                styles.infoTitle,
                { color: colors.foreground },
              ]}
            >
              {cfg.title}
            </NxText>

            <NxText
              style={[
                styles.infoDescription,
                { color: colors.mutedFg },
              ]}
            >
              {cfg.description}
            </NxText>

            <View
              style={[
                styles.divider,
                { backgroundColor: colors.border },
              ]}
            />

            <View style={styles.sinceRow}>
              <View>
                <NxText
                  style={[
                    styles.sinceLabel,
                    { color: colors.mutedFg },
                  ]}
                >
                  Verified Since
                </NxText>
                <NxText
                  style={[
                    styles.sinceDate,
                    { color: colors.foreground },
                  ]}
                >
                  {verifiedDate}
                </NxText>
              </View>

              <MaterialCommunityIcons
                name="shield-check-outline"
                size={24}
                color={cfg.color}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setInfoOpen(false)}
              style={[
                styles.closeButton,
                { backgroundColor: colors.surfaceHigh },
              ]}
            >
              <NxText
                style={[
                  styles.closeText,
                  { color: colors.foreground },
                ]}
              >
                Close
              </NxText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  infoCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
  },
  badgeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  infoHeading: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
    opacity: 0.7,
  },
  infoTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    marginTop: 6,
    textAlign: "center",
  },
  infoDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  divider: {
    width: "100%",
    height: 1,
    marginVertical: spacing.lg,
  },
  sinceRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sinceLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  sinceDate: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    marginTop: 3,
  },
  closeButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: spacing.lg,
  },
  closeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
});
