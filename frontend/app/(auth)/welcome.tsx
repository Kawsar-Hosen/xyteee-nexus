import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { NexusMark } from "@/src/components/NexusMark";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

const BG = "https://images.pexels.com/photos/13568041/pexels-photo-13568041.jpeg";

WebBrowser.maybeCompleteAuthSession();

export default function Welcome() {
  const { colors } = useTheme();
  const { googleAuth } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const redirectUri = makeRedirectUri({
    scheme: "xyteeenexus",
  });

  const [, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    redirectUri,
    androidClientId: "940343114841-mn3e2li540kf9m5jg5ckom6vst9d784h.apps.googleusercontent.com",
    webClientId: "940343114841-1jv65pbtqmurbl1hoacnre2iqoqtgq48.apps.googleusercontent.com",
  });

  React.useEffect(() => {
    console.log("GOOGLE RESPONSE:", JSON.stringify(googleResponse, null, 2));

    if (googleResponse?.type !== "success") return;

    const idToken = googleResponse.params?.id_token;
    if (!idToken) {
      setErr("Google Sign-In failed.");
      return;
    }

    (async () => {
      setBusy(true);
      setErr("");

      try {
        const result = await googleAuth(idToken);
        router.replace(
          result.is_new_user
            ? "/(auth)/setup-profile"
            : "/"
        );
      } catch (e: any) {
        setErr(e?.message || "Google Sign-In failed.");
      } finally {
        setBusy(false);
      }
    })();
  }, [googleResponse]);

  const startGoogleAuth = async () => {
    setErr("");

    try {
      await promptGoogleAsync();
    } catch (e: any) {
      setErr(e?.message || "Could not open Google Sign-In.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070709" }}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFillObject} blurRadius={12} />
      <LinearGradient
        colors={["rgba(7,7,9,0.55)", "rgba(7,7,9,0.88)", "#070709"]}
        style={StyleSheet.absoluteFillObject}
        locations={[0, 0.5, 1]}
      />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <View style={styles.header}>
            <NexusMark size={64} />
            <NxText variant="display" style={{ marginTop: spacing.md, letterSpacing: 6, color: "#F7F4EE" }}>
              XYTEEE
            </NxText>
            <NxText variant="label" style={{ color: colors.primary, marginTop: 2 }}>
              NEXUS
            </NxText>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.pitch}>
            <NxText variant="displaySm" style={{ textAlign: "center", lineHeight: 34, color: "#F7F4EE" }}>
              Where quiet conversations{"\n"}become close bonds.
            </NxText>
            <NxText variant="body" style={{ textAlign: "center", marginTop: spacing.md, color: "#A8A5AE" }}>
              A serene, real-time space for the people who matter most.
            </NxText>
          </View>

          <View style={{ height: spacing.lg }} />

          <TouchableOpacity
            testID="welcome-google-auth"
            disabled={busy}
            onPress={startGoogleAuth}
            activeOpacity={0.82}
            style={[
              styles.googleBtn,
              {
                backgroundColor: "#121216",
                borderColor: "#303038",
                opacity: busy ? 0.6 : 1,
              },
            ]}
          >
            <Image
              source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
              style={styles.googleIcon}
            />
            <NxText style={{ color: "#F7F4EE", fontFamily: fonts.bodySemi }}>
              {busy ? "Connecting…" : "Continue with Google"}
            </NxText>
          </TouchableOpacity>

          {err ? (
            <NxText
              variant="bodySm"
              style={{ color: colors.danger, textAlign: "center", marginBottom: spacing.sm }}
            >
              {err}
            </NxText>
          ) : null}

          <TouchableOpacity
            testID="welcome-email-signup"
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/signup")}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi }}>
              Create your Nexus account
            </NxText>
          </TouchableOpacity>

          <TouchableOpacity
            testID="welcome-email-login"
            activeOpacity={0.7}
            onPress={() => router.push("/(auth)/login")}
            style={styles.ghostBtn}
          >
            <NxText variant="body" style={{ color: "#F7F4EE" }}>
              Already inside? <NxText style={{ color: colors.primary, fontFamily: fonts.bodySemi }}>Sign in</NxText>
            </NxText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  header: { alignItems: "flex-start" },
  pitch: { alignItems: "center", paddingHorizontal: spacing.md },
  primaryBtn: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  googleBtn: {
    height: 54,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: spacing.md,
  },
  googleIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  ghostBtn: { alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
});
