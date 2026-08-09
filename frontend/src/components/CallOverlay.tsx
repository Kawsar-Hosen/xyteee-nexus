import React, { useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
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
 * Draggable floating panel (PanResponder + Animated.ValueXY, the codebase's
 * established pattern). Works inside Modals and on the app root. A quick tap
 * (no movement) triggers `onTap` — used to expand a minimized call bubble.
 */
function Draggable({
  children,
  minX,
  minY,
  maxX,
  maxY,
  initialX,
  initialY,
  onTap,
  style,
  ignoreBelow,
}: {
  children: React.ReactNode;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  initialX: number;
  initialY: number;
  onTap?: () => void;
  style?: ViewStyle;
  /** Touches whose Y (relative to the box) is >= this value are left alone — lets inner buttons work. */
  ignoreBelow?: number;
}) {
  const posRef = useRef({ x: initialX, y: initialY });
  const originRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const movedRef = useRef(false);
  const boundsRef = useRef({ minX, minY, maxX, maxY });
  const ignoreBelowRef = useRef(ignoreBelow);
  boundsRef.current = { minX, minY, maxX, maxY };
  ignoreBelowRef.current = ignoreBelow;

  const anim = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        const below = ignoreBelowRef.current;
        return below === undefined || e.nativeEvent.locationY < below;
      },
      onMoveShouldSetPanResponder: (e) => {
        const below = ignoreBelowRef.current;
        if (below !== undefined && e.nativeEvent.locationY >= below) return false;
        return true;
      },
      onPanResponderGrant: (e) => {
        originRef.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
          px: posRef.current.x,
          py: posRef.current.y,
        };
        movedRef.current = false;
      },
      onPanResponderMove: (e) => {
        const b = boundsRef.current;
        const dx = e.nativeEvent.pageX - originRef.current.x;
        const dy = e.nativeEvent.pageY - originRef.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
        const nx = Math.min(b.maxX, Math.max(b.minX, originRef.current.px + dx));
        const ny = Math.min(b.maxY, Math.max(b.minY, originRef.current.py + dy));
        posRef.current = { x: nx, y: ny };
        anim.setValue(posRef.current);
      },
      onPanResponderRelease: () => {
        if (!movedRef.current && onTap) onTap();
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  return (
    <Animated.View
      style={[style, { transform: anim.getTranslateTransform() }]}
      {...responder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Global call UI. Rendered by the root CallProvider above every screen, so a
 * call keeps running even when the user leaves the chat. Both voice and video
 * calls can be minimized to a floating, draggable bubble while the rest of the
 * app stays usable. During a video call your camera feed is a small draggable
 * window (your profile picture replaces it while the camera is off) and the
 * other person is shown large.
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

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

  // ── Shared pieces ──────────────────────────────────────────────────────
  const peerAvatar = (size: number, ringColor: string) => (
    <View
      style={{
        borderRadius: size / 2 + 3,
        borderWidth: 2,
        borderColor: ringColor,
        padding: 2,
      }}
    >
      <Avatar
        uri={call.peer?.profile_picture}
        name={name}
        size={size}
        frame={call.peer?.profile_frame}
        achievement={call.peer?.achievement_level}
        animation={call.peer?.profile_animation}
        animationSpeed={call.peer?.profile_animation_speed}
        animationIntensity={call.peer?.profile_animation_intensity}
        online={false}
      />
    </View>
  );

  const myAvatar = (size: number) => (
    <Avatar
      uri={user?.profile_picture}
      name={user?.display_name || "You"}
      size={size}
      frame={user?.profile_frame}
      achievement={user?.achievement_level}
      animation={user?.profile_animation}
      animationSpeed={user?.profile_animation_speed}
      animationIntensity={user?.profile_animation_intensity}
      online={false}
    />
  );

  // ── Incoming call (both kinds): full-screen accept / decline ────────────
  if (call.phase === "incoming") {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onEnd}>
        <LinearGradient
          colors={["#0B0B10", "#1A1410"]}
          style={styles.fullOverlay}
        >
          <View
            style={[
              styles.incomingCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {peerAvatar(92, call.kind === "video" ? colors.primary : "#2DBE72")}
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
        </LinearGradient>
      </Modal>
    );
  }

  // ── Video call ─────────────────────────────────────────────────────────
  if (call.kind === "video") {
    // Minimized: floating, draggable bubble — call keeps running, app usable.
    if (minimized && call.phase === "active") {
      const miniW = 128;
      const miniH = 172;
      return (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
        >
          <Draggable
            minX={8}
            minY={insets.top + 8}
            maxX={screenWidth - miniW - 8}
            maxY={screenHeight - miniH - insets.bottom - 8}
            initialX={screenWidth - miniW - 12}
            initialY={insets.top + 12}
            onTap={() => setMinimized(false)}
            ignoreBelow={miniH - 44}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: miniW,
              height: miniH,
              borderRadius: 18,
              overflow: "hidden",
              backgroundColor: "#000",
              borderWidth: 2,
              borderColor: colors.primary,
              shadowColor: "#000",
              shadowOpacity: 0.5,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 18,
            }}
          >
            {call.remoteStream ? (
              <VideoView
                stream={call.remoteStream}
                style={StyleSheet.absoluteFillObject}
                objectFit="cover"
                zOrder={0}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
                ]}
              >
                <Avatar
                  uri={call.peer?.profile_picture}
                  name={name}
                  size={64}
                  frame={call.peer?.profile_frame}
                  achievement={call.peer?.achievement_level}
                  online={false}
                />
              </View>
            )}
            <LinearGradient
              colors={["rgba(0,0,0,0.5)", "transparent"]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                paddingHorizontal: 8,
                paddingVertical: 6,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Feather name="video" size={11} color="#fff" />
              <NxText
                style={{ color: "#fff", fontSize: 11, fontFamily: fonts.bodySemi, marginLeft: 5, flex: 1 }}
                numberOfLines={1}
              >
                {name}
              </NxText>
            </LinearGradient>
            <View
              style={{
                position: "absolute",
                bottom: 8,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <TouchableOpacity
                onPress={onMute}
                style={[styles.miniBtn, { backgroundColor: call.muted ? "#fff" : "rgba(0,0,0,0.55)" }]}
              >
                <Feather name={call.muted ? "mic-off" : "mic"} size={15} color={call.muted ? "#000" : "#fff"} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="global-call-end-mini"
                onPress={onEnd}
                style={[styles.miniBtn, { backgroundColor: "#E5484D" }]}
              >
                <Feather name="phone-off" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </Draggable>
        </View>
      );
    }

    // Full-screen video call
    const localW = 100;
    const localH = 150;
    return (
      <Modal
        visible
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onEnd}
      >
        <View style={styles.videoContainer}>
          {/* Remote video (large) */}
          {call.remoteStream ? (
            <VideoView
              stream={call.remoteStream}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          ) : (
            <LinearGradient
              colors={["#0B0B10", "#171013"]}
              style={[styles.remoteVideo, { alignItems: "center", justifyContent: "center" }]}
            >
              {peerAvatar(104, "rgba(255,255,255,0.18)")}
              <NxText variant="title" style={{ color: "#fff", marginTop: 20 }}>
                {name}
              </NxText>
              <NxText variant="bodySm" style={{ color: "rgba(255,255,255,0.65)", marginTop: 6 }}>
                {statusText}
              </NxText>
            </LinearGradient>
          )}

          {/* Top bar: minimize + name + timer */}
          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "transparent"]}
            style={[
              styles.videoTopBar,
              { paddingTop: insets.top + 10 },
            ]}
          >
            <TouchableOpacity
              testID="global-call-minimize-video"
              onPress={() => setMinimized(true)}
              style={[styles.topBarBtn, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            >
              <Feather name="chevron-down" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <NxText
                style={{ color: "#fff", fontSize: 16, fontFamily: fonts.bodySemi }}
                numberOfLines={1}
              >
                {name}
              </NxText>
              <NxText
                style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}
              >
                {statusText}
              </NxText>
            </View>
            <View style={{ width: 44 }} />
          </LinearGradient>

          {/* Local camera — draggable; profile shown when camera is off */}
          {call.localStream && (
            <Draggable
              minX={8}
              minY={insets.top + 8}
              maxX={screenWidth - localW - 8}
              maxY={screenHeight - localH - insets.bottom - 150}
              initialX={screenWidth - localW - 12}
              initialY={insets.top + 60}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: localW,
                height: localH,
                borderRadius: 16,
                overflow: "hidden",
                zIndex: 10,
                borderWidth: 2,
                borderColor: call.cameraOff ? "rgba(255,255,255,0.35)" : colors.primary,
              }}
            >
              {call.cameraOff ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#1A1A1F",
                    },
                  ]}
                >
                  {myAvatar(48)}
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <Feather name="video-off" size={11} color="rgba(255,255,255,0.7)" />
                    <NxText
                      style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginLeft: 4 }}
                    >
                      Camera off
                    </NxText>
                  </View>
                </View>
              ) : (
                <VideoView
                  stream={call.localStream}
                  style={StyleSheet.absoluteFillObject}
                  objectFit="cover"
                  zOrder={1}
                  mirror
                />
              )}
            </Draggable>
          )}

          {/* Controls */}
          <View style={[styles.videoCallControls, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              testID="global-call-mute"
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
              testID="global-call-camera"
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
              testID="global-call-end"
              onPress={onEnd}
              style={[styles.videoBtn, styles.endButton]}
            >
              <Feather name="phone-off" size={26} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              testID="global-call-switch"
              onPress={onSwitchCamera}
              style={[styles.videoBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            >
              <Feather name="refresh-cw" size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              testID="global-call-speaker"
              onPress={onSpeaker}
              style={[
                styles.videoBtn,
                {
                  backgroundColor: call.speakerOn
                    ? colors.primary
                    : "rgba(255,255,255,0.2)",
                },
              ]}
            >
              <Feather
                name="volume-2"
                size={22}
                color={call.speakerOn ? "#000" : "#fff"}
              />
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
        <LinearGradient colors={["#0B0B10", "#10141F"]} style={styles.fullOverlay}>
          <View
            style={[
              styles.incomingCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {peerAvatar(92, "rgba(255,255,255,0.18)")}
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
        </LinearGradient>
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
              {peerAvatar(88, "rgba(255,255,255,0.18)")}
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
            {peerAvatar(40, "rgba(255,255,255,0.15)")}
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
    paddingLeft: 10,
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
  miniBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  remoteVideo: {
    flex: 1,
    width: "100%",
  },
  videoTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 18,
    zIndex: 20,
  },
  topBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  videoCallControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  videoBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
});
