import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";

type Privacy = "public" | "private";

export default function CreateCirclePage() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [photo, setPhoto] = useState("");
  const [creating, setCreating] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      aspect: [1, 1],
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const canCreate = name.trim().length > 0 && !creating;

  const createCircle = async () => {
    if (!canCreate || !token) return;

    try {
      setCreating(true);

      const r = await api<{ circle: { circle_id: string } }>("/circles", {
        method: "POST",
        token,
        body: {
          name: name.trim(),
          description: description.trim(),
          privacy,
          photo: photo || null,
        },
      });

      router.replace(`/circles/${r.circle.circle_id}`);
    } catch (e: any) {
      Alert.alert(
        "Could not create Circle",
        e?.message || "Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="x" size={21} color={colors.foreground} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <NxText variant="titleSm">New Circle</NxText>
            <NxText variant="caption" style={{ color: colors.mutedFg }}>
              Create a shared conversation
            </NxText>
          </View>

          <TouchableOpacity
            testID="circle-create-submit"
            disabled={!canCreate}
            onPress={createCircle}
            style={[
              styles.createBtn,
              {
                backgroundColor: colors.primary,
                opacity: canCreate ? 1 : 0.45,
              },
            ]}
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <NxText
                style={{
                  color: colors.onPrimary,
                  fontFamily: fonts.bodySemi,
                }}
              >
                Create
              </NxText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={pickPhoto}
            style={{ alignSelf: "center", alignItems: "center", marginBottom: 24 }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                overflow: "hidden",
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Avatar
                uri={photo || undefined}
                name={name || "Circle"}
                size={96}
              />
            </View>

            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: 20,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="camera" size={15} color={colors.onPrimary} />
            </View>

            <NxText
              variant="caption"
              style={{ color: colors.primary, marginTop: 8 }}
            >
              {photo ? "Change photo" : "Add Circle photo"}
            </NxText>
          </TouchableOpacity>

          <NxText variant="label" style={styles.label}>
            Circle name
          </NxText>

          <TextInput
            testID="circle-name"
            value={name}
            onChangeText={setName}
            placeholder="Give your Circle a name"
            placeholderTextColor={colors.mutedFg}
            maxLength={80}
            autoFocus
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          />

          <NxText variant="label" style={styles.label}>
            Description
          </NxText>

          <TextInput
            testID="circle-description"
            value={description}
            onChangeText={setDescription}
            placeholder="What is this Circle about?"
            placeholderTextColor={colors.mutedFg}
            multiline
            maxLength={300}
            style={[
              styles.input,
              styles.description,
              {
                color: colors.foreground,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          />

          <NxText variant="label" style={styles.label}>
            Access
          </NxText>

          <AccessOption
            active={privacy === "public"}
            icon="link"
            title="Invite access"
            description="People can join when a member adds them or shares an invite."
            onPress={() => setPrivacy("public")}
          />

          <AccessOption
            active={privacy === "private"}
            icon="lock"
            title="Private"
            description="Only owners and admins control who can enter."
            onPress={() => setPrivacy("private")}
          />

          <View
            style={[
              styles.note,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="shield" size={16} color={colors.primary} />
            <NxText
              variant="caption"
              style={{
                flex: 1,
                marginLeft: 10,
                color: colors.mutedFg,
                lineHeight: 18,
              }}
            >
              Invite access does not make your Circle publicly discoverable.
              People still need to be added or receive an invite.
            </NxText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function AccessOption({
    active,
    icon,
    title,
    description: optionDescription,
    onPress,
  }: {
    active: boolean;
    icon: "link" | "lock";
    title: string;
    description: string;
    onPress: () => void;
  }) {
    return (
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={onPress}
        style={[
          styles.option,
          {
            backgroundColor: colors.surface,
            borderColor: active ? colors.primary : colors.border,
            borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View
          style={[
            styles.optionIcon,
            {
              backgroundColor: active
                ? colors.primary + "18"
                : colors.surfaceHigh,
            },
          ]}
        >
          <Feather
            name={icon}
            size={19}
            color={active ? colors.primary : colors.mutedFg}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 13 }}>
          <NxText
            variant="titleSm"
            style={active ? { color: colors.primary } : undefined}
          >
            {title}
          </NxText>
          <NxText
            variant="caption"
            style={{ color: colors.mutedFg, marginTop: 3, lineHeight: 17 }}
          >
            {optionDescription}
          </NxText>
        </View>

        <View
          style={[
            styles.radio,
            {
              borderColor: active ? colors.primary : colors.border,
            },
          ]}
        >
          {active ? (
            <View
              style={[styles.radioDot, { backgroundColor: colors.primary }]}
            />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtn: {
    minWidth: 76,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 50,
  },
  heroIcon: {
    width: 82,
    height: 82,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    fontFamily: "Outfit",
    fontSize: 15,
  },
  description: {
    minHeight: 105,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "top",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 10,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: 14,
    marginTop: spacing.md,
  },
});
