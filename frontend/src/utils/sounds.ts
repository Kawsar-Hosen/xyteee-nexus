/**
 * Chat sound effects.
 * send   → playing when you send a message
 * receive → playing when a message arrives from someone else
 * emoji  → playing when an emoji reaction / emoji message is sent
 */
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { createAudioPlayer } from "expo-audio";

import sendWav from "@/assets/sounds/send.wav";
import receiveWav from "@/assets/sounds/receive.wav";
import emojiWav from "@/assets/sounds/emoji.wav";

const players: { send?: any; receive?: any; emoji?: any } = {};

function getSource(sound: "send" | "receive" | "emoji") {
  if (Platform.OS === "web") {
    const asset = Asset.fromModule(
      sound === "send" ? sendWav : sound === "receive" ? receiveWav : emojiWav
    );
    return asset.uri;
  }
  return sound === "send" ? sendWav : sound === "receive" ? receiveWav : emojiWav;
}

function ensurePlayer(sound: "send" | "receive" | "emoji") {
  if (players[sound]) return players[sound];
  try {
    players[sound] = createAudioPlayer(getSource(sound));
    players[sound].loop = false;
  } catch {
    players[sound] = null;
  }
  return players[sound];
}

export function playChatSound(sound: "send" | "receive" | "emoji") {
  const player = ensurePlayer(sound);
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {}
}

export function playSendSound() {
  playChatSound("send");
}

export function playReceiveSound() {
  playChatSound("receive");
}

export function playEmojiSound() {
  playChatSound("emoji");
}
