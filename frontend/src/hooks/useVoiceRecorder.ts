import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
} from "expo-audio";

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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);

  const timerRef = useRef<any>(null);
  const startMsRef = useRef(0);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const start = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();

    if (!permission.granted) return;

    await AudioModule.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
    recorder.record();

    startMsRef.current = Date.now();
    setElapsed(0);
    setState("recording");

    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startMsRef.current);
    }, 200);
  }, [recorder]);

  const stop = useCallback(async (): Promise<VoiceResult | null> => {
    if (state !== "recording") return null;

    stopTimer();
    setState("processing");

    const duration = Date.now() - startMsRef.current;

    await recorder.stop();

    const uri = recorder.uri;

    await AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    setElapsed(0);
    setState("idle");

    if (!uri) return null;

    return {
      uri,
      durationStr: fmtDuration(duration),
    };
  }, [recorder, state]);

  const cancel = useCallback(async () => {
    stopTimer();

    if (state === "recording") {
      try {
        await recorder.stop();
      } catch {}
    }

    await AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    setElapsed(0);
    setState("idle");
  }, [recorder, state]);

  return { state, elapsed, start, stop, cancel };
}
