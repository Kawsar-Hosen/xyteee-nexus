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

export async function registerForPushNotifications() {
  if (Platform.OS === "web" || !Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

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
      kind === "voice_call"
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
