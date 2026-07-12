import { useCallback, useEffect, useRef, useState } from "react";
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { createAudioPlayer } from "expo-audio";
import { api } from "@/src/api/client";
import { useIncomingCall } from "@/src/context/IncomingCallContext";

type CallState = "idle" | "calling" | "incoming" | "connecting" | "active";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const { showCall, hideCall } = useIncomingCall();

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);
  const incomingModeRef = useRef<"voice" | "video">("voice");
  const ringtoneRef = useRef(
    createAudioPlayer(require("@/assets/sounds/incoming_call.mp3"))
  );

  useEffect(() => {
    ringtoneRef.current.loop = true;
    ringtoneRef.current.volume = 1;
  }, []);

  const cleanup = useCallback(() => {
    try {
      InCallManager.setForceSpeakerphoneOn(null);
      InCallManager.stop();
    } catch {}

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    peerRef.current?.close();
    peerRef.current = null;
    remoteStreamRef.current = null;
    setRemoteStream(null);

    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    setMuted(false);
    setSpeakerOn(false);
    setCallState("idle");
    try {
      ringtoneRef.current.pause();
      void ringtoneRef.current.seekTo(0);
    } catch {}
    hideCall();
  }, [hideCall]);

  const createPeer = useCallback(async () => {
    if (peerRef.current) return peerRef.current;

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: videoEnabled
        ? {
            facingMode: frontCamera ? "user" : "environment",
          }
        : false,
    });

    localStreamRef.current = stream;
    setLocalStream(stream);

    InCallManager.start({ media: "audio" });
    InCallManager.setForceSpeakerphoneOn(false);
    setSpeakerOn(false);

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((track) => {
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
        hideCall();
        cleanup();
      }
    });

    (peer as any).addEventListener("track", (event: any) => {
      const stream = event.streams?.[0];
      if (!stream) return;

      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    });

    peerRef.current = peer;
    return peer;
  }, [cleanup, conversationId, send]);

  const flushPendingIce = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) return;

    for (const candidate of pendingIceRef.current) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }

    pendingIceRef.current = [];
  }, []);

  
  const startVideoCall = useCallback(async () => {
    setVideoEnabled(true);
    await startCall();
  }, [startCall]);

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
        mode: videoEnabled ? "video" : "voice",
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
      send({
        type: "call_end",
        conversation_id: conversationId,
      });
    }

    cleanup();
  }, [callState, cleanup, conversationId, send]);

  
  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (track && (track as any)._switchCamera) {
      (track as any)._switchCamera();
      setFrontCamera(v => !v);
    }
  }, []);

const toggleSpeaker = useCallback(() => {
    const next = !speakerOn;
    InCallManager.setForceSpeakerphoneOn(next);
    setSpeakerOn(next);
  }, [speakerOn]);

  
  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
  }, []);

const toggleMute = useCallback(() => {
    const next = !muted;

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });

    setMuted(next);
  }, [muted]);

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
        incomingModeRef.current = result.call.mode || "voice";

        showCall(
          {
            conversation_id: result.call.conversation_id,
            caller_id: result.call.caller_id,
          },
          () => {
            void acceptCall();
          },
          () => {
            endCall();
          }
        );

        try {
          ringtoneRef.current.play();
        } catch {}

        setCallState("incoming");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [conversationId, token]);

  useEffect(() => {
    return subscribe(async (event: any) => {
      if (event.conversation_id !== conversationId) return;

      if (event.type === "call_offer") {
        pendingOfferRef.current = event.sdp;
        incomingModeRef.current = event.mode || "voice";

        showCall(
          {
            conversation_id: event.conversation_id,
            caller_id: event.from,
          },
          () => {
            void acceptCall();
          },
          () => {
            endCall();
          }
        );

        setCallState("incoming");
      } else if (event.type === "call_answer") {
        const peer = peerRef.current;
        if (!peer) return;

        await peer.setRemoteDescription(
          new RTCSessionDescription(event.sdp)
        );
        await flushPendingIce();
        setCallState("connecting");
      } else if (event.type === "call_ice") {
        const peer = peerRef.current;

        if (peer?.remoteDescription) {
          await peer.addIceCandidate(
            new RTCIceCandidate(event.candidate)
          );
        } else {
          pendingIceRef.current.push(event.candidate);
        }
      } else if (event.type === "call_end") {
        hideCall();
        cleanup();
      }
    });
  }, [cleanup, conversationId, flushPendingIce, subscribe]);

  useEffect(() => cleanup, [cleanup]);

  return {
    callState,
    muted,
    speakerOn,
    startCall,
    startVideoCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    toggleVideo,
  };
}
