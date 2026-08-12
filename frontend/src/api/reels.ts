import { api } from "@/src/api/client";

export type ReelAuthor = {
  user_id: string;
  username: string;
  display_name: string;
  profile_picture: string;
  badge_type?: string | null;
};

export type Reel = {
  reel_id: string;
  user_id: string;
  author: ReelAuthor | null;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  visibility: "public" | "friends" | "private";
  view_count: number;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  is_mine: boolean;
  created_at: string;
};

export type ReelComment = {
  comment_id: string;
  reel_id: string;
  user_id: string;
  user: ReelAuthor | null;
  content: string;
  kind?: "text" | "gif" | "sticker";
  media?: string;
  parent_comment_id?: string | null;
  created_at: string;
  is_mine: boolean;
};

export function reelsFeed(token: string, limit = 10, offset = 0) {
  return api<{ reels: Reel[]; has_more: boolean }>("/reels/feed", {
    token,
    query: { limit, offset },
  });
}

export function userReels(token: string, targetId: string) {
  return api<{ reels: Reel[]; user: ReelAuthor | null }>(
    `/reels/user/${targetId}`,
    { token }
  );
}

export function createReel(
  token: string,
  body: {
    video_url: string;
    thumbnail_url?: string;
    caption?: string;
    visibility?: "public" | "friends" | "private";
  }
) {
  return api<Reel>("/reels", { token, method: "POST", body });
}

export function deleteReel(token: string, reelId: string) {
  return api<{ ok: boolean }>(`/reels/${reelId}`, { token, method: "DELETE" });
}

export function likeReel(token: string, reelId: string) {
  return api<{ ok: boolean; liked: boolean }>(`/reels/${reelId}/like`, {
    token,
    method: "POST",
  });
}

export function unlikeReel(token: string, reelId: string) {
  return api<{ ok: boolean; liked: boolean }>(`/reels/${reelId}/like`, {
    token,
    method: "DELETE",
  });
}

export function viewReel(token: string, reelId: string) {
  return api<{ ok: boolean }>(`/reels/${reelId}/view`, {
    token,
    method: "POST",
  });
}

export function addReelComment(
  token: string,
  reelId: string,
  body: {
    content?: string;
    kind?: "text" | "gif" | "sticker";
    media?: string;
    parent_comment_id?: string | null;
  }
) {
  return api<ReelComment>(`/reels/${reelId}/comments`, {
    token,
    method: "POST",
    body,
  });
}

export function getReelComments(token: string, reelId: string) {
  return api<{ comments: ReelComment[] }>(`/reels/${reelId}/comments`, {
    token,
  });
}

export function deleteReelComment(
  token: string,
  reelId: string,
  commentId: string
) {
  return api<{ ok: boolean }>(
    `/reels/${reelId}/comments/${commentId}`,
    { token, method: "DELETE" }
  );
}
