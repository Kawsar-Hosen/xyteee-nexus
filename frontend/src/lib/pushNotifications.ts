import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Register Android notification channels and iOS notification categories.
 *  Must be called once at app start (before requesting permission). */
export async function setupNotificationChannelsAndCategories() {
  if (Platform.OS === "android") {
    // Default channel — messages, friend requests, etc.
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });

    // High-priority calls channel — shows heads-up notification even when phone is idle
    await Notifications.setNotificationChannelAsync("calls", {
      name: "Incoming Calls",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      sound: "default",
      enableLights: true,
      enableVibrate: true,
      bypassDnd: true,
    });
  }

  // Notification category: message — adds inline Reply action
  await Notifications.setNotificationCategoryAsync("message", [
    {
      identifier: "reply",
      buttonTitle: "Reply",
      textInput: {
        submitButtonTitle: "Send",
        placeholder: "Type a message…",
      },
    },
    {
      identifier: "mark_read",
      buttonTitle: "Mark as read",
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
}

export async function registerForPushNotifications() {
  if (Platform.OS === "web" || !Device.isDevice) return null;

  await setupNotificationChannelsAndCategories();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("Expo projectId not found");
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export function getNotificationRoute(data: any): string | null {
  const kind = data?.kind;

  if (
    (
      kind === "message" ||
      kind === "message_reaction" ||
      kind === "voice_call" ||
      kind === "video_call"
    ) &&
    data?.conversation_id
  ) {
    return `/chat/${data.conversation_id}`;
  }

  if (
    (
      kind === "circle_message" ||
      kind === "circle_message_reaction" ||
      kind === "circle_invite_accepted" ||
      kind === "circle_invite_rejected"
    ) &&
    data?.circle_id
  ) {
    return `/circles/${data.circle_id}`;
  }

  if (
    kind === "circle_invite" ||
    kind === "circle_member_removed"
  ) {
    return "/notifications";
  }

  if (kind === "story" && data?.from) {
    return `/story/${data.from}`;
  }

  if (kind === "story_reaction" && data?.story_owner_id) {
    return `/story/${data.story_owner_id}`;
  }

  if (kind === "friend_request" || kind === "friend_accepted") {
    return "/(app)/friends";
  }

  return null;
}
