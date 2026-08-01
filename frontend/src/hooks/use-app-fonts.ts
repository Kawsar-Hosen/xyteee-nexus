import { useState, useEffect } from "react";
import * as Font from "expo-font";

/**
 * Loads app fonts with a graceful fallback.
 *
 * expo-font uses fontfaceobserver on web, which throws an uncaught
 * "6000ms timeout exceeded" error when fonts are slow to load.
 * We wrap Font.loadAsync in try/catch so that timeout is caught and
 * the app continues with system fonts instead of crashing.
 */
export function useAppFonts(): [boolean, Error | null] {
  const [state, setState] = useState<[boolean, Error | null]>([false, null]);

  useEffect(() => {
    let cancelled = false;

    Font.loadAsync({
      PlayfairDisplay: require("../../assets/fonts/PlayfairDisplay-Regular.ttf"),
      "PlayfairDisplay-Bold": require("../../assets/fonts/PlayfairDisplay-Bold.ttf"),
      "PlayfairDisplay-Italic": require("../../assets/fonts/PlayfairDisplay-Regular.ttf"),
      Outfit: require("../../assets/fonts/Outfit-Regular.ttf"),
      "Outfit-Medium": require("../../assets/fonts/Outfit-Medium.ttf"),
      "Outfit-SemiBold": require("../../assets/fonts/Outfit-SemiBold.ttf"),
    })
      .then(() => {
        if (!cancelled) setState([true, null]);
      })
      .catch((err: Error) => {
        // fontfaceobserver timeout or any other load error — degrade
        // gracefully with system fonts rather than crashing.
        console.warn("[fonts] failed to load, using system fonts:", err?.message);
        if (!cancelled) setState([true, err]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
