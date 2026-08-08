import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { AudioModule } from "expo-audio";

import { useAuth } from "@/src/context/AuthContext";
import { useWs } from "@/src/context/WsContext";
import { api } from "@/src/api/client";
import { CallOverlay } from "@/src/components/CallOverlay";

export type CallKind = "voice" | "video";
export type CallPhase = "idle" | "calling" | "incoming" | "connecting" | "active";

export type CallPeer = {
  user_id?: string;
  display_name?: string;
  profile_picture?: string;
  badge_type?: string | null;
  badge_icon?: string | null;
  badge_expires_at?: string | null;
  profile_frame?: string | null;
  achievement_level?: string | null;
  profile_animation?: string | null;
  profile_animation_speed?: string | null;
  profile_animation_intensity?: string | null;
};

export type ActiveCall = {
  kind: CallKind;
  conversationId: string;
  callerId?: string;
  peer: CallPeer | null;
  phase: CallPhase;
  muted: boolean;
  speakerOn: boolean;
  cameraOff: boolean;
  duration: number;
  localStream: any;
  remoteStream: any;
};

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Lazy-load native modules only when a call actually starts — prevents the
// modules from crashing screens on mount.
function requireWebRTC() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-webrtc") as {
    mediaDevices: any;
    RTCPeerConnection: any;
    RTCIceCandidate: any;
    RTCSessionDescription: any;
    MediaStream: any;
  };
}

function requireInCallManager(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("react-native-incall-manager") as any).default;
}

let cachedForeground: any = null;
function requireCallForeground(): any {
  if (Platform.OS === "web") return null;
  try {
    if (!cachedForeground) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeModules } = require("react-native");
      cachedForeground = NativeModules.CallForegroundService;
    }
    return cachedForeground;
  } catch {
    return null;
  }
}

function startForegroundService(kind: CallKind, title: string, subtitle: string) {
  try {
    requireCallForeground()?.start(kind, title, subtitle);
  } catch {}
}

function stopForegroundService() {
  try {
    requireCallForeground()?.stop();
  } catch {}
}

/** Format seconds → "m:ss" */
export function formatCallDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type CallCtxType = {
  call: ActiveCall | null;
  startCall: (kind: CallKind, conversationId: string, peer?: CallPeer | null) => void;
  acceptCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  checkPending: (conversationId?: string) => Promise<void>;
};

const Ctx = createContext<CallCtxType | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { subscribe, send, connected } = useWs();

  const [call, setCall] = useState<ActiveCall | null>(null);

  // Ref mirror of `call` so event handlers / async flows never read stale state.
  const callRef = useRef<ActiveCall | null>(null);

  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const pendingOfferRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);
  const ringStateRef = useRef<"none" | "ringback" | "ringtone">("none");
  const ringStopTimerRef = useRef<any>(null);
  const durationTimerRef = useRef<any>(null);
  const conversationIdRef = useRef<string | null>(null);
  const kindRef = useRef<CallKind>("voice");
  const callerIdRef = useRef<string | undefined>(undefined);
  const speakerOnRef = useRef(false);
  const mutedRef = useRef(false);
  const cameraOffRef = useRef(false);
  const frontCameraRef = useRef(true);
  // Invalidates in-flight incoming-call lookups (a newer offer / cleanup wins).
  const incomingGenRef = useRef(0);

  const patchCall = useCallback(
    (updater: (prev: ActiveCall | null) => ActiveCall | null) => {
      setCall((prev) => {
        const next = updater(prev);
        callRef.current = next;
        return next;
      });
    },
    []
  );

  const stopAllSounds = useCallback(() => {
    try {
      const InCallManager = requireInCallManager();
      if (ringStateRef.current === "ringback") InCallManager.stopRingback();
      if (ringStateRef.current === "ringtone") InCallManager.stopRingtone();
    } catch {}
    ringStateRef.current = "none";
  }, []);

  const cleanup = useCallback(
    (sendEnd: boolean) => {
      const conv = conversationIdRef.current;
      const kind = kindRef.current;
      const wasActive =
        callRef.current && callRef.current.phase !== "idle";

      // Notify the other side when we're the one ending the call.
      if (sendEnd && conv && wasActive) {
        send({
          type: kind === "video" ? "video_call_end" : "call_end",
          conversation_id: conv,
        });
      }

      incomingGenRef.current++;
      stopAllSounds();
      clearTimeout(ringStopTimerRef.current);
      ringStopTimerRef.current = null;

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      try {
        const InCallManager = requireInCallManager();
        InCallManager.setForceSpeakerphoneOn(null);
        InCallManager.setKeepScreenOn(false);
        InCallManager.stop();
      } catch {}

      // Kill the foreground service → all background resources released.
      stopForegroundService();

      // Restore the normal audio mode so voice recording works after a call.
      if (Platform.OS !== "web") {
        try {
          AudioModule.setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          });
        } catch {}
      }

      // Release mic/camera/media tracks and tear down the peer connection.
      try {
        localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
      } catch {}
      localStreamRef.current = null;
      try {
        peerRef.current?.close();
      } catch {}
      peerRef.current = null;

      pendingOfferRef.current = null;
      pendingIceRef.current = [];
      conversationIdRef.current = null;
      kindRef.current = "voice";
      callerIdRef.current = undefined;
      speakerOnRef.current = false;
      mutedRef.current = false;
      cameraOffRef.current = false;
      frontCameraRef.current = true;

      patchCall(() => null);
    },
    [patchCall, send, stopAllSounds]
  );

  const flushPendingIce = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) return;
    const { RTCIceCandidate } = requireWebRTC();
    for (const candidate of pendingIceRef.current) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingIceRef.current = [];
  }, []);

  const fetchPeerInfo = useCallback(
    async (userId: string): Promise<CallPeer | null> => {
      if (!token) return null;
      try {
        const u = await api<any>(`/users/${encodeURIComponent(userId)}`, { token });
        if (!u?.user_id) return null;
        return {
          user_id: u.user_id,
          display_name: u.display_name,
          profile_picture: u.profile_picture,
          badge_type: u.badge_type,
          badge_icon: u.badge_icon,
          badge_expires_at: u.badge_expires_at,
          profile_frame: u.profile_frame,
          achievement_level: u.achievement_level,
          profile_animation: u.profile_animation,
          profile_animation_speed: u.profile_animation_speed,
          profile_animation_intensity: u.profile_animation_intensity,
        };
      } catch {
        return null;
      }
    },
    [token]
  );

  const createPeer = useCallback(
    async (kind: CallKind) => {
      if (peerRef.current) return peerRef.current;

      const { mediaDevices, RTCPeerConnection } = requireWebRTC();
      const InCallManager = requireInCallManager();

      // Reset any leftover expo-audio recording mode before opening the mic.
      // On Android a stale `allowsRecording: true` keeps the WebRTC audio
      // device module from capturing/playing call audio.
      if (Platform.OS !== "web") {
        try {
          await AudioModule.setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          });
        } catch {}
      }

      // Configure Android call audio routing *before* getUserMedia so the
      // AudioDeviceModule starts with the right mode. Video defaults to the
      // loudspeaker, voice to the earpiece.
      try {
        InCallManager.start({ media: kind === "video" ? "video" : "audio" });
      } catch {}
      try {
        InCallManager.setForceSpeakerphoneOn(kind === "video");
      } catch {}
      speakerOnRef.current = kind === "video";
      if (kind === "video") {
        // Keep the screen awake during video calls.
        try {
          InCallManager.setKeepScreenOn(true);
        } catch {}
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video" ? { facingMode: "user" } : false,
      });

      localStreamRef.current = stream;

      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      stream.getTracks().forEach((track: any) => {
        peer.addTrack(track, stream);
      });

      const eventPrefix = kind === "video" ? "video_call" : "call";

      (peer as any).addEventListener("track", (event: any) => {
        if (event.streams && event.streams[0]) {
          patchCall((prev) =>
            prev ? { ...prev, remoteStream: event.streams[0] } : prev
          );
        } else if (event.track) {
          try {
            const { MediaStream } = requireWebRTC();
            patchCall((prev) =>
              prev ? { ...prev, remoteStream: new MediaStream([event.track]) } : prev
            );
          } catch {}
        }
      });

      (peer as any).addEventListener("icecandidate", (event: any) => {
        if (event.candidate) {
          send({
            type: `${eventPrefix}_ice`,
            conversation_id: conversationIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      });

      (peer as any).addEventListener("connectionstatechange", () => {
        const state = peer.connectionState;
        if (state === "connected") {
          patchCall((prev) =>
            prev && prev.phase !== "active" ? { ...prev, phase: "active" } : prev
          );
        } else if (state === "failed" || state === "closed") {
          cleanup(true);
        }
      });

      peerRef.current = peer;
      return peer;
    },
    [cleanup, patchCall, send]
  );

  const startCall = useCallback(
    async (kind: CallKind, conversationId: string, peer?: CallPeer | null) => {
      if (callRef.current) return;
      incomingGenRef.current++;
      conversationIdRef.current = conversationId;
      kindRef.current = kind;
      callerIdRef.current = undefined;
      pendingOfferRef.current = null;
      patchCall(() => ({
        kind,
        conversationId,
        callerId: undefined,
        peer: peer || null,
        phase: "calling",
        muted: false,
        speakerOn: kind === "video",
        cameraOff: false,
        duration: 0,
        localStream: null,
        remoteStream: null,
      }));
      try {
        const p = await createPeer(kind);
        const offer = await p.createOffer();
        await p.setLocalDescription(offer);
        send({
          type: kind === "video" ? "video_call_offer" : "call_offer",
          conversation_id: conversationId,
          sdp: offer,
        });
      } catch {
        cleanup(true);
      }
    },
    [cleanup, createPeer, patchCall, send]
  );

  const acceptCall = useCallback(async () => {
    const offer = pendingOfferRef.current;
    if (!offer) return;
    patchCall((prev) => (prev ? { ...prev, phase: "connecting" } : prev));
    try {
      const { RTCSessionDescription } = requireWebRTC();
      const kind = kindRef.current;
      const peer = await createPeer(kind);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send({
        type: kind === "video" ? "video_call_answer" : "call_answer",
        conversation_id: conversationIdRef.current,
        sdp: answer,
      });
    } catch {
      cleanup(true);
    }
  }, [cleanup, createPeer, flushPendingIce, patchCall, send]);

  const endCall = useCallback(() => {
    cleanup(true);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const next = !callRef.current?.muted;
    try {
      localStreamRef.current?.getAudioTracks().forEach((t: any) => {
        t.enabled = !next;
      });
    } catch {}
    mutedRef.current = next;
    patchCall((prev) => (prev ? { ...prev, muted: next } : prev));
  }, [patchCall]);

  const toggleSpeaker = useCallback(() => {
    const next = !callRef.current?.speakerOn;
    try {
      requireInCallManager().setForceSpeakerphoneOn(next);
    } catch {}
    speakerOnRef.current = next;
    patchCall((prev) => (prev ? { ...prev, speakerOn: next } : prev));
  }, [patchCall]);

  const toggleCamera = useCallback(() => {
    const next = !callRef.current?.cameraOff;
    try {
      localStreamRef.current?.getVideoTracks().forEach((t: any) => {
        t.enabled = !next;
      });
    } catch {}
    cameraOffRef.current = next;
    patchCall((prev) => (prev ? { ...prev, cameraOff: next } : prev));
  }, [patchCall]);

  const switchCamera = useCallback(async () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()?.find(() => true);
    if (!videoTrack) return;
    try {
      if (typeof (videoTrack as any)._switchCamera === "function") {
        (videoTrack as any)._switchCamera();
      }
      frontCameraRef.current = !frontCameraRef.current;
    } catch {}
  }, []);

  const checkPending = useCallback(
    async (conversationId?: string) => {
      if (!token || callRef.current) return;
      try {
        const result = await api<{ call: any }>("/calls/pending", {
          token,
          query: conversationId ? { conversation_id: conversationId } : {},
        });
        const p = result?.call;
        if (!p || callRef.current) return;

        const kind: CallKind = p.type === "video" ? "video" : "voice";
        const conv: string = p.conversation_id;

        const gen = ++incomingGenRef.current;
        conversationIdRef.current = conv;
        kindRef.current = kind;
        callerIdRef.current = p.caller_id;
        pendingOfferRef.current = p.sdp;

        const peerInfo = await fetchPeerInfo(p.caller_id);
        if (gen !== incomingGenRef.current || callRef.current) return;

        patchCall(() => ({
          kind,
          conversationId: conv,
          callerId: p.caller_id,
          peer: peerInfo,
          phase: "incoming",
          muted: false,
          speakerOn: kind === "video",
          cameraOff: false,
          duration: 0,
          localStream: null,
          remoteStream: null,
        }));
      } catch {}
    },
    [fetchPeerInfo, patchCall, token]
  );

  // Ringing sounds + call timer based on the current phase.
  useEffect(() => {
    const phase = call?.phase;
    if (phase === "calling") {
      try {
        requireInCallManager().startRingback("_DTMF_");
        ringStateRef.current = "ringback";
      } catch {}
    } else if (phase === "incoming") {
      try {
        requireInCallManager().startRingtone("_DEFAULT_", undefined, undefined, 60);
        ringStateRef.current = "ringtone";
      } catch {}
      clearTimeout(ringStopTimerRef.current);
      ringStopTimerRef.current = setTimeout(() => {
        try {
          requireInCallManager().stopRingtone();
          ringStateRef.current = "none";
        } catch {}
      }, 60_000);
    } else if (phase === "active") {
      stopAllSounds();
      // Re-assert Android audio routing once connected (some devices drop the
      // earpiece/speaker route after the ICE handshake).
      try {
        requireInCallManager().setForceSpeakerphoneOn(speakerOnRef.current);
      } catch {}
      patchCall((prev) => (prev ? { ...prev, duration: 0 } : prev));
      durationTimerRef.current = setInterval(() => {
        patchCall((prev) =>
          prev ? { ...prev, duration: prev.duration + 1 } : prev
        );
      }, 1000);
    } else {
      // idle / connecting — stop sounds, clear timer
      stopAllSounds();
      clearTimeout(ringStopTimerRef.current);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }

    return () => {
      clearTimeout(ringStopTimerRef.current);
      if (phase === "active" && durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [call?.phase, patchCall, stopAllSounds]);

  // Foreground service: running while a call is active, stopped on end/reject.
  const fgsThrottleRef = useRef(0);
  useEffect(() => {
    if (call?.phase === "active") {
      const now = Date.now();
      if (call.duration > 0 && now - fgsThrottleRef.current < 5000) return;
      fgsThrottleRef.current = now;
      startForegroundService(
        call.kind,
        call.peer?.display_name || "Nexus call",
        `Ongoing · ${formatCallDuration(call.duration)}`
      );
    } else if (!call) {
      fgsThrottleRef.current = 0;
      stopForegroundService();
    }
  }, [call?.phase, call?.duration, call?.kind, call?.peer?.display_name]);

  // Real-time call signalling from the WebSocket.
  useEffect(() => {
    return subscribe(async (event: any) => {
      const t = event?.type;
      const conv = event?.conversation_id;
      if (!conv) return;

      if (t === "call_offer" || t === "video_call_offer") {
        // Busy — ignore new offers while in a call.
        if (callRef.current) return;
        const kind: CallKind = t === "video_call_offer" ? "video" : "voice";
        const gen = ++incomingGenRef.current;
        conversationIdRef.current = conv;
        kindRef.current = kind;
        callerIdRef.current = event.user_id;
        pendingOfferRef.current = event.sdp;

        const peerInfo = await fetchPeerInfo(event.user_id);
        if (gen !== incomingGenRef.current || callRef.current) return;

        patchCall(() => ({
          kind,
          conversationId: conv,
          callerId: event.user_id,
          peer: peerInfo,
          phase: "incoming",
          muted: false,
          speakerOn: kind === "video",
          cameraOff: false,
          duration: 0,
          localStream: null,
          remoteStream: null,
        }));
      } else if (t === "call_answer" || t === "video_call_answer") {
        if (conv !== conversationIdRef.current) return;
        const peer = peerRef.current;
        if (!peer) return;
        const { RTCSessionDescription } = requireWebRTC();
        await peer.setRemoteDescription(new RTCSessionDescription(event.sdp));
        await flushPendingIce();
        patchCall((prev) =>
          prev && prev.conversationId === conv
            ? { ...prev, phase: "connecting" }
            : prev
        );
      } else if (t === "call_ice" || t === "video_call_ice") {
        if (conv !== conversationIdRef.current) return;
        const peer = peerRef.current;
        const { RTCIceCandidate } = requireWebRTC();
        if (peer?.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(event.candidate));
        } else {
          pendingIceRef.current.push(event.candidate);
        }
      } else if (t === "call_end" || t === "video_call_end") {
        if (conv !== conversationIdRef.current) return;
        cleanup(false);
      }
    });
  }, [cleanup, fetchPeerInfo, flushPendingIce, patchCall, subscribe]);

  // Poll for a pending incoming call (app was backgrounded/closed and missed
  // the live WS offer, then reopened). Also called explicitly when the user
  // taps "Accept" on a call notification.
  useEffect(() => {
    if (!token || !connected) return;
    const iv = setInterval(() => {
      if (!callRef.current) checkPending();
    }, 15000);
    return () => clearInterval(iv);
  }, [checkPending, connected, token]);

  // When the app returns to the foreground: re-assert audio routing for an
  // ongoing call, or look for a pending incoming call.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (callRef.current) {
        try {
          requireInCallManager().setForceSpeakerphoneOn(speakerOnRef.current);
        } catch {}
      } else {
        checkPending();
      }
    });
    return () => sub.remove();
  }, [checkPending]);

  // Guard: if the user signs out mid-call, tear everything down.
  useEffect(() => {
    if (!token && callRef.current) {
      cleanup(true);
    }
  }, [token, cleanup]);

  return (
    <Ctx.Provider
      value={{
        call,
        startCall,
        acceptCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleCamera,
        switchCamera,
        checkPending,
      }}
    >
      {children}
      <CallOverlay
        call={call}
        onAccept={acceptCall}
        onEnd={endCall}
        onMute={toggleMute}
        onSpeaker={toggleSpeaker}
        onCamera={toggleCamera}
        onSwitchCamera={switchCamera}
      />
    </Ctx.Provider>
  );
}

export function useCallManager() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCallManager must be inside CallProvider");
  return c;
}
