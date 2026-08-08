import { Platform } from "react-native";
import { API_BASE } from "./client";

/**
 * Convert a blob/data URL or file URI to a Blob on web.
 */
async function uriToBlob(uri: string): Promise<Blob> {
  // If it's already a data URL or blob URL, fetch works
  if (uri.startsWith("data:") || uri.startsWith("blob:")) {
    const resp = await fetch(uri);
    return resp.blob();
  }
  // Fallback: treat as a fetchable URL
  const resp = await fetch(uri);
  return resp.blob();
}

/**
 * Get file extension from URI or content type.
 */
function getExt(uri: string, contentType?: string): string {
  // Try URI extension first (skip query params and hash)
  const clean = uri.split("?")[0].split("#")[0];
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx !== -1) {
    const ext = clean.slice(dotIdx + 1).toLowerCase();
    if (ext.length <= 5) return ext;
  }
  // Fallback to content type
  if (contentType) {
    const map: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "audio/m4a": "m4a",
      "audio/aac": "aac",
      "audio/mpeg": "mp3",
    };
    return map[contentType.split(";")[0].trim()] || "bin";
  }
  return "bin";
}

/**
 * Upload a file to the backend → R2 storage.
 * Returns the public URL of the uploaded file.
 */
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4a: "audio/m4a",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
};

function mimeTypeFor(ext: string, mimeType?: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

export async function uploadFile(
  uri: string,
  kind: string,
  token: string,
  fileName?: string,
  mimeType?: string
): Promise<string> {
  const isWeb = Platform.OS === "web";
  const url = `${API_BASE}/upload?kind=${encodeURIComponent(kind)}`;

  if (isWeb) {
    let blob: Blob;
    try {
      blob = await uriToBlob(uri);
    } catch {
      throw new Error("Failed to read file. Please try again.");
    }

    const ext = getExt(uri, blob.type);
    const file = new File([blob], fileName || `upload.${ext}`, {
      type: blob.type || "application/octet-stream",
    });

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");
    return data.url;
  }

  // Native: RN's FormData can only serialize a plain `{uri, name, type}` part.
  // An expo-file-system `File` won't work here — its `uri` is a non-enumerable
  // native getter so it never reaches the FormData part, it has no `type`
  // property, and `Paths.join` mangles `content://` into `content:/`. Pass the
  // raw picker URI; RN 0.81 reads `content://` via the ContentResolver.
  const ext = (fileName || uri).split(".").pop()?.toLowerCase() || "bin";
  const form = new FormData();
  form.append(
    "file",
    {
      uri,
      name: fileName || `upload.${ext}`,
      type: mimeTypeFor(ext, mimeType),
    } as any
  );

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Upload failed");
  return data.url;
}
