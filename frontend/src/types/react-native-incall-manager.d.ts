declare module "react-native-incall-manager" {
  const InCallManager: {
    start(options?: { media?: "audio" | "video"; auto?: boolean; ringback?: string }): void;
    stop(options?: { busytone?: string }): void;
    setForceSpeakerphoneOn(flag: boolean | null): void;
    setSpeakerphoneOn(flag: boolean): void;
  };

  export default InCallManager;
}
