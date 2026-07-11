import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

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

export default function CircleInfoPage() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;

    try {
      const result = await api<{ circle: Circle }>(
        `/circles/${id}`,
        { token }
      );
      setCircle(result.circle);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = () => {
    if (!circle || !token || !id || deleting) return;

    Alert.alert(
      "Permanently delete Circle?",
      `This will permanently delete ${circle.name} for everyone, including all messages, members and Circle data. This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final confirmation",
              `Delete ${circle.name} permanently?`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Delete Permanently",
                  style: "destructive",
                  onPress: async () => {
                    setDeleting(true);

                    try {
                      await api(`/circles/${id}`, {
                        method: "DELETE",
                        token,
                      });

                      router.replace("/");
                    } catch (error: any) {
                      Alert.alert(
                        "Could not delete Circle",
                        error?.message || error?.detail || "Please try again"
                      );
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const confirmLeave = () => {
    if (!circle || !token || !id || leaving) return;

    if (circle.my_role === "owner") {
      Alert.alert(
        "Owner cannot leave",
        "Transfer ownership to another member before leaving this Circle."
      );
      return;
    }

    Alert.alert(
      "Leave Circle?",
      `Are you sure you want to leave ${circle.name}? You will lose access to this Circle and its group chat.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLeaving(true);

            try {
              await api(`/circles/${id}/leave`, {
                method: "POST",
                token,
              });

              router.replace("/");
            } catch (error: any) {
              Alert.alert(
                "Could not leave Circle",
                error?.message || error?.detail || "Please try again"
              );
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
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
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.headerBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <NxText
          style={{
            flex: 1,
            marginLeft: 14,
            fontSize: 19,
            color: colors.foreground,
            fontFamily: fonts.bodySemi,
          }}
        >
          Circle Info
        </NxText>

        {circle?.my_role === "owner" || circle?.my_role === "admin" ? (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/circles/[id]/edit",
                params: { id },
              })
            }
            style={[
              styles.headerBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="edit-2" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View
            style={[
              styles.avatarRing,
              {
                borderColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
          >
            <Avatar
              uri={circle?.photo || undefined}
              name={circle?.name || "Circle"}
              size={92}
            />
          </View>

          <NxText
            style={{
              marginTop: 18,
              fontSize: 25,
              color: colors.foreground,
              fontFamily: fonts.bodySemi,
              textAlign: "center",
            }}
          >
            {circle?.name || "Circle"}
          </NxText>

          <NxText
            style={{
              marginTop: 6,
              fontSize: 13,
              color: colors.mutedFg,
            }}
          >
            {circle?.member_count || 0} members ·{" "}
            {circle?.privacy === "private" ? "Private Circle" : "Public Circle"}
          </NxText>

          {circle?.description ? (
            <NxText
              style={{
                marginTop: 14,
                color: colors.mutedFg,
                fontSize: 14,
                lineHeight: 21,
                textAlign: "center",
              }}
            >
              {circle.description}
            </NxText>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.infoRow}>
            <Feather
              name={circle?.privacy === "private" ? "lock" : "globe"}
              size={19}
              color={colors.primary}
            />
            <View style={styles.infoText}>
              <NxText
                style={{
                  color: colors.foreground,
                  fontFamily: fonts.bodySemi,
                }}
              >
                {circle?.privacy === "private" ? "Private Circle" : "Public Circle"}
              </NxText>
              <NxText
                style={{
                  color: colors.mutedFg,
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Circle privacy
              </NxText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <Feather name="shield" size={19} color={colors.primary} />
            <View style={styles.infoText}>
              <NxText
                style={{
                  color: colors.foreground,
                  fontFamily: fonts.bodySemi,
                }}
              >
                {circle?.my_role === "owner"
                  ? "Owner"
                  : circle?.my_role === "admin"
                  ? "Admin"
                  : "Member"}
              </NxText>
              <NxText
                style={{
                  color: colors.mutedFg,
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Your role in this Circle
              </NxText>
            </View>
          </View>
        </View>

        {circle?.my_role === "owner" || circle?.my_role === "admin" ? (
          <TouchableOpacity
            activeOpacity={0.72}
            onPress={() =>
              router.push({
                pathname: "/circles/[id]/edit",
                params: { id },
              })
            }
            style={[
              styles.editBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.editIcon,
                { backgroundColor: colors.backgroundElevated },
              ]}
            >
              <Feather name="edit-3" size={18} color={colors.primary} />
            </View>

            <View style={{ flex: 1, marginLeft: 13 }}>
              <NxText
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontFamily: fonts.bodySemi,
                }}
              >
                Edit Circle Profile
              </NxText>

              <NxText
                style={{
                  color: colors.mutedFg,
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Photo, name, description and privacy
              </NxText>
            </View>

            <Feather
              name="chevron-right"
              size={19}
              color={colors.mutedFg}
            />
          </TouchableOpacity>
        ) : null}

        {circle?.my_role === "owner" ? (
          <TouchableOpacity
            activeOpacity={0.72}
            disabled={deleting}
            onPress={confirmDelete}
            style={[
              styles.leaveBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.danger,
              },
            ]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Feather name="trash-2" size={19} color={colors.danger} />
            )}

            <NxText
              style={{
                marginLeft: 10,
                color: colors.danger,
                fontFamily: fonts.bodySemi,
                fontSize: 15,
              }}
            >
              Delete Circle Permanently
            </NxText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.72}
            disabled={leaving}
            onPress={confirmLeave}
            style={[
              styles.leaveBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.danger,
              },
            ]}
          >
            {leaving ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Feather name="log-out" size={19} color={colors.danger} />
            )}

            <NxText
              style={{
                marginLeft: 10,
                color: colors.danger,
                fontFamily: fonts.bodySemi,
                fontSize: 15,
              }}
            >
              Leave Circle
            </NxText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 50,
  },
  hero: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },
  action: {
    flex: 1,
    height: 82,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    marginTop: 20,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  infoRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  infoText: {
    flex: 1,
    marginLeft: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  editBtn: {
    minHeight: 72,
    marginTop: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  editIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBtn: {
    height: 56,
    marginTop: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
