import { useCallback, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

export type ChatThemeKey =
  | "gold"
  | "emerald"
  | "ocean"
  | "rose"
  | "violet"
  | "graphite";

export type ChatWallpaperKey =
  | "none"
  | "midnight"
  | "sands"
  | "mint"
  | "dusk";

export interface ChatSettings {
  muted: boolean;
  soundEnabled: boolean;
  theme: ChatThemeKey;
  wallpaper: ChatWallpaperKey;
  readReceipts: boolean;
  typingIndicator: boolean;
  archived: boolean;
}

export const defaultChatSettings: ChatSettings = {
  muted: false,
  soundEnabled: true,
  theme: "gold",
  wallpaper: "none",
  readReceipts: true,
  typingIndicator: true,
  archived: false,
};

export const CHAT_THEMES: Record<ChatThemeKey, { sent: string; sentFg: string; label: string }> = {
  gold: { sent: "#CFA876", sentFg: "#070709", label: "Liquid Gold" },
  emerald: { sent: "#2FBF71", sentFg: "#070709", label: "Emerald" },
  ocean: { sent: "#3D8BFF", sentFg: "#070709", label: "Ocean" },
  rose: { sent: "#E85D75", sentFg: "#070709", label: "Rose" },
  violet: { sent: "#8B7CF6", sentFg: "#070709", label: "Violet" },
  graphite: { sent: "#5A5F6B", sentFg: "#F1EFE7", label: "Graphite" },
};

export const CHAT_WALLPAPERS: Record<
  ChatWallpaperKey,
  { bg: string; label: string; gradient?: [string, string] }
> = {
  none: { bg: "transparent", label: "Default" },
  midnight: { bg: "#0B1020", label: "Midnight", gradient: ["#0B1020", "#141B38"] },
  sands: { bg: "#221A12", label: "Sands", gradient: ["#221A12", "#3A2A1A"] },
  mint: { bg: "#0D1F18", label: "Mint", gradient: ["#0D1F18", "#16382A"] },
  dusk: { bg: "#1A1226", label: "Dusk", gradient: ["#1A1226", "#2E1B3F"] },
};

const keyOf = (conversationId: string, field: keyof ChatSettings) =>
  `chat:${conversationId}:${field}`;

export function useChatSettings(conversationId: string) {
  const [settings, setSettings] = useState<ChatSettings>(defaultChatSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    (async () => {
      const [muted, soundEnabled, theme, wallpaper, readReceipts, typingIndicator, archived] =
        await Promise.all([
          storage.getItem(keyOf(conversationId, "muted"), defaultChatSettings.muted),
          storage.getItem(keyOf(conversationId, "soundEnabled"), defaultChatSettings.soundEnabled),
          storage.getItem(keyOf(conversationId, "theme"), defaultChatSettings.theme),
          storage.getItem(keyOf(conversationId, "wallpaper"), defaultChatSettings.wallpaper),
          storage.getItem(keyOf(conversationId, "readReceipts"), defaultChatSettings.readReceipts),
          storage.getItem(keyOf(conversationId, "typingIndicator"), defaultChatSettings.typingIndicator),
          storage.getItem(keyOf(conversationId, "archived"), defaultChatSettings.archived),
        ]);
      if (!active) return;
      setSettings({
        muted: muted ?? defaultChatSettings.muted,
        soundEnabled: soundEnabled ?? defaultChatSettings.soundEnabled,
        theme: (theme as ChatThemeKey) || defaultChatSettings.theme,
        wallpaper: (wallpaper as ChatWallpaperKey) || defaultChatSettings.wallpaper,
        readReceipts: readReceipts ?? defaultChatSettings.readReceipts,
        typingIndicator: typingIndicator ?? defaultChatSettings.typingIndicator,
        archived: archived ?? defaultChatSettings.archived,
      });
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [conversationId]);

  const set = useCallback(
    async <K extends keyof ChatSettings>(field: K, value: ChatSettings[K]) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
      if (conversationId) {
        await storage.setItem(keyOf(conversationId, field), value as never);
      }
    },
    [conversationId],
  );

  const reset = useCallback(async () => {
    setSettings(defaultChatSettings);
    if (conversationId) {
      for (const field of Object.keys(defaultChatSettings) as (keyof ChatSettings)[]) {
        await storage.setItem(keyOf(conversationId, field), defaultChatSettings[field] as never);
      }
    }
  }, [conversationId]);

  return { settings, set, reset, loaded };
}
