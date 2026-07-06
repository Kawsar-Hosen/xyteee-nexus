import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

export default function Notifications() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await api<{ notifications: any[] }>("/notifications", { token });
    setItems(r.notifications || []);
    setLoading(false);
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    load();
    api("/notifications/read", { method: "POST", token: token! }).catch(() => {});
  }, [load, token]));

  useEffect(() => subscribe((e) => { if (e.type === "notification") load(); }), [subscribe, load]);

  const icon = (kind: string) => ({
    friend_request: "user-plus",
    friend_accepted: "user-check",
    message: "message-circle",
    story: "aperture",
  }[kind] || "bell");

  const label = (n: any) => {
    switch (n.kind) {
      case "friend_request": return `${n.data?.from_name} sent you a bond request`;
      case "friend_accepted": return `${n.data?.from_name} accepted your bond`;
      case "message": return `${n.data?.from_name}: ${n.data?.preview}`;
      case "story": return `${n.data?.from_name} shared a reverie`;
      default: return "Activity";
    }
  };

  const handlePress = async (n: any) => {
    if (n.kind === "message" && n.data?.conversation_id) router.push(`/chat/${n.data.conversation_id}`);
    else if (n.kind === "friend_request" || n.kind === "friend_accepted") router.push("/(app)/friends");
    else if (n.kind === "story" && n.data?.from) router.push(`/story/${n.data.from}`);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity testID="notif-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Signals</NxText>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.notif_id}
          contentContainerStyle={{ padding: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`notif-${item.notif_id}`}
              onPress={() => handlePress(item)}
              activeOpacity={0.85}
              style={[styles.card, { backgroundColor: item.read ? colors.surface : colors.surfaceHigh, borderColor: colors.border }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
                <Feather name={icon(item.kind) as any} size={16} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{label(item)}</NxText>
                <NxText variant="caption" style={{ marginTop: 3 }}>{dayjs(item.created_at).fromNow()}</NxText>
              </View>
              {!item.read ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<NxText variant="bodySm" style={{ textAlign: "center", padding: 32 }}>No signals yet.</NxText>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.md, borderWidth: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
});
