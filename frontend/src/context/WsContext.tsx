import { Platform } from "react-native";
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

import { useAuth } from "@/src/context/AuthContext";

// On web the proxy (port 5000) routes /api/ws to the backend — use relative.
// On native use the explicit backend URL env var.
const isWeb = Platform.OS === "web";
const BASE  = isWeb ? "" : (process.env.EXPO_PUBLIC_BACKEND_URL ?? "");

export type WsEvent =
  | { type: "message"; message: any }
  | { type: "message_edit"; message: any }
  | { type: "message_react"; message: any }
  | { type: "message_read"; conversation_id: string; message_id: string; read_by: string[] }
  | { type: "message_delete"; message_id: string }
  | { type: "typing"; conversation_id: string; user_id: string; is_typing: boolean }
  | {
      type: "presence";
      user_id: string;
      online: boolean;
      online_status?: "online" | "idle" | "dnd" | "offline";
      last_seen: string;
    }
  | { type: "notification"; notification: any }
  | { type: "story_new"; story_id: string; user_id: string }
  | { type: "pong" };

type Listener = (e: WsEvent) => void;

type WsCtx = {
  connected: boolean;
  subscribe: (l: Listener) => () => void;
  send: (payload: any) => void;
};

const Ctx = createContext<WsCtx | null>(null);

export function WsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const [connected, setConnected] = useState(false);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!token) return;
    // On web: derive ws(s):// from the current page origin (proxy handles routing).
    // On native: convert the http(s) backend URL to ws(s).
    const wsUrl = isWeb
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`
      : BASE.replace(/^http/, "ws") + `/api/ws?token=${encodeURIComponent(token)}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (token) {
          reconnectRef.current = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          listenersRef.current.forEach((l) => l(data));
        } catch {}
      };
    } catch {
      reconnectRef.current = setTimeout(connect, 3000);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
      setConnected(false);
      return;
    }
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    };
  }, [token, connect]);

  const subscribe = useCallback((l: Listener) => {
    listenersRef.current.add(l);
    return () => { listenersRef.current.delete(l); };
  }, []);

  const send = useCallback((payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return <Ctx.Provider value={{ connected, subscribe, send }}>{children}</Ctx.Provider>;
}

export function useWs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWs must be inside WsProvider");
  return c;
}
