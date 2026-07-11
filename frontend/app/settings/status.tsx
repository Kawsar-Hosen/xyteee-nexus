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
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";

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
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

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
            name="x"
            size={28}
            color={colors.mutedFg}
          />
        </TouchableOpacity>

        <NxText style={[styles.headerTitle, { color: colors.foreground }]}>
          Set your status
        </NxText>

        <TouchableOpacity
          activeOpacity={0.75}
          disabled={busy}
          onPress={save}
          style={styles.headerSave}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <NxText style={[styles.headerSaveText, { color: colors.primary }]}>
              Save
            </NxText>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.profilePreview,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          {user.cover_picture ? (
            <Image
              source={{ uri: user.cover_picture }}
              style={styles.previewCover}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.previewCover,
                { backgroundColor: colors.primaryDeep },
              ]}
            />
          )}

          <View style={styles.previewAvatarWrap}>
            <Avatar
              uri={user.profile_picture}
              name={user.display_name}
              size={86}
            />
          </View>

          <View style={styles.previewThoughtDotSmall} />
          <View style={styles.previewThoughtDotLarge} />

          <View
            style={[
              styles.floatingStatus,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
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
              {status.trim() || "Set a status"}
            </NxText>
          </View>

          <View style={styles.previewIdentity}>
            <NxText
              style={[styles.previewName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {user.display_name}
            </NxText>
            <NxText
              style={[styles.previewUsername, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {user.username}
            </NxText>
          </View>
        </View>

        <NxText style={[styles.statusLabel, { color: colors.foreground }]}>
          Status
        </NxText>

        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.surface },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setEmojiPickerOpen(true)}
            style={[styles.inputEmoji, { backgroundColor: colors.mutedFg }]}
          >
            <SymbolView
              name="face.smiling"
              size={20}
              tintColor={colors.background}
              fallback={
                <Feather
                  name="smile"
                  size={20}
                  color={colors.background}
                />
              }
            />
          </TouchableOpacity>

          <TextInput
            value={status}
            onChangeText={setStatus}
            maxLength={30}
            placeholder="Set a status"
            placeholderTextColor={colors.mutedFg}
            style={[
              styles.input,
              { color: colors.foreground },
            ]}
          />

          {status.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setStatus("")}
              style={styles.clearInput}
            >
              <Feather name="x-circle" size={22} color={colors.mutedFg} />
            </TouchableOpacity>
          ) : null}
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

      </ScrollView>
      </KeyboardAvoidingView>

      <EmojiPicker
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onRequestClose={() => setEmojiPickerOpen(false)}
        onEmojiSelected={(emoji: EmojiType) => {
          setStatus((current) => `${current}${emoji.emoji}`);
        }}
      />

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
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.18)",
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 20,
  },
  headerSave: {
    width: 58,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSaveText: {
    fontFamily: fonts.bodySemi,
    fontSize: 17,
  },
  content: {
    paddingHorizontal: 30,
    paddingTop: 32,
    paddingBottom: 60,
  },
  profilePreview: {
    height: 290,
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  previewCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 124,
  },
  previewAvatarWrap: {
    position: "absolute",
    left: 18,
    top: 84,
    zIndex: 5,
  },
  previewThoughtDotSmall: {
    position: "absolute",
    left: 137,
    top: 94,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#fff",
    zIndex: 8,
  },
  previewThoughtDotLarge: {
    position: "absolute",
    left: 146,
    top: 103,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    zIndex: 8,
  },
  floatingStatus: {
    position: "absolute",
    left: 145,
    right: 14,
    top: 112,
    minHeight: 48,
    maxHeight: 78,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: "center",
    zIndex: 7,
  },
  floatingStatusText: {
    fontFamily: undefined,
    fontSize: 14,
    lineHeight: 19,
    fontStyle: "normal",
    fontWeight: "400",
    flexShrink: 1,
  },
  previewIdentity: {
    position: "absolute",
    left: 28,
    right: 24,
    bottom: 20,
    zIndex: 4,
  },
  previewName: {
    fontFamily: fonts.bodySemi,
    fontSize: 22,
    lineHeight: 28,
  },
  previewUsername: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
  },
  statusLabel: {
    marginTop: 24,
    marginBottom: 12,
    fontFamily: fonts.bodySemi,
    fontSize: 18,
  },
  inputWrap: {
    height: 64,
    borderRadius: 22,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  inputEmoji: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: fonts.body,
    fontSize: 17,
  },
  clearInput: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  clearRow: {
    height: 72,
    marginTop: spacing.lg,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearRowLabel: {
    marginLeft: 12,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
  clearRowRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  clearRowValue: {
    fontFamily: fonts.body,
    fontSize: 16,
    marginRight: 8,
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
});
