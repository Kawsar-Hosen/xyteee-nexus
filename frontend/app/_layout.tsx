import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAppFonts } from "@/src/hooks/use-app-fonts";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { WsProvider } from "@/src/context/WsContext";
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
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <WsProvider>
              <AppShell />
            </WsProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
