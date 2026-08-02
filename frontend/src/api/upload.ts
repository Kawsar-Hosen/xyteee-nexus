import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
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
export async function uploadFile(
  uri: string,
  kind: string,
  token: string,
  fileName?: string
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

  // Native: read file as base64, convert to Blob, send as FormData
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Determine MIME type from extension
  const ext = (fileName || uri).split(".").pop()?.toLowerCase() || "bin";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4a: "audio/m4a",
    aac: "audio/aac",
    mp3: "audio/mpeg",
  };
  const mime = mimeMap[ext] || "application/octet-stream";

  // Convert base64 to binary blob
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });

  const file = new File([blob], fileName || `upload.${ext}`, { type: mime });

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
