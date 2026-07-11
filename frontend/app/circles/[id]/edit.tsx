import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, spacing } from "@/src/theme";

type Circle = {
  circle_id: string;
  name: string;
  description?: string;
  photo?: string | null;
  privacy: "public" | "private";
  member_count: number;
  my_role: "owner" | "admin" | "member";
};

export default function EditCirclePage() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;

    try {
      const result = await api<{ circle: Circle }>(
        `/circles/${id}`,
        { token }
      );

      setCircle(result.circle);
      setName(result.circle.name || "");
      setDescription(result.circle.description || "");
      setPhoto(result.circle.photo || "");
      setPrivacy(result.circle.privacy || "public");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const pickPhoto = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

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

  const save = async () => {
    const cleanName = name.trim();

    if (!token || !id || saving) return;

    if (!cleanName) {
      Alert.alert("Circle name required", "Please enter a Circle name.");
      return;
    }

    setSaving(true);

    try {
      await api(`/circles/${id}`, {
        method: "PUT",
        token,
        body: {
          name: cleanName,
          description: description.trim(),
          photo,
          privacy,
        },
      });

      router.back();
    } catch (error: any) {
      Alert.alert(
        "Could not save changes",
        error?.message || error?.detail || "Please try again"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[
          styles.safe,
          {
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>

        <NxText
          style={{
            flex: 1,
            textAlign: "center",
            color: colors.foreground,
            fontSize: 18,
            fontFamily: fonts.bodySemi,
          }}
        >
          Edit Circle
        </NxText>

        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={styles.headerSide}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <NxText
              style={{
                color: colors.primary,
                fontFamily: fonts.bodySemi,
                fontSize: 14,
              }}
            >
              Save
            </NxText>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.photoSection}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={pickPhoto}
            style={[
              styles.photoRing,
              {
                borderColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
          >
            <Avatar
              uri={photo || undefined}
              name={name || "Circle"}
              size={104}
            />

            <View
              style={[
                styles.cameraBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.background,
                },
              ]}
            >
              <Feather name="camera" size={16} color={colors.onPrimary} />
            </View>
          </TouchableOpacity>

          <NxText
            style={{
              marginTop: 13,
              color: colors.primary,
              fontSize: 13,
              fontFamily: fonts.bodySemi,
            }}
          >
            Change Circle photo
          </NxText>
        </View>

        <NxText style={[styles.label, { color: colors.foreground }]}>
          Circle name
        </NxText>

        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="users" size={18} color={colors.primary} />
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={80}
            placeholder="Circle name"
            placeholderTextColor={colors.mutedFg}
            style={[styles.input, { color: colors.foreground }]}
          />
        </View>

        <NxText style={[styles.label, { color: colors.foreground }]}>
          Description
        </NxText>

        <View
          style={[
            styles.descriptionBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={300}
            textAlignVertical="top"
            placeholder="What is this Circle about?"
            placeholderTextColor={colors.mutedFg}
            style={[
              styles.descriptionInput,
              { color: colors.foreground },
            ]}
          />

          <NxText
            style={{
              alignSelf: "flex-end",
              color: colors.mutedFg,
              fontSize: 11,
            }}
          >
            {description.length}/300
          </NxText>
        </View>

        <NxText style={[styles.label, { color: colors.foreground }]}>
          Privacy
        </NxText>

        <View style={styles.privacyRow}>
          {(["public", "private"] as const).map((value) => {
            const selected = privacy === value;

            return (
              <TouchableOpacity
                key={value}
                activeOpacity={0.75}
                onPress={() => setPrivacy(value)}
                style={[
                  styles.privacyCard,
                  {
                    backgroundColor: selected
                      ? colors.backgroundElevated
                      : colors.surface,
                    borderColor: selected
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.privacyIcon,
                    {
                      backgroundColor: selected
                        ? colors.primary
                        : colors.backgroundElevated,
                    },
                  ]}
                >
                  <Feather
                    name={value === "public" ? "globe" : "lock"}
                    size={19}
                    color={selected ? colors.onPrimary : colors.mutedFg}
                  />
                </View>

                <NxText
                  style={{
                    marginTop: 10,
                    color: selected
                      ? colors.primary
                      : colors.foreground,
                    fontFamily: fonts.bodySemi,
                    textTransform: "capitalize",
                  }}
                >
                  {value}
                </NxText>

                <NxText
                  style={{
                    marginTop: 4,
                    color: colors.mutedFg,
                    fontSize: 11,
                    textAlign: "center",
                  }}
                >
                  {value === "public"
                    ? "Open Circle identity"
                    : "Private Circle identity"}
                </NxText>
              </TouchableOpacity>
            );
          })}
        </View>

        <NxText
          style={{
            marginTop: 18,
            color: colors.mutedFg,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          Only the Circle owner and admins can edit these details.
        </NxText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 66,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  headerSide: {
    width: 62,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 50,
  },
  photoSection: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 30,
  },
  photoRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  cameraBtn: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    marginBottom: 9,
    marginTop: 16,
  },
  inputBox: {
    height: 54,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 52,
    marginLeft: 11,
    fontSize: 15,
    padding: 0,
  },
  descriptionBox: {
    minHeight: 130,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  descriptionInput: {
    minHeight: 88,
    fontSize: 15,
    lineHeight: 21,
    padding: 0,
  },
  privacyRow: {
    flexDirection: "row",
    gap: 10,
  },
  privacyCard: {
    flex: 1,
    minHeight: 140,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  privacyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
