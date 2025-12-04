// Binary chunk loading API for HexViewer

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface ChunkResponse {
  file_id: number;
  file_name: string;
  file_size: number;
  offset: number;
  length: number;
  data: string; // Base64 encoded bytes from Go backend
  has_more: boolean;
}

/**
 * Fetch a chunk of binary data from a file
 * @param fileId - Database ID of the file
 * @param offset - Byte offset to start reading from
 * @param length - Number of bytes to read (default 16KB)
 */
export async function fetchBinaryChunk(
  fileId: number,
  offset: number,
  length: number = 16 * 1000 // 16KB default
): Promise<ChunkResponse> {
  const response = await fetch(
    `${API_BASE_URL}/binary/${fileId}/chunk?offset=${offset}&length=${length}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Decode base64 data to Uint8Array
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch and decode a chunk of binary data
 */
export async function fetchAndDecodeChunk(
  fileId: number,
  offset: number,
  length: number = 16 * 1000
): Promise<{ data: Uint8Array; response: ChunkResponse }> {
  const response = await fetchBinaryChunk(fileId, offset, length);
  const data = decodeBase64(response.data);
  return { data, response };
}
