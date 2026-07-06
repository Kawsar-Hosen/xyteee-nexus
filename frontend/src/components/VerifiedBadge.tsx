/**
 * VerifiedBadge — Twitter-style verified checkmark badge beside a user's name.
 * Exactly 3 badge types, all same shape (filled circle + white check).
 * Only the circle color differs.
 *
 *   blue  – #1D9BF0  (general verified)
 *   gold  – #C9A227  (official / notable)
 *   gray  – #829AAB  (legacy / limited)
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

export type BadgeType = "blue" | "gold" | "gray";

const BADGE_CONFIG: Record<BadgeType, { color: string; label: string }> = {
  blue: { color: "#1D9BF0", label: "Blue"  },
  gold: { color: "#C9A227", label: "Gold"  },
  gray: { color: "#829AAB", label: "Gray"  },
};

export const BADGE_LABELS: { type: BadgeType; label: string }[] = Object.entries(
  BADGE_CONFIG
).map(([type, cfg]) => ({ type: type as BadgeType, label: cfg.label }));

export function VerifiedBadge({
  badgeType,
  size = 16,
  style,
}: {
  badgeType?: string | null;
  size?: number;
  style?: any;
}) {
  if (!badgeType) return null;
  const cfg = BADGE_CONFIG[badgeType as BadgeType];
  if (!cfg) return null;

  const iconSize = Math.round(size * 0.65);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: cfg.color,
        },
        style,
      ]}
    >
      <Feather name="check" size={iconSize} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
