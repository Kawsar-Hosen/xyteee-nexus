/**
 * VideoView — lazy wrapper around react-native-webrtc's RTCView.
 *
 * RTCView is only required when an actual stream is present, so the
 * native WebRTC module is never touched at module-load time (which
 * was the root cause of the "tap chat → app exits" crash).
 */
import React from "react";
import { View, ViewStyle } from "react-native";

interface Props {
  /** The MediaStream object whose URL we should display. */
  stream: any | null;
  style?: ViewStyle;
  objectFit?: "contain" | "cover";
  zOrder?: number;
  mirror?: boolean;
}

export function VideoView({
  stream,
  style,
  objectFit = "cover",
  zOrder = 0,
  mirror = false,
}: Props) {
  if (!stream) {
    return <View style={style} />;
  }

  // Lazy-load RTCView only when we actually have a stream to display.
  let RTCView: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RTCView = require("react-native-webrtc").RTCView;
  } catch {
    return <View style={style} />;
  }

  if (!RTCView) return <View style={style} />;

  return (
    <RTCView
      streamURL={stream.toURL ? stream.toURL() : stream.id}
      style={style}
      objectFit={objectFit}
      zOrder={zOrder}
      mirror={mirror}
    />
  );
}
