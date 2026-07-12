import React, { createContext, useContext, useState } from "react";

export type IncomingCall = {
  conversation_id: string;
  caller_id: string;
  caller_name?: string;
  caller_username?: string;
  caller_photo?: string;
};

type Ctx = {
  call: IncomingCall | null;
  onAccept?: () => void;
  onReject?: () => void;

  showCall: (
    call: IncomingCall,
    accept?: () => void,
    reject?: () => void
  ) => void;

  hideCall: () => void;
};

const IncomingCallContext = createContext<Ctx>({
  call: null,
  showCall: () => {},
  hideCall: () => {},
});

export function IncomingCallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [call, setCall] = useState<IncomingCall | null>(null);
  const [onAccept, setAccept] = useState<(() => void) | undefined>();
  const [onReject, setReject] = useState<(() => void) | undefined>();

  function showCall(
    c: IncomingCall,
    accept?: () => void,
    reject?: () => void
  ) {
    setCall(c);
    setAccept(() => accept);
    setReject(() => reject);
  }

  function hideCall() {
    setCall(null);
    setAccept(undefined);
    setReject(undefined);
  }

  return (
    <IncomingCallContext.Provider
      value={{
        call,
        onAccept,
        onReject,
        showCall,
        hideCall,
      }}
    >
      {children}
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  return useContext(IncomingCallContext);
}
