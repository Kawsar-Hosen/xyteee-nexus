import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";

export default function SetupProfile() {
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [avatar, setAvatar] = useState(user?.profile_picture || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [cover, setCover] = useState(user?.cover_picture || "");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthdayVisibility, setBirthdayVisibility] = useState<
    "private" | "public" | "bonds"
  >("private");

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: 100 },
    (_, index) => String(currentYear - index)
  );
  const months = Array.from(
    { length: 12 },
    (_, index) => String(index + 1).padStart(2, "0")
  );
  const daysInSelectedMonth =
    birthYear && birthMonth
      ? new Date(Number(birthYear), Number(birthMonth), 0).getDate()
      : 31;

  const days = Array.from(
    { length: daysInSelectedMonth },
    (_, index) => String(index + 1).padStart(2, "0")
  );

  useEffect(() => {
    if (birthDay && Number(birthDay) > daysInSelectedMonth) {
      setBirthDay("");
    }
  }, [birthDay, daysInSelectedMonth]);

  const pickImage = async (target: "avatar" | "cover") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      aspect: target === "avatar" ? [1, 1] : [16, 9],
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;

    if (target === "avatar") {
      setAvatar(uri);
    } else {
      setCover(uri);
    }
  };

  const continueToFeed = async () => {
    if (saving) return;

    setSaveError("");
    setSaving(true);
    try {
      const patch: {
        profile_picture?: string;
        cover_picture?: string;
        birthday?: string;
        birthday_visibility?: "private" | "public" | "bonds";
      } = {};

      if (avatar) patch.profile_picture = avatar;
      if (cover) patch.cover_picture = cover;

      if (birthYear && birthMonth && birthDay) {
        patch.birthday = `${birthYear}-${birthMonth}-${birthDay}`;
        patch.birthday_visibility = birthdayVisibility;
      }

      if (Object.keys(patch).length > 0) {
        await updateUser(patch);
      }

      router.replace("/(app)/feed");
    } catch (e: any) {
      setSaveError(e?.message || "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const skipForNow = () => {
    if (saving) return;
    router.replace("/(app)/feed");
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <NxText variant="display">Set Up Your Profile</NxText>
          <NxText
            variant="body"
            style={{ color: colors.mutedFg, marginTop: 8, lineHeight: 22 }}
          >
            Make your Nexus feel like yours.
          </NxText>
        </View>

        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            testID="setup-cover"
            activeOpacity={0.9}
            onPress={() => pickImage("cover")}
            style={styles.cover}
          >
            {cover ? (
              <Image
                source={{ uri: cover }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : (
              <LinearGradient
                colors={[colors.primary, colors.primaryDeep]}
                style={StyleSheet.absoluteFillObject}
              />
            )}

            <View style={styles.coverShade} />

            <View style={styles.coverAction}>
              <Feather name="camera" size={16} color="#FFFFFF" />
              <NxText style={styles.coverActionText}>
                {cover ? "Change cover" : "Add cover"}
              </NxText>
            </View>
          </TouchableOpacity>

          <View style={styles.profileArea}>
            <TouchableOpacity
              testID="setup-avatar"
              activeOpacity={0.85}
              onPress={() => pickImage("avatar")}
              style={styles.avatarWrap}
            >
              <View
                style={[
                  styles.avatarBorder,
                  { borderColor: colors.surface },
                ]}
              >
                <Avatar
                  uri={avatar}
                  name={user?.display_name || "Nexus"}
                  size={94}
                />
              </View>

              <View
                style={[
                  styles.avatarCamera,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.surface,
                  },
                ]}
              >
                <Feather
                  name="camera"
                  size={14}
                  color={colors.onPrimary}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.identity}>
              <NxText variant="title">
                {user?.display_name || "Your name"}
              </NxText>
              <NxText
                variant="bodySm"
                style={{ color: colors.mutedFg, marginTop: 3 }}
              >
                @{user?.username || "username"}
              </NxText>
            </View>
          </View>

          <View
            style={[
              styles.previewLabel,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.backgroundElevated,
              },
            ]}
          >
            <Feather name="eye" size={15} color={colors.primary} />
            <NxText
              variant="bodySm"
              style={{
                marginLeft: 7,
                color: colors.mutedFg,
                fontFamily: fonts.bodyMedium,
              }}
            >
              Live profile preview
            </NxText>
          </View>
        </View>

        <View style={styles.birthdaySection}>
          <View style={styles.sectionHeadingRow}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Feather name="gift" size={17} color={colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <NxText variant="titleSm">Your Birthday</NxText>
              <NxText
                variant="bodySm"
                style={{ color: colors.mutedFg, marginTop: 3 }}
              >
                Choose who can see it on your profile.
              </NxText>
            </View>
          </View>

          <View style={styles.dateRow}>
            <DateChoice
              label="Year"
              value={birthYear}
              options={years}
              onSelect={setBirthYear}
            />
            <DateChoice
              label="Month"
              value={birthMonth}
              options={months}
              onSelect={setBirthMonth}
            />
            <DateChoice
              label="Day"
              value={birthDay}
              options={days}
              onSelect={setBirthDay}
            />
          </View>

          <View style={styles.visibilityRow}>
            {[
              {
                value: "private",
                label: "Private",
                icon: "lock",
              },
              {
                value: "public",
                label: "Public",
                icon: "globe",
              },
              {
                value: "bonds",
                label: "Bonds",
                icon: "users",
              },
            ].map((option) => {
              const active = birthdayVisibility === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.8}
                  onPress={() =>
                    setBirthdayVisibility(
                      option.value as "private" | "public" | "bonds"
                    )
                  }
                  style={[
                    styles.visibilityOption,
                    {
                      backgroundColor: active
                        ? colors.primary + "18"
                        : colors.surface,
                      borderColor: active
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={option.icon as any}
                    size={16}
                    color={active ? colors.primary : colors.mutedFg}
                  />
                  <NxText
                    style={{
                      marginTop: 7,
                      fontSize: 12,
                      fontFamily: fonts.bodySemi,
                      color: active
                        ? colors.primary
                        : colors.foreground,
                    }}
                  >
                    {option.label}
                  </NxText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          {saveError ? (
            <View
              style={[
                styles.feedbackBox,
                {
                  backgroundColor: colors.danger + "12",
                  borderColor: colors.danger,
                },
              ]}
            >
              <Feather name="alert-circle" size={18} color={colors.danger} />
              <NxText
                variant="bodySm"
                style={{
                  flex: 1,
                  marginLeft: 9,
                  color: colors.danger,
                }}
              >
                {saveError}
              </NxText>
            </View>
          ) : null}

          <TouchableOpacity
            testID="setup-continue"
            activeOpacity={0.85}
            disabled={saving}
            onPress={continueToFeed}
            style={[
              styles.continueButton,
              {
                backgroundColor: colors.primary,
                opacity: saving ? 0.65 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <NxText
                  style={{
                    color: colors.onPrimary,
                    fontFamily: fonts.bodySemi,
                  }}
                >
                  Continue
                </NxText>
                <Feather
                  name="arrow-right"
                  size={18}
                  color={colors.onPrimary}
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="setup-skip"
            disabled={saving}
            onPress={skipForNow}
            style={styles.skipButton}
          >
            <NxText
              style={{
                color: colors.mutedFg,
                fontFamily: fonts.bodyMedium,
              }}
            >
              Skip for now
            </NxText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heading: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  previewCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: radii.xl,
  },
  cover: {
    height: 180,
    position: "relative",
    overflow: "hidden",
  },
  coverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  coverAction: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  coverActionText: {
    marginLeft: 7,
    color: "#FFFFFF",
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  profileArea: {
    minHeight: 118,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  avatarWrap: {
    alignSelf: "flex-start",
    marginTop: -47,
  },
  avatarBorder: {
    borderWidth: 4,
    borderRadius: 999,
  },
  avatarCamera: {
    position: "absolute",
    right: 1,
    bottom: 2,
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    marginTop: spacing.md,
  },
  previewLabel: {
    minHeight: 44,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  birthdaySection: {
    marginTop: spacing.xl,
  },
  actions: {
    marginTop: spacing.xl,
  },
  feedbackBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: spacing.md,
  },
  continueButton: {
    height: 56,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  dateRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  visibilityRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  visibilityOption: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dateButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  optionList: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  optionItem: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

function DateChoice({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <NxText
        variant="caption"
        style={{ color: colors.mutedFg, marginBottom: 6 }}
      >
        {label}
      </NxText>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen((current) => !current)}
        style={[
          styles.dateButton,
          {
            backgroundColor: colors.surface,
            borderColor: open ? colors.primary : colors.border,
          },
        ]}
      >
        <NxText
          style={{
            flex: 1,
            color: value ? colors.foreground : colors.mutedFg,
            fontFamily: fonts.bodyMedium,
          }}
        >
          {value || "Select"}
        </NxText>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedFg}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={[
            styles.optionList,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 180 }}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                style={[
                  styles.optionItem,
                  {
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <NxText
                  style={{
                    color:
                      value === option
                        ? colors.primary
                        : colors.foreground,
                    fontFamily:
                      value === option
                        ? fonts.bodySemi
                        : fonts.body,
                  }}
                >
                  {option}
                </NxText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const extraStyles = StyleSheet.create({
  unused: {},
});
