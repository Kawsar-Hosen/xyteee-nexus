import React, { createContext, useContext, useState, useCallback } from "react";

interface AIChatContextValue {
  open: boolean;
  toggle: () => void;
  openChat: () => void;
}

const AIChatContext = createContext<AIChatContextValue>({
  open: false,
  toggle: () => {},
  openChat: () => {},
});

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const openChat = useCallback(() => setOpen(true), []);
  return (
    <AIChatContext.Provider value={{ open, toggle, openChat }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  return useContext(AIChatContext);
}
