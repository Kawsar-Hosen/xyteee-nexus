import { useCallback, useEffect, useRef, useState } from "react";
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { api } from "@/src/api/client";

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

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);

  const cleanup = useCallback(() => {
    try {
      InCallManager.setForceSpeakerphoneOn(null);
      InCallManager.stop();
    } catch {}

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    peerRef.current?.close();
    peerRef.current = null;

    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    setMuted(false);
    setSpeakerOn(false);
    setCallState("idle");
  }, []);

  const createPeer = useCallback(async () => {
    if (peerRef.current) return peerRef.current;

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    localStreamRef.current = stream;

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
        cleanup();
      }
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

  const toggleSpeaker = useCallback(() => {
    const next = !speakerOn;
    InCallManager.setForceSpeakerphoneOn(next);
    setSpeakerOn(next);
  }, [speakerOn]);

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
    acceptCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
