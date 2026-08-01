import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";

type Circle = {
  circle_id: string;
  name: string;
  description?: string;
  photo?: string | null;
  privacy: "public" | "private";
  my_role: "owner" | "admin" | "member";
  member_count: number;
};

export default function CirclesPage() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const r = await api<{ circles: Circle[] }>("/circles", { token });
      setCircles(r.circles || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
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
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <NxText variant="displaySm">Circles</NxText>
          <NxText variant="caption" style={{ color: colors.mutedFg }}>
            Shared spaces with your people
          </NxText>
        </View>

        <TouchableOpacity
          testID="create-circle"
          onPress={() => router.push("/circles/create")}
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(item) => item.circle_id}
          contentContainerStyle={[
            styles.list,
            circles.length === 0 && { flexGrow: 1 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => router.push(`/circles/${item.circle_id}`)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.circlePhoto}>
                <Avatar
                  uri={item.photo || undefined}
                  name={item.name || "Circle"}
                  size={52}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <NxText variant="titleSm" numberOfLines={1}>
                  {item.name}
                </NxText>

                <View style={styles.meta}>
                  <Feather
                    name={item.privacy === "private" ? "lock" : "link"}
                    size={12}
                    color={colors.mutedFg}
                  />
                  <NxText
                    variant="caption"
                    style={{ color: colors.mutedFg, marginLeft: 5 }}
                  >
                    {item.privacy === "private" ? "Private" : "Invite access"}
                    {"  ·  "}
                    {item.member_count} {item.member_count === 1 ? "member" : "members"}
                  </NxText>
                </View>
              </View>

              <Feather name="chevron-right" size={19} color={colors.mutedFg} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather name="users" size={34} color={colors.primary} />
              </View>

              <NxText variant="titleSm" style={{ marginTop: 18 }}>
                Create your first Circle
              </NxText>

              <NxText
                variant="bodySm"
                style={{
                  color: colors.mutedFg,
                  textAlign: "center",
                  marginTop: 7,
                  maxWidth: 280,
                }}
              >
                Bring people together in a private or invite-only shared conversation.
              </NxText>

              <TouchableOpacity
                onPress={() => router.push("/circles/create")}
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus" size={17} color={colors.onPrimary} />
                <NxText
                  style={{
                    color: colors.onPrimary,
                    fontFamily: fonts.bodySemi,
                    marginLeft: 8,
                  }}
                >
                  New Circle
                </NxText>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 10,
  },
  circlePhoto: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 70,
  },
  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtn: {
    marginTop: 22,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
