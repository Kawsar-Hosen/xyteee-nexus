import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { RTCView, MediaStream } from "react-native-webrtc";

type Props = {
  visible: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  muted: boolean;
  speakerOn: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleCamera: () => void;
  onToggleVideo: () => void;
  videoEnabled: boolean;
  frontCamera: boolean;
  onEnd: () => void;
};

export default function VideoCallScreen({
  visible,
  localStream,
  remoteStream,
  muted,
  speakerOn,
  onToggleMute,
  onToggleSpeaker,
  onToggleCamera,
  onToggleVideo,
  videoEnabled,
  frontCamera,
  onEnd,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remote}
          objectFit="cover"
        />
      ) : (
        <View style={styles.remote} />
      )}

      {localStream ? (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.local}
          objectFit="cover"
        />
      ) : null}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={onToggleMute}>
          <Feather
            name={muted ? "mic-off" : "mic"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onToggleSpeaker}>
          <Feather
            name="volume-2"
            size={24}
            color={speakerOn ? "#00E676" : "#fff"}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onToggleVideo}>
          <Feather
            name={videoEnabled ? "video" : "video-off"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onToggleCamera}>
          <Feather
            name="refresh-cw"
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#E53935" }]}
          onPress={onEnd}
        >
          <Feather name="phone-off" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 9999,
  },
  remote: {
    flex: 1,
  },
  local: {
    position: "absolute",
    right: 16,
    top: 60,
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  btn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
});
