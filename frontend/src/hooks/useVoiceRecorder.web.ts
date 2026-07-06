/**
 * useVoiceRecorder — WEB implementation using MediaRecorder API.
 * This file is automatically chosen by Metro/Expo for web builds.
 */
import { useCallback, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "processing";

export type VoiceResult = {
  uri: string;
  durationStr: string;
};

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null);
  const timerRef = useRef<any>(null);
  const startMsRef = useRef(0);

  const startTimer = () => {
    startMsRef.current = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - startMsRef.current), 200);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recRef.current = { mr, stream, chunks };
      mr.start();
      setState("recording");
      startTimer();
    } catch {
      setState("idle");
    }
  }, []);

  const stop = useCallback(async (): Promise<VoiceResult | null> => {
    stopTimer();
    const dur = fmtDuration(Date.now() - startMsRef.current);
    setState("processing");
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) { setState("idle"); return null; }
    return new Promise((resolve) => {
      rec.mr.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(rec.chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setState("idle");
          setElapsed(0);
          resolve({ uri: reader.result as string, durationStr: dur });
        };
        reader.readAsDataURL(blob);
      };
      rec.mr.stop();
    });
  }, []);

  const cancel = useCallback(async () => {
    stopTimer();
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { try { rec.mr.stop(); rec.stream.getTracks().forEach((t) => t.stop()); } catch {} }
    setState("idle");
    setElapsed(0);
  }, []);

  return { state, elapsed, start, stop, cancel };
}
