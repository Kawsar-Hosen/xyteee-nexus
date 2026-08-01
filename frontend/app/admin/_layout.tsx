/**
 * Admin layout — blocks access to anyone who is not the admin.
 * The backend also enforces this; the frontend check is UX-only.
 */
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";

const ADMIN_EMAIL = "smdkawsar2@gmail.com";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const isAdmin = !loading && !!user && user.email === ADMIN_EMAIL;
  const isDenied = !loading && (!user || user.email !== ADMIN_EMAIL);

  useEffect(() => {
    if (isDenied) {
      router.replace("/(app)/feed");
    }
  }, [isDenied]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <NxText variant="body">Access denied.</NxText>
      </View>
    );
  }

  return <Slot />;
}
