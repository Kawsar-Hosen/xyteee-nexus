import React, { createContext, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";
import { palette, ThemeMode, ThemePalette } from "@/src/theme";

type ThemeCtx = {
  mode: ThemeMode;
  colors: ThemePalette;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>("theme_mode", "");
      if (stored === "dark" || stored === "light") {
        setModeState(stored);
      }
      // Default: dark (Obsidian aesthetic). User can toggle from Profile / Settings.
    })();
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    storage.setItem("theme_mode", m);
  };

  const toggle = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <Ctx.Provider value={{ mode, colors: palette[mode], toggle, setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be inside ThemeProvider");
  return c;
}
