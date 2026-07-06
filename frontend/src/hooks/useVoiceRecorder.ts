/**
 * useVoiceRecorder — NATIVE stub.
 * Full recording requires expo-audio to be installed.
 * On native without expo-audio the hook gracefully no-ops.
 * The web implementation (useVoiceRecorder.web.ts) is used for web builds.
 */
import { useCallback, useState } from "react";
import { Alert } from "react-native";

export type RecordingState = "idle" | "recording" | "processing";

export type VoiceResult = {
  uri: string;
  durationStr: string;
};

export function useVoiceRecorder() {
  const [state] = useState<RecordingState>("idle");
  const [elapsed] = useState(0);

  const start = useCallback(async () => {
    Alert.alert(
      "Voice Messages",
      "Voice recording is available in the full mobile build. Install expo-audio to enable this feature.",
      [{ text: "OK" }]
    );
  }, []);

  const stop = useCallback(async (): Promise<VoiceResult | null> => null, []);
  const cancel = useCallback(async () => {}, []);

  return { state, elapsed, start, stop, cancel };
}
