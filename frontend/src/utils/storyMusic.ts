export type StoryMusicTrack = {
  id: string;
  title: string;
  artist: string;
  emoji: string;
  source: number;
};

export const STORY_MUSIC: StoryMusicTrack[] = [
  {
    id: "sunrise",
    title: "Sunrise",
    artist: "Nexus Audio",
    emoji: "🌅",
    source: require("../../assets/audio/track_sunrise.mp3"),
  },
  {
    id: "city",
    title: "City Lights",
    artist: "Nexus Audio",
    emoji: "🌃",
    source: require("../../assets/audio/track_city.mp3"),
  },
  {
    id: "ocean",
    title: "Ocean Breeze",
    artist: "Nexus Audio",
    emoji: "🌊",
    source: require("../../assets/audio/track_ocean.mp3"),
  },
  {
    id: "neon",
    title: "Neon Nights",
    artist: "Nexus Audio",
    emoji: "🌆",
    source: require("../../assets/audio/track_neon.mp3"),
  },
  {
    id: "rain",
    title: "Gentle Rain",
    artist: "Nexus Audio",
    emoji: "🌧️",
    source: require("../../assets/audio/track_rain.mp3"),
  },
  {
    id: "midnight",
    title: "Midnight Drive",
    artist: "Nexus Audio",
    emoji: "🌙",
    source: require("../../assets/audio/track_midnight.mp3"),
  },
  {
    id: "golden",
    title: "Golden Hour",
    artist: "Nexus Audio",
    emoji: "☀️",
    source: require("../../assets/audio/track_golden.mp3"),
  },
  {
    id: "starlight",
    title: "Starlight",
    artist: "Nexus Audio",
    emoji: "✨",
    source: require("../../assets/audio/track_starlight.mp3"),
  },
];

export const storyMusicById = (
  id?: string | null
): StoryMusicTrack | null => STORY_MUSIC.find((t) => t.id === id) || null;
