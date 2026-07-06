import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [u, setU] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    const r = await api<any>(`/users/${id}`, { token });
    setU(r);
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const act = async (path: string) => {
    setBusy(true);
    try {
      await api(path, { method: "POST", body: { user_id: id }, token: token! });
      load();
    } finally { setBusy(false); }
  };

  const openChat = async () => {
    const r = await api<{ conversation: any }>("/chats/open", { method: "POST", body: { user_id: id }, token: token! });
    router.push(`/chat/${r.conversation.conversation_id}`);
  };

  if (!u) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <View style={styles.cover}>
          {u.cover_picture ? (
            <Image source={{ uri: u.cover_picture }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={StyleSheet.absoluteFillObject} />
          )}
          <TouchableOpacity testID="user-back" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.glass, position: "absolute", top: spacing.md, left: spacing.md }]}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={{ marginTop: -50 }}>
            <Avatar uri={u.profile_picture} name={u.display_name} size={100} online={u.online} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="title" style={{ flexShrink: 1 }}>{u.display_name}</NxText>
              <VerifiedBadge badgeType={u.badge_type} size={18} />
            </View>
            <NxText variant="bodySm">@{u.username}</NxText>
          </View>
          {u.bio ? <NxText variant="body" style={{ marginTop: spacing.md }}>{u.bio}</NxText> : null}

          <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Stat label="Bonds" value={u.friend_count ?? 0} />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <Stat label="Reveries" value={u.story_count ?? 0} />
          </View>

          <View style={{ height: spacing.lg }} />

          {u.relation === "friend" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity testID="user-message" onPress={openChat} style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Message</NxText>
              </TouchableOpacity>
              <TouchableOpacity testID="user-unfriend" disabled={busy} onPress={() => act("/friends/unfriend")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="user-x" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity testID="user-block" disabled={busy} onPress={() => act("/friends/block")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="slash" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : u.relation === "requested" ? (
            <TouchableOpacity testID="user-cancel-req" disabled={busy} onPress={() => act("/friends/cancel")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}>
              <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Request sent · Cancel</NxText>
            </TouchableOpacity>
          ) : u.relation === "incoming" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity testID="user-accept" disabled={busy} onPress={() => act("/friends/accept")} style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Accept request</NxText>
              </TouchableOpacity>
              <TouchableOpacity testID="user-reject" disabled={busy} onPress={() => act("/friends/reject")} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
                <Feather name="x" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          ) : u.relation === "blocked" ? (
            <TouchableOpacity testID="user-unblock" disabled={busy} onPress={() => act("/friends/unblock")} style={[styles.primaryBtn, { backgroundColor: colors.surfaceHigh }]}>
              <NxText style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Unblock</NxText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity testID="user-add" disabled={busy} onPress={() => act("/friends/request")} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
              <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>Send bond request</NxText>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <NxText variant="titleSm">{String(value)}</NxText>
      <NxText variant="caption" style={{ marginTop: 2 }}>{label}</NxText>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 200 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg },
  primaryBtn: { height: 52, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
