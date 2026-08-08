import { Stack, useRouter } from "expo-router";
import Head from "expo-router/head";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAppFonts } from "@/src/hooks/use-app-fonts";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { WsProvider } from "@/src/context/WsContext";
import { CallProvider, useCallManager } from "@/src/context/CallContext";
import {
  registerForPushNotifications,
  setupNotificationChannelsAndCategories,
  getNotificationRoute,
} from "@/src/lib/pushNotifications";
import { api } from "@/src/api/client";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Set up channels/categories as early as possible (before permission prompt)
setupNotificationChannelsAndCategories().catch(() => {});

function AppShell() {
  const { mode, colors } = useTheme();
  const { user, token } = useAuth();
  const router = useRouter();
  const callManager = useCallManager();

  useEffect(() => {
    if (!user || !token) return;

    registerForPushNotifications()
      .then((pushToken) => {
        if (!pushToken) return;
        console.log("Push token ready:", pushToken);
        return api("/push-token", {
          method: "POST",
          token,
          body: { expo_push_token: pushToken },
        });
      })
      .catch((err) => console.warn("Push registration failed:", err));
  }, [user?.user_id, token]);

  useEffect(() => {
    const openNotification = async (
      response: Notifications.NotificationResponse
    ) => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      // ── Inline reply action from notification ──────────────────────
      if (
        actionId === "reply" &&
        (response as any).userText &&
        data?.conversation_id &&
        token
      ) {
        const replyText = ((response as any).userText as string).trim();
        if (replyText) {
          try {
            await api("/chats/message", {
              method: "POST",
              token,
              body: {
                conversation_id: data.conversation_id,
                content: replyText,
                kind: "text",
              },
            });
          } catch (e) {
            console.warn("Inline reply failed:", e);
          }
        }
        // Also navigate to the chat after replying
        router.push(`/chat/${data.conversation_id}` as any);
        return;
      }

      // ── Call actions from notification ─────────────────────────────
      const isCallAction =
        actionId === "accept_call" || actionId === "decline_call";
      if (isCallAction) {
        // The app may have been ringing in the background — stop the ringtone
        // now, since the user has interacted with the call.
        if (Platform.OS !== "web") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const InCallManager = (require("react-native-incall-manager") as any)
              .default;
            InCallManager.stopRingtone();
          } catch {}
        }
      }

      // Accept: open the chat and surface the pending call in the global
      // overlay, which is picked up by the call manager.
      if (actionId === "accept_call" && data?.conversation_id) {
        callManager.checkPending(data.conversation_id as string);
        router.push(`/chat/${data.conversation_id}` as any);
        return;
      }

      // Decline: tell the backend to clear the pending call + notify the
      // caller, and drop any local incoming-call state.
      if (
        actionId === "decline_call" &&
        data?.conversation_id &&
        token
      ) {
        if (callManager.call) {
          callManager.endCall();
        }
        api("/calls/decline", {
          method: "POST",
          token,
          query: { conversation_id: data.conversation_id as string },
        }).catch(() => {});
        return;
      }

      // ── Mark as read action ────────────────────────────────────────
      if (actionId === "mark_read") {
        // Nothing extra needed — just don't navigate
        return;
      }

      // ── Default: tap on notification → open route ──────────────────
      const route = getNotificationRoute(data);
      if (route) {
        router.push(route as any);
      }
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        openNotification
      );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          openNotification(response);
        }
      })
      .catch(() => {});

    return () => subscription.remove();
  }, [router, token]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Head>
        <title>XYTEEE Nexus — Where quiet conversations become close bonds</title>
        <meta
          name="description"
          content="A serene, real-time space for the people who matter most. Private chat, stories, circles, voice and video calls on XYTEEE Nexus."
        />
      </Head>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade",
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [appFontsLoaded, appFontsError] = useAppFonts();

  const ready = (iconsLoaded || iconsError) && (appFontsLoaded || appFontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Head.Provider>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <WsProvider>
                <CallProvider>
                  <AppShell />
                </CallProvider>
              </WsProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </Head.Provider>
    </GestureHandlerRootView>
  );
}
