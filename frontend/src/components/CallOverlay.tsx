import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VideoView } from "@/src/components/VideoView";
import { fonts } from "@/src/theme";
import {
  formatCallDuration,
  type ActiveCall,
} from "@/src/context/CallContext";

interface Props {
  call: ActiveCall | null;
  onAccept: () => void;
  onEnd: () => void;
  onMute: () => void;
  onSpeaker: () => void;
  onCamera: () => void;
  onSwitchCamera: () => void;
}

/**
 * Global call UI. Rendered by the root CallProvider above every screen, so a
 * call keeps running even when the user leaves the chat. An active voice call
 * collapses into a floating banner (call continues, app stays usable); video
 * calls stay full-screen like WhatsApp.
 */
export function CallOverlay({
  call,
  onAccept,
  onEnd,
  onMute,
  onSpeaker,
  onCamera,
  onSwitchCamera,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  if (!call) return null;

  const name = call.peer?.display_name || "Nexus User";

  const statusText =
    call.phase === "incoming"
      ? call.kind === "video"
        ? "Incoming video call"
        : "Incoming voice call"
      : call.phase === "calling"
        ? "Calling…"
        : call.phase === "connecting"
          ? "Connecting…"
          : formatCallDuration(call.duration);

  // ── Incoming call (both kinds): full-screen accept / decline ────────────
  if (call.phase === "incoming") {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onEnd}>
        <View style={[styles.fullOverlay, { backgroundColor: "rgba(0,0,0,0.85)" }]}>
          <View
            style={[
              styles.incomingCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Avatar
              uri={call.peer?.profile_picture}
              name={name}
              size={88}
              frame={call.peer?.profile_frame}
              achievement={call.peer?.achievement_level}
              animation={call.peer?.profile_animation}
              animationSpeed={call.peer?.profile_animation_speed}
              animationIntensity={call.peer?.profile_animation_intensity}
              online={false}
            />
            <NxText variant="title" numberOfLines={1} style={styles.callName}>
              {name}
            </NxText>
            <NxText variant="bodySm" style={{ marginTop: 6, color: colors.mutedFg }}>
              {statusText}
            </NxText>
            <View style={styles.callActions}>
              <TouchableOpacity
                testID="global-call-decline"
                onPress={onEnd}
                style={[styles.actionButton, styles.endButton]}
              >
                <Feather name="phone-off" size={25} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                testID="global-call-accept"
                onPress={onAccept}
                style={[styles.actionButton, styles.acceptButton]}
              >
                <Feather name="phone" size={25} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Video call: full-screen, always ─────────────────────────────────────
  if (call.kind === "video") {
    return (
      <Modal
        visible
        transparent={false}
        animationType="fade"
        onRequestClose={onEnd}
      >
        <View style={styles.videoContainer}>
          {call.remoteStream ? (
            <VideoView
              stream={call.remoteStream}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          ) : (
            <View
              style={[
                styles.remoteVideo,
                {
                  backgroundColor: "#111",
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Avatar
                uri={call.peer?.profile_picture}
                name={name}
                size={96}
                frame={call.peer?.profile_frame}
                achievement={call.peer?.achievement_level}
                online={false}
              />
              <NxText variant="title" style={{ color: "#fff", marginTop: 16 }}>
                {statusText}
              </NxText>
            </View>
          )}

          {call.phase === "active" && (
            <View style={styles.videoCallTimer}>
              <NxText
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontFamily: fonts.bodySemi,
                  letterSpacing: 1,
                }}
              >
                {formatCallDuration(call.duration)}
              </NxText>
            </View>
          )}

          {call.localStream && (
            <VideoView
              stream={call.localStream}
              style={styles.localVideo}
              objectFit="cover"
              zOrder={1}
              mirror
            />
          )}

          <View style={styles.videoCallControls}>
            <TouchableOpacity
              onPress={onMute}
              style={[
                styles.videoBtn,
                {
                  backgroundColor: call.muted
                    ? "#fff"
                    : "rgba(255,255,255,0.2)",
                },
              ]}
            >
              <Feather
                name={call.muted ? "mic-off" : "mic"}
                size={24}
                color={call.muted ? "#000" : "#fff"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCamera}
              style={[
                styles.videoBtn,
                {
                  backgroundColor: call.cameraOff
                    ? "#fff"
                    : "rgba(255,255,255,0.2)",
                },
              ]}
            >
              <Feather
                name={call.cameraOff ? "video-off" : "video"}
                size={24}
                color={call.cameraOff ? "#000" : "#fff"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onEnd}
              style={[styles.videoBtn, styles.endButton]}
            >
              <Feather name="phone-off" size={26} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSwitchCamera}
              style={[styles.videoBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            >
              <Feather name="refresh-cw" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Voice call, calling / connecting: full-screen card ─────────────────
  if (call.phase === "calling" || call.phase === "connecting") {
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={onEnd}
      >
        <View style={[styles.fullOverlay, { backgroundColor: "rgba(0,0,0,0.82)" }]}>
          <View
            style={[
              styles.incomingCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Avatar
              uri={call.peer?.profile_picture}
              name={name}
              size={88}
              frame={call.peer?.profile_frame}
              achievement={call.peer?.achievement_level}
              animation={call.peer?.profile_animation}
              animationSpeed={call.peer?.profile_animation_speed}
              animationIntensity={call.peer?.profile_animation_intensity}
              online={false}
            />
            <NxText variant="title" numberOfLines={1} style={styles.callName}>
              {name}
            </NxText>
            <NxText variant="bodySm" style={{ marginTop: 6, color: colors.mutedFg }}>
              {statusText}
            </NxText>
            <View style={styles.callActions}>
              <TouchableOpacity
                testID="global-call-mute"
                onPress={onMute}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: call.muted ? colors.primary : colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather
                  name={call.muted ? "mic-off" : "mic"}
                  size={24}
                  color={call.muted ? colors.onPrimary : colors.foreground}
                />
              </TouchableOpacity>

              <TouchableOpacity
                testID="global-call-speaker"
                onPress={onSpeaker}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: call.speakerOn ? colors.primary : colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather
                  name="volume-2"
                  size={24}
                  color={call.speakerOn ? colors.onPrimary : colors.foreground}
                />
              </TouchableOpacity>

              <TouchableOpacity
                testID="global-call-end"
                onPress={onEnd}
                style={[styles.actionButton, styles.endButton]}
              >
                <Feather name="phone-off" size={25} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Voice call active: floating banner (minimized) + optional full card ─
  const voiceControls = (
    <View style={styles.callActions}>
      <TouchableOpacity
        testID="global-call-mute"
        onPress={onMute}
        style={[
          styles.actionButton,
          {
            backgroundColor: call.muted ? colors.primary : colors.background,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <Feather
          name={call.muted ? "mic-off" : "mic"}
          size={24}
          color={call.muted ? colors.onPrimary : colors.foreground}
        />
      </TouchableOpacity>

      <TouchableOpacity
        testID="global-call-speaker"
        onPress={onSpeaker}
        style={[
          styles.actionButton,
          {
            backgroundColor: call.speakerOn ? colors.primary : colors.background,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <Feather
          name="volume-2"
          size={24}
          color={call.speakerOn ? colors.onPrimary : colors.foreground}
        />
      </TouchableOpacity>

      <TouchableOpacity
        testID="global-call-end"
        onPress={onEnd}
        style={[styles.actionButton, styles.endButton]}
      >
        <Feather name="phone-off" size={25} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      {expanded && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setExpanded(false)}
        >
          <View style={[styles.fullOverlay, { backgroundColor: "rgba(0,0,0,0.82)" }]}>
            <View
              style={[
                styles.incomingCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                testID="global-call-minimize"
                onPress={() => setExpanded(false)}
                style={styles.minimizeBtn}
              >
                <Feather name="chevron-down" size={22} color={colors.mutedFg} />
              </TouchableOpacity>
              <Avatar
                uri={call.peer?.profile_picture}
                name={name}
                size={88}
                frame={call.peer?.profile_frame}
                achievement={call.peer?.achievement_level}
                animation={call.peer?.profile_animation}
                animationSpeed={call.peer?.profile_animation_speed}
                animationIntensity={call.peer?.profile_animation_intensity}
                online={false}
              />
              <NxText variant="title" numberOfLines={1} style={styles.callName}>
                {name}
              </NxText>
              <NxText variant="bodySm" style={{ marginTop: 6, color: colors.mutedFg }}>
                {statusText}
              </NxText>
              {voiceControls}
            </View>
          </View>
        </Modal>
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.barWrap,
          { bottom: insets.bottom + 12, zIndex: 1000 },
        ]}
      >
        <View
          style={[
            styles.minBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            testID="global-call-expand"
            onPress={() => setExpanded(true)}
            style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}
          >
            <Avatar
              uri={call.peer?.profile_picture}
              name={name}
              size={40}
              frame={call.peer?.profile_frame}
              achievement={call.peer?.achievement_level}
              animation={call.peer?.profile_animation}
              animationSpeed={call.peer?.profile_animation_speed}
              animationIntensity={call.peer?.profile_animation_intensity}
              online={false}
            />
            <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
              <NxText variant="titleSm" numberOfLines={1}>
                {name}
              </NxText>
              <NxText variant="caption" style={{ color: colors.primary }}>
                {statusText}
              </NxText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="global-call-mute"
            onPress={onMute}
            style={styles.barBtn}
          >
            <Feather
              name={call.muted ? "mic-off" : "mic"}
              size={20}
              color={call.muted ? colors.primary : colors.foreground}
            />
          </TouchableOpacity>

          <TouchableOpacity
            testID="global-call-end"
            onPress={onEnd}
            style={[styles.barBtn, styles.endButton]}
          >
            <Feather name="phone-off" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fullOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  incomingCard: {
    width: "100%",
    maxWidth: 380,
    minHeight: 390,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  callName: {
    marginTop: 20,
    maxWidth: "90%",
    textAlign: "center",
  },
  callActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 52,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  endButton: {
    backgroundColor: "#E5484D",
  },
  acceptButton: {
    backgroundColor: "#2DBE72",
  },
  minimizeBtn: {
    position: "absolute",
    top: 16,
    left: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  barWrap: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  minBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  barBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  remoteVideo: {
    flex: 1,
    width: "100%",
  },
  localVideo: {
    position: "absolute",
    top: 52,
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  videoCallControls: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  videoBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  videoCallTimer: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
});
