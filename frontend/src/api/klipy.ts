/**
 * KLIPY GIF API client.
 *
 * Key lives in EXPO_PUBLIC_KLIPY_API_KEY (never hardcoded). The API allows
 * cross-origin browser calls (Access-Control-Allow-Origin: *), so both React
 * Native and Web can hit it directly.
 *
 * Docs: https://docs.klipy.com
 */

const KEY = process.env.EXPO_PUBLIC_KLIPY_API_KEY ?? "";
const BASE = "https://api.klipy.com/api/v1";

type KlipyFormat = {
  url: string;
  width: number;
  height: number;
  size: number;
};

type KlipySize = {
  gif?: KlipyFormat;
  webp?: KlipyFormat;
  jpg?: KlipyFormat;
  png?: KlipyFormat;
  mp4?: KlipyFormat;
  webm?: KlipyFormat;
};

export type KlipyGif = {
  id: string;
  slug: string;
  title: string;
  type: string;
  tags: string[];
  blur_preview?: string;
  file: {
    sm?: KlipySize;
    md?: KlipySize;
    hd?: KlipySize;
  };
};

export type KlipyCategory = {
  category: string;
  query: string;
  preview_url: string;
};

export type KlipyPage = {
  items: KlipyGif[];
  page: number;
  hasNext: boolean;
};

type KlipyListResponse = {
  data: {
    data: KlipyGif[];
    current_page: number;
    per_page: number;
    has_next: boolean;
    meta: Record<string, unknown>;
  };
};

const PER_PAGE = 24;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${KEY}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`KLIPY request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function pickSize(gif: KlipyGif, size: "sm" | "md" | "hd"): KlipySize | undefined {
  return gif?.file?.[size];
}

export function klipyPreview(gif: KlipyGif): KlipyFormat | null {
  return pickSize(gif, "sm")?.gif ?? pickSize(gif, "md")?.gif ?? null;
}

export function klipyMedia(gif: KlipyGif): KlipyFormat | null {
  return pickSize(gif, "md")?.gif ?? pickSize(gif, "hd")?.gif ?? null;
}

export function klipyMediaWebp(gif: KlipyGif): KlipyFormat | null {
  return pickSize(gif, "md")?.webp ?? pickSize(gif, "hd")?.webp ?? null;
}

// Stickers prefer the transparent webp format; GIF is the fallback.
export function klipyStickerPreview(sticker: KlipyGif): KlipyFormat | null {
  return (
    pickSize(sticker, "sm")?.webp ??
    pickSize(sticker, "md")?.webp ??
    pickSize(sticker, "sm")?.gif ??
    pickSize(sticker, "md")?.gif ??
    null
  );
}

export function klipyStickerMedia(sticker: KlipyGif): KlipyFormat | null {
  return (
    pickSize(sticker, "md")?.webp ??
    pickSize(sticker, "hd")?.webp ??
    pickSize(sticker, "md")?.gif ??
    pickSize(sticker, "hd")?.gif ??
    null
  );
}

export async function klipyTrending(page = 1): Promise<KlipyPage> {
  const d = await get<KlipyListResponse>(`/gifs/trending?page=${page}&per_page=${PER_PAGE}`);
  return { items: d.data.data, page: d.data.current_page, hasNext: d.data.has_next };
}

export async function klipySearch(q: string, page = 1): Promise<KlipyPage> {
  const d = await get<KlipyListResponse>(
    `/gifs/search?q=${encodeURIComponent(q)}&page=${page}&per_page=${PER_PAGE}`
  );
  return { items: d.data.data, page: d.data.current_page, hasNext: d.data.has_next };
}

export async function klipyCategories(): Promise<KlipyCategory[]> {
  const d = await get<{ data: { categories: KlipyCategory[] } }>(`/gifs/categories`);
  return d?.data?.categories || [];
}

export async function klipyStickerTrending(page = 1): Promise<KlipyPage> {
  const d = await get<KlipyListResponse>(`/stickers/trending?page=${page}&per_page=${PER_PAGE}`);
  return { items: d.data.data, page: d.data.current_page, hasNext: d.data.has_next };
}

export async function klipyStickerSearch(q: string, page = 1): Promise<KlipyPage> {
  const d = await get<KlipyListResponse>(
    `/stickers/search?q=${encodeURIComponent(q)}&page=${page}&per_page=${PER_PAGE}`
  );
  return { items: d.data.data, page: d.data.current_page, hasNext: d.data.has_next };
}
