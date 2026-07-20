import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/src/api/client";

type CallState = "idle" | "calling" | "incoming" | "connecting" | "active";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Lazy-load native modules so they are only initialised when a call
// is actually started — this prevents the modules from crashing the
// chat screen on mount (the root cause of the "tap chat → app exits" bug).
function requireWebRTC() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("react-native-webrtc") as {
    mediaDevices: any;
    RTCPeerConnection: any;
    RTCIceCandidate: any;
    RTCSessionDescription: any;
    MediaStream: any;
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

export function usePrivateVoiceCall({
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
  const [callState, setCallState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const pendingOfferRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);
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
      InCallManager.setForceSpeakerphoneOn(null);
      InCallManager.stop();
    } catch {}

    try {
      localStreamRef.current?.getTracks().forEach((track: any) => track.stop());
    } catch {}
    localStreamRef.current = null;

    try {
      peerRef.current?.close();
    } catch {}
    peerRef.current = null;

    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    setMuted(false);
    setSpeakerOn(false);
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
      video: false,
    });

    localStreamRef.current = stream;

    InCallManager.start({ media: "audio" });
    InCallManager.setForceSpeakerphoneOn(false);
    setSpeakerOn(false);

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((track: any) => {
      peer.addTrack(track, stream);
    });

    (peer as any).addEventListener("icecandidate", (event: any) => {
      if (event.candidate) {
        send({
          type: "call_ice",
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
        type: "call_offer",
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
        type: "call_answer",
        conversation_id: conversationId,
        sdp: answer,
      });
    } catch {
      cleanup();
    }
  }, [cleanup, conversationId, createPeer, flushPendingIce, send]);

  const endCall = useCallback(() => {
    if (callState !== "idle") {
      send({ type: "call_end", conversation_id: conversationId });
    }
    cleanup();
  }, [callState, cleanup, conversationId, send]);

  const toggleSpeaker = useCallback(() => {
    try {
      const InCallManager = requireInCallManager();
      const next = !speakerOn;
      InCallManager.setForceSpeakerphoneOn(next);
      setSpeakerOn(next);
    } catch {}
  }, [speakerOn]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track: any) => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  // Check for a pending incoming call when the screen opens.
  useEffect(() => {
    if (!token || !conversationId) return;
    let cancelled = false;
    api<{ call: any }>("/calls/pending", {
      token,
      query: { conversation_id: conversationId },
    })
      .then((result) => {
        if (cancelled || !result.call) return;
        pendingOfferRef.current = result.call.sdp;
        setCallState("incoming");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conversationId, token]);

  // Subscribe to real-time call signalling events.
  useEffect(() => {
    return subscribe(async (event: any) => {
      if (event.conversation_id !== conversationId) return;
      if (event.type === "call_offer") {
        pendingOfferRef.current = event.sdp;
        setCallState("incoming");
      } else if (event.type === "call_answer") {
        const peer = peerRef.current;
        if (!peer) return;
        const { RTCSessionDescription } = requireWebRTC();
        await peer.setRemoteDescription(new RTCSessionDescription(event.sdp));
        await flushPendingIce();
        setCallState("connecting");
      } else if (event.type === "call_ice") {
        const peer = peerRef.current;
        const { RTCIceCandidate } = requireWebRTC();
        if (peer?.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(event.candidate));
        } else {
          pendingIceRef.current.push(event.candidate);
        }
      } else if (event.type === "call_end") {
        cleanup();
      }
    });
  }, [cleanup, conversationId, flushPendingIce, subscribe]);

  useEffect(() => cleanup, [cleanup]);

  return {
    callState,
    muted,
    speakerOn,
    callDuration,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
