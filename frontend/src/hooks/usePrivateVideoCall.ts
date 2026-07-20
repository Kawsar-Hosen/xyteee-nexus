import { useCallback, useEffect, useRef, useState } from "react";

type VideoCallState = "idle" | "calling" | "incoming" | "connecting" | "active";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Lazy-load native modules — prevents crash on chat screen mount.
function requireWebRTC() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("react-native-webrtc") as {
    mediaDevices: any;
    RTCPeerConnection: any;
    RTCIceCandidate: any;
    RTCSessionDescription: any;
  };
}

function requireInCallManager(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (require("react-native-incall-manager") as any).default;
}

/** Format seconds → "m:ss" */
export function formatCallDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function usePrivateVideoCall({
  conversationId,
  token,
  subscribe,
  send,
}: {
  conversationId: string;
  token: string | null;
  subscribe: (listener: (event: any) => void) => () => void;
  send: (payload: any) => void;
}) {
  const [callState, setCallState] = useState<VideoCallState>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);

  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const pendingOfferRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);
  const frontCameraRef = useRef<boolean>(true);
  const ringStateRef = useRef<"none" | "ringback" | "ringtone">("none");
  const durationTimerRef = useRef<any>(null);

  const stopAllSounds = useCallback(() => {
    try {
      const InCallManager = requireInCallManager();
      if (ringStateRef.current === "ringback") InCallManager.stopRingback();
      if (ringStateRef.current === "ringtone") InCallManager.stopRingtone();
    } catch {}
    ringStateRef.current = "none";
  }, []);

  const cleanup = useCallback(() => {
    stopAllSounds();

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    setCallDuration(0);

    try {
      const InCallManager = requireInCallManager();
      InCallManager.stop();
    } catch {}

    try {
      localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    } catch {}
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);

    try {
      peerRef.current?.close();
    } catch {}
    peerRef.current = null;

    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    frontCameraRef.current = true;
    setMuted(false);
    setCameraOff(false);
    setCallState("idle");
  }, [stopAllSounds]);

  // Manage ringing sounds and call timer based on callState changes.
  useEffect(() => {
    if (callState === "calling") {
      // Caller hears ringback (outgoing ringing tone)
      try {
        const InCallManager = requireInCallManager();
        InCallManager.startRingback("_DTMF_");
        ringStateRef.current = "ringback";
      } catch {}
    } else if (callState === "incoming") {
      // Receiver phone rings
      try {
        const InCallManager = requireInCallManager();
        InCallManager.startRingtone("_DEFAULT_");
        ringStateRef.current = "ringtone";
      } catch {}
    } else if (callState === "active") {
      // Call connected — stop all sounds and start the duration timer
      stopAllSounds();
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } else {
      // idle / connecting — stop sounds, clear timer
      stopAllSounds();
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }

    return () => {
      if (callState === "active" && durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [callState, stopAllSounds]);

  const createPeer = useCallback(async () => {
    if (peerRef.current) return peerRef.current;

    const { mediaDevices, RTCPeerConnection } = requireWebRTC();
    const InCallManager = requireInCallManager();

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: "user" },
    });

    localStreamRef.current = stream;
    setLocalStream(stream);

    InCallManager.start({ media: "video" });

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((track: any) => {
      peer.addTrack(track, stream);
    });

    (peer as any).addEventListener("track", (event: any) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    });

    (peer as any).addEventListener("icecandidate", (event: any) => {
      if (event.candidate) {
        send({
          type: "video_call_ice",
          conversation_id: conversationId,
          candidate: event.candidate.toJSON(),
        });
      }
    });

    (peer as any).addEventListener("connectionstatechange", () => {
      if (peer.connectionState === "connected") {
        setCallState("active");
      } else if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed"
      ) {
        cleanup();
      }
    });

    peerRef.current = peer;
    return peer;
  }, [cleanup, conversationId, send]);

  const flushPendingIce = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) return;
    const { RTCIceCandidate } = requireWebRTC();
    for (const candidate of pendingIceRef.current) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingIceRef.current = [];
  }, []);

  const startCall = useCallback(async () => {
    if (callState !== "idle") return;
    setCallState("calling");
    try {
      const peer = await createPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send({
        type: "video_call_offer",
        conversation_id: conversationId,
        sdp: offer,
      });
    } catch {
      cleanup();
    }
  }, [callState, cleanup, conversationId, createPeer, send]);

  const acceptCall = useCallback(async () => {
    const offer = pendingOfferRef.current;
    if (!offer) return;
    setCallState("connecting");
    try {
      const { RTCSessionDescription } = requireWebRTC();
      const peer = await createPeer();
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send({
        type: "video_call_answer",
        conversation_id: conversationId,
        sdp: answer,
      });
    } catch {
      cleanup();
    }
  }, [cleanup, conversationId, createPeer, flushPendingIce, send]);

  const endCall = useCallback(() => {
    if (callState !== "idle") {
      send({ type: "video_call_end", conversation_id: conversationId });
    }
    cleanup();
  }, [callState, cleanup, conversationId, send]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t: any) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((t: any) => {
      t.enabled = !next;
    });
    setCameraOff(next);
  }, [cameraOff]);

  const switchCamera = useCallback(async () => {
    const videoTrack = localStreamRef.current
      ?.getVideoTracks()
      ?.find(() => true);
    if (!videoTrack) return;
    try {
      // react-native-webrtc exposes _switchCamera on the track
      if (typeof (videoTrack as any)._switchCamera === "function") {
        (videoTrack as any)._switchCamera();
      }
      frontCameraRef.current = !frontCameraRef.current;
    } catch {}
  }, []);

  // Subscribe to real-time video call signalling events.
  useEffect(() => {
    return subscribe(async (event: any) => {
      if (event.conversation_id !== conversationId) return;

      if (event.type === "video_call_offer") {
        pendingOfferRef.current = event.sdp;
        setCallState("incoming");
      } else if (event.type === "video_call_answer") {
        const peer = peerRef.current;
        if (!peer) return;
        const { RTCSessionDescription } = requireWebRTC();
        await peer.setRemoteDescription(new RTCSessionDescription(event.sdp));
        await flushPendingIce();
        setCallState("connecting");
      } else if (event.type === "video_call_ice") {
        const peer = peerRef.current;
        const { RTCIceCandidate } = requireWebRTC();
        if (peer?.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(event.candidate));
        } else {
          pendingIceRef.current.push(event.candidate);
        }
      } else if (event.type === "video_call_end") {
        cleanup();
      }
    });
  }, [cleanup, conversationId, flushPendingIce, subscribe]);

  useEffect(() => cleanup, [cleanup]);

  return {
    callState,
    muted,
    cameraOff,
    localStream,
    remoteStream,
    callDuration,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
  };
}
