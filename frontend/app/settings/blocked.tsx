import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { fonts, radii, spacing } from "@/src/theme";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";

export default function Blocked() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await api<{ blocked: any[] }>("/blocks", { token });
    setItems(r.blocked || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const unblock = async (uid: string) => {
    await api("/friends/unblock", { method: "POST", body: { user_id: uid }, token: token! });
    load();
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity testID="blocked-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <NxText variant="titleSm">Blocked</NxText>
        <View style={{ width: 40 }} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Avatar uri={item.profile_picture} name={item.display_name} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="titleSm">{item.display_name}</NxText>
              <VerifiedBadge badgeType={item.badge_type} size={16} />
            </View>
                <NxText variant="bodySm">@{item.username}</NxText>
              </View>
              <TouchableOpacity testID={`unblock-${item.username}`} onPress={() => unblock(item.user_id)} style={[styles.btn, { borderColor: colors.border }]}>
                <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi, fontSize: 13 }}>Unblock</NxText>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<NxText variant="bodySm" style={{ textAlign: "center", padding: 32 }}>No one blocked.</NxText>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginBottom: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1 },
});