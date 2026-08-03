import { Platform } from "react-native";
import * as Location from "expo-location";

type ActiveWatch = {
  sub: Location.LocationSubscription | null;
  endTimer: ReturnType<typeof setTimeout> | null;
  pollTimer: ReturnType<typeof setInterval> | null;
};

const active = new Map<string, ActiveWatch>();

type StartOpts = {
  messageId: string;
  conversationId: string;
  send: (payload: any) => void;
  lat: number;
  lng: number;
  expiresAt: number;
};

export function isLiveLocationActive(messageId: string): boolean {
  return active.has(messageId);
}

export function stopLiveLocation(messageId: string): void {
  const watch = active.get(messageId);
  if (!watch) return;
  if (watch.sub) {
    try {
      watch.sub.remove();
    } catch {}
  }
  if (watch.endTimer) clearTimeout(watch.endTimer);
  if (watch.pollTimer) clearInterval(watch.pollTimer);
  active.delete(messageId);
}

export function stopAllLiveLocations(): void {
  for (const messageId of [...active.keys()]) {
    stopLiveLocation(messageId);
  }
}

export function startLiveLocation({
  messageId,
  conversationId,
  send,
  lat,
  lng,
  expiresAt,
}: StartOpts): void {
  stopLiveLocation(messageId);

  const isWeb = Platform.OS === "web";
  let sub: Location.LocationSubscription | null = null;

  const push = (coords: { latitude: number; longitude: number }) => {
    if (Date.now() >= expiresAt) {
      stopLiveLocation(messageId);
      return;
    }
    send({
      type: "live_location_update",
      conversation_id: conversationId,
      message_id: messageId,
      lat: Number(coords.latitude.toFixed(6)),
      lng: Number(coords.longitude.toFixed(6)),
    });
  };

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  if (isWeb) {
    // Browsers only fire watchPosition on movement, so poll the current
    // position on a fixed cadence to keep the live location streaming.
    const poll = async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (pos?.coords) push(pos.coords);
      } catch {}
    };
    poll();
    pollTimer = setInterval(poll, 5000);
  } else {
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
        timeInterval: 5000,
      },
      (loc) => {
        if (loc?.coords) push(loc.coords);
      }
    )
      .then((s) => {
        if (active.has(messageId)) {
          sub = s;
          active.get(messageId)!.sub = s;
        } else {
          try {
            s.remove();
          } catch {}
        }
      })
      .catch(() => {});
  }

  const endTimer = setTimeout(() => {
    stopLiveLocation(messageId);
  }, Math.max(expiresAt - Date.now(), 0));

  active.set(messageId, { sub, endTimer, pollTimer });
}
