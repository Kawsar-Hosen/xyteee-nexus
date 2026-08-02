import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { API_BASE } from "./client";

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
    // Web: fetch the blob from the URI and send as FormData
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const ext = fileName?.split(".").pop() || uri.split(".").pop() || "bin";
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
