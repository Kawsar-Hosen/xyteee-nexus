// Tiny JSON cache for screen data (feed / bonds / find). Data is persisted so a
// returning user sees their last-known content instantly and refreshes happen in
// the background — matching the "no loading" feel of the profile screen.
import { storage } from "@/src/utils/storage";

const PREFIX = "nx.cache";

export async function loadCache<T>(scope: string): Promise<T | null> {
  try {
    const raw = await storage.getItem(`${PREFIX}.${scope}.v1`, null);
    if (!raw) return null;
    return JSON.parse(raw as string) as T;
  } catch {
    return null;
  }
}

export async function saveCache<T>(scope: string, value: T): Promise<void> {
  try {
    await storage.setItem(`${PREFIX}.${scope}.v1`, JSON.stringify(value));
  } catch {}
}
