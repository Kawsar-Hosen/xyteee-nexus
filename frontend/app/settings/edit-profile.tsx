import React, { useEffect, useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from "react-native";
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

export default function EditProfile() {
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [display, setDisplay] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState(user?.profile_picture || "");
  const [cover, setCover] = useState(user?.cover_picture || "");

  const birthdayParts = (user?.birthday || "").split("-");
  const [birthYear, setBirthYear] = useState(birthdayParts[0] || "");
  const [birthMonth, setBirthMonth] = useState(birthdayParts[1] || "");
  const [birthDay, setBirthDay] = useState(birthdayParts[2] || "");
  const [birthdayVisibility, setBirthdayVisibility] = useState<
    "private" | "public" | "bonds"
  >(user?.birthday_visibility || "private");

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

  const [busy, setBusy] = useState(false);

  const pickImage = async (target: "avatar" | "cover") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      aspect: target === "avatar" ? [1, 1] : [16, 9],
      allowsEditing: true,
    });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const url = `data:image/jpeg;base64,${r.assets[0].base64}`;
    if (target === "avatar") setAvatar(url);
    else setCover(url);
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateUser({
        display_name: display,
        bio,
        profile_picture: avatar,
        cover_picture: cover,
        ...(birthYear && birthMonth && birthDay
          ? {
              birthday: `${birthYear}-${birthMonth}-${birthDay}`,
              birthday_visibility: birthdayVisibility,
            }
          : {}),
      });
      router.back();
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity testID="edit-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Edit Profile</NxText>
        <TouchableOpacity testID="edit-save" onPress={save} disabled={busy} style={{ paddingHorizontal: 16 }}>
          {busy ? <ActivityIndicator color={colors.primary} /> : <NxText style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Save</NxText>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity testID="edit-cover" onPress={() => pickImage("cover")} activeOpacity={0.9} style={styles.cover}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={StyleSheet.absoluteFillObject} />
          )}
          <View style={styles.coverOverlay}>
            <Feather name="camera" size={18} color="#fff" />
            <NxText style={{ color: "#fff", marginLeft: 8, fontFamily: fonts.bodyMedium }}>Change cover</NxText>
          </View>
        </TouchableOpacity>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={{ marginTop: -50, alignItems: "flex-start" }}>
            <TouchableOpacity testID="edit-avatar" onPress={() => pickImage("avatar")} activeOpacity={0.85}>
              <Avatar uri={avatar} name={display} size={100} />
              <View style={[styles.avatarCam, { backgroundColor: colors.primary }]}>
                <Feather name="camera" size={14} color={colors.onPrimary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.lg }} />
          <NxText variant="label">Display name</NxText>
          <TextInput
            testID="edit-display-input"
            value={display}
            onChangeText={setDisplay}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholderTextColor={colors.mutedFg}
          />

          <View style={{ height: spacing.md }} />
          <NxText variant="label">Bio</NxText>
          <TextInput
            testID="edit-bio-input"
            value={bio}
            onChangeText={setBio}
            multiline
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border, minHeight: 96, textAlignVertical: "top" }]}
            placeholder="A few words about you…"
            placeholderTextColor={colors.mutedFg}
          />

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
                <NxText variant="titleSm">Birthday</NxText>
                <NxText
                  variant="bodySm"
                  style={{ color: colors.mutedFg, marginTop: 3 }}
                >
                  Add or change your birthday and who can see it.
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
                { value: "private", label: "Private", icon: "lock" },
                { value: "public", label: "Public", icon: "globe" },
                { value: "bonds", label: "Bonds", icon: "users" },
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cover: { height: 180, position: "relative" },
  coverOverlay: { position: "absolute", bottom: 12, right: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)" },
  avatarCam: { position: "absolute", bottom: 4, right: 4, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: radii.md, padding: 14, fontFamily: "Outfit", fontSize: 15, marginTop: 6 },
  birthdaySection: {
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
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
                  { borderBottomColor: colors.border },
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
