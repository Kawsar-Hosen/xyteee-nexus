import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";

import { NxText } from "@/src/components/NxText";
import { fonts } from "@/src/theme";

export type LiveLocationData = {
  lat: number;
  lng: number;
  started_at?: string;
  expires_at?: string;
};

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatExpiry(iso: string): string {
  const d = dayjs(iso);
  const now = dayjs();
  const time = d.format("h:mm A");
  if (d.isSame(now, "day")) return `Today · ${time}`;
  if (d.isSame(now.add(1, "day"), "day")) return `Tomorrow · ${time}`;
  return `${d.format("MMM D")} · ${time}`;
}

export function LiveLocationCard({
  data,
  isOwner,
  fg,
  muted,
  width,
  onOpen,
  onStop,
}: {
  data: LiveLocationData;
  isOwner: boolean;
  fg: string;
  muted: string;
  width: number;
  onOpen: () => void;
  onStop: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [mapErr, setMapErr] = useState(false);

  const expiresAt = data.expires_at ? dayjs(data.expires_at).valueOf() : 0;
  const expired = !expiresAt || expiresAt <= now;
  const remaining = Math.max(0, expiresAt - now);

  useEffect(() => {
    if (expired) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expired]);

  const mapUri = useMemo(
    () =>
      `https://static-maps.yandex.ru/1.x/?ll=${data.lng},${data.lat}&z=15&size=600,400&l=map&pt=${data.lng},${data.lat},pm2rdl&lang=en_US`,
    [data.lat, data.lng]
  );

  return (
    <View style={{ width, borderRadius: 14, overflow: "hidden" }}>
      {mapErr ? (
        <View style={styles.mapFallback}>
          <Feather name="map-pin" size={28} color={fg} style={{ opacity: 0.7 }} />
          <NxText style={[styles.mapFallbackText, { color: fg, opacity: 0.7 }]}>
            Live location
          </NxText>
        </View>
      ) : (
        <Image
          source={{ uri: mapUri }}
          resizeMode="cover"
          style={[styles.map, { width, opacity: expired ? 0.55 : 1 }]}
          onError={() => setMapErr(true)}
        />
      )}

      {/* Live / ended badge + coords */}
      <View
        style={[
          styles.badgeRow,
          { backgroundColor: expired ? "rgba(0,0,0,0.04)" : "rgba(220,38,38,0.10)" },
        ]}
      >
        {expired ? (
          <View style={styles.endedDot} />
        ) : (
          <View style={[styles.liveDot, Platform.OS === "web" ? ({ boxShadow: "0 0 0 3px rgba(239,68,68,0.25)" } as any) : { elevation: 2 }]} />
        )}
        <NxText
          style={[
            styles.badgeText,
            { color: expired ? muted : "#DC2626" },
          ]}
        >
          {expired ? "ENDED" : "LIVE"}
        </NxText>

        <NxText
          style={[styles.coords, { color: fg }]}
          numberOfLines={1}
        >
          {data.lat.toFixed(5)}, {data.lng.toFixed(5)}
        </NxText>
        <Feather name="external-link" size={13} color={fg} style={{ opacity: 0.7 }} />
      </View>

      {/* Countdown + expiry date */}
      <View
        style={[styles.timeRow, { borderTopColor: muted + "44" }]}
      >
        <Feather
          name={expired ? "check-circle" : "clock"}
          size={12}
          color={expired ? muted : "#DC2626"}
        />
        {expired ? (
          <NxText style={[styles.timeText, { color: muted }]}>
            Sharing ended{data.expires_at ? ` · ${formatExpiry(data.expires_at)}` : ""}
          </NxText>
        ) : (
          <NxText style={[styles.timeText, { color: fg }]}>
            Ends in {formatRemaining(remaining)} · {data.expires_at ? formatExpiry(data.expires_at) : ""}
          </NxText>
        )}
      </View>

      {isOwner && !expired ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onStop}
          style={[styles.stopBtn, { borderTopColor: muted + "44" }]}
        >
          <Feather name="x-circle" size={13} color="#DC2626" />
          <NxText style={[styles.stopText, { color: "#DC2626" }]}>
            Stop sharing location
          </NxText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 150,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  mapFallback: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  mapFallbackText: {
    marginTop: 6,
    fontSize: 11,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
    marginRight: 6,
  },
  endedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9CA3AF",
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.5,
    marginRight: 8,
  },
  coords: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    textAlign: "right",
    marginRight: 5,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timeText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: fonts.bodyMedium,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(220,38,38,0.06)",
  },
  stopText: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
  },
});
