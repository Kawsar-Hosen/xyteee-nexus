import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";

export default function StatusScreen() {
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState(user?.status_text || "");
  const [clearAt, setClearAt] = useState<"1h" | "4h" | "today" | "never">("never");
  const [clearSheetOpen, setClearSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const save = async () => {
    setBusy(true);

    try {
      const text = status.trim();
      let expiresAt: string | null = null;

      if (text && clearAt !== "never") {
        const expiry = new Date();

        if (clearAt === "1h") {
          expiry.setHours(expiry.getHours() + 1);
        } else if (clearAt === "4h") {
          expiry.setHours(expiry.getHours() + 4);
        } else if (clearAt === "today") {
          expiry.setHours(23, 59, 59, 999);
        }

        expiresAt = expiry.toISOString();
      }

      await updateUser({
        status_text: text,
        status_expires_at: expiresAt,
      });

      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Feather
            name="chevron-left"
            size={26}
            color={colors.foreground}
          />
        </TouchableOpacity>

        <NxText variant="titleSm">Set Status</NxText>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.profilePreview}>
          <View style={styles.previewAvatarWrap}>
            <Avatar
              uri={user.profile_picture}
              name={user.display_name}
              size={92}
            />
          </View>

          <View style={styles.previewIdentity}>
            <NxText
              variant="title"
              numberOfLines={1}
              style={{ color: colors.foreground }}
            >
              {user.display_name}
            </NxText>

            <NxText
              variant="bodySm"
              numberOfLines={1}
              style={{ marginTop: 2, color: colors.mutedFg }}
            >
              @{user.username}
            </NxText>
          </View>

          <View
            style={[
              styles.floatingStatus,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.previewStatusDot,
                {
                  backgroundColor: status.trim()
                    ? colors.primary
                    : colors.mutedFg,
                },
              ]}
            />

            <NxText
              numberOfLines={3}
              style={[
                styles.floatingStatusText,
                {
                  color: status.trim()
                    ? colors.foreground
                    : colors.mutedFg,
                },
              ]}
            >
              {status.trim() || "Set a status..."}
            </NxText>
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />

        <NxText variant="label">Status</NxText>

        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            value={status}
            onChangeText={setStatus}
            maxLength={128}
            multiline
            placeholder="What's happening?"
            placeholderTextColor={colors.mutedFg}
            style={[
              styles.input,
              { color: colors.foreground },
            ]}
          />

          <NxText
            style={[
              styles.counter,
              { color: colors.mutedFg },
            ]}
          >
            {status.length}/128
          </NxText>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setClearSheetOpen(true)}
          style={[
            styles.clearRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.clearRowLeft}>
            <Feather
              name="clock"
              size={18}
              color={colors.mutedFg}
            />
            <NxText
              style={[
                styles.clearRowLabel,
                { color: colors.foreground },
              ]}
            >
              Clear at
            </NxText>
          </View>

          <View style={styles.clearRowRight}>
            <NxText
              style={[
                styles.clearRowValue,
                { color: colors.mutedFg },
              ]}
            >
              {{
                "1h": "In 1 hour",
                "4h": "In 4 hours",
                today: "Today",
                never: "Don't clear",
              }[clearAt]}
            </NxText>

            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedFg}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={busy}
          onPress={save}
          style={[
            styles.saveButton,
            {
              backgroundColor: colors.primary,
              opacity: busy ? 0.65 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <NxText
              style={[
                styles.saveText,
                { color: colors.onPrimary },
              ]}
            >
              Save Status
            </NxText>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={clearSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setClearSheetOpen(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setClearSheetOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: colors.mutedFg },
              ]}
            />

            <NxText
              style={[
                styles.sheetTitle,
                { color: colors.foreground },
              ]}
            >
              Clear status after
            </NxText>

            {[
              { key: "1h", label: "1 hour" },
              { key: "4h", label: "4 hours" },
              { key: "today", label: "Today" },
              { key: "never", label: "Don't clear" },
            ].map((option) => {
              const selected = clearAt === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.75}
                  onPress={() => {
                    setClearAt(
                      option.key as "1h" | "4h" | "today" | "never"
                    );
                    setClearSheetOpen(false);
                  }}
                  style={[
                    styles.sheetOption,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <NxText
                    style={[
                      styles.sheetOptionText,
                      {
                        color: selected
                          ? colors.primary
                          : colors.foreground,
                      },
                    ]}
                  >
                    {option.label}
                  </NxText>

                  {selected ? (
                    <Feather
                      name="check"
                      size={21}
                      color={colors.primary}
                    />
                  ) : (
                    <View style={{ width: 21 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  profilePreview: {
    minHeight: 190,
    position: "relative",
    paddingTop: 24,
    paddingHorizontal: 4,
  },
  previewAvatarWrap: {
    alignSelf: "flex-start",
  },
  previewIdentity: {
    marginTop: 14,
    maxWidth: "55%",
  },
  floatingStatus: {
    position: "absolute",
    top: 22,
    left: 104,
    maxWidth: "68%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 10,
    marginTop: 5,
  },
  floatingStatusText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: radii.md,
    marginTop: 8,
    padding: 14,
  },
  input: {
    minHeight: 96,
    padding: 0,
    fontFamily: fonts.body,
    fontSize: 15,
    textAlignVertical: "top",
  },
  counter: {
    alignSelf: "flex-end",
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 6,
  },
  clearRow: {
    minHeight: 58,
    marginTop: spacing.lg,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearRowLabel: {
    marginLeft: 10,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  clearRowRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  clearRowValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginRight: 5,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderWidth: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    opacity: 0.45,
    marginBottom: 18,
  },
  sheetTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    marginBottom: 8,
  },
  sheetOption: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetOptionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  saveText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
});
