export interface FileInfo {
  name: string;
  size: number;
  sha256: string;
  mimeType: string;
  fileType: string;
}

/**
 * Calculate SHA-256 hash of a buffer
 */
export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Detect MIME type and file type from file signature (magic bytes)
 */
export function detectFileType(buffer: ArrayBuffer): {
  mimeType: string;
  fileType: string;
} {
  const bytes = new Uint8Array(buffer);

  // Check magic bytes for common file types
  if (bytes.length < 4) {
    return { mimeType: "application/octet-stream", fileType: "Unknown" };
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { mimeType: "image/png", fileType: "PNG Image" };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { mimeType: "image/jpeg", fileType: "JPEG Image" };
  }

  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { mimeType: "image/gif", fileType: "GIF Image" };
  }

  // PDF: 25 50 44 46
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mimeType: "application/pdf", fileType: "PDF Document" };
  }

  // ZIP: 50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
    if ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08)) {
      return { mimeType: "application/zip", fileType: "ZIP Archive" };
    }
  }

  // ELF: 7F 45 4C 46
  if (bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) {
    return { mimeType: "application/x-executable", fileType: "ELF Executable" };
  }

  // Mach-O: CF FA ED FE (32-bit) or CF FA ED FF (64-bit)
  if (bytes[0] === 0xCF && bytes[1] === 0xFA && bytes[2] === 0xED &&
      (bytes[3] === 0xFE || bytes[3] === 0xFF)) {
    return { mimeType: "application/x-mach-binary", fileType: "Mach-O Executable" };
  }

  // PE/COFF: 4D 5A (MZ header)
  if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
    return { mimeType: "application/x-msdownload", fileType: "Windows PE Executable" };
  }

  // GZIP: 1F 8B
  if (bytes[0] === 0x1F && bytes[1] === 0x8B) {
    return { mimeType: "application/gzip", fileType: "GZIP Archive" };
  }

  // BZ2: 42 5A 68
  if (bytes[0] === 0x42 && bytes[1] === 0x5A && bytes[2] === 0x68) {
    return { mimeType: "application/x-bzip2", fileType: "BZ2 Archive" };
  }

  // RAR: 52 61 72 21
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
    return { mimeType: "application/x-rar-compressed", fileType: "RAR Archive" };
  }

  // 7z: 37 7A BC AF 27 1C
  if (bytes.length >= 6 &&
      bytes[0] === 0x37 && bytes[1] === 0x7A && bytes[2] === 0xBC &&
      bytes[3] === 0xAF && bytes[4] === 0x27 && bytes[5] === 0x1C) {
    return { mimeType: "application/x-7z-compressed", fileType: "7-Zip Archive" };
  }

  // SQLite: "SQLite format 3\0"
  if (bytes.length >= 16) {
    const sqliteHeader = String.fromCharCode(...Array.from(bytes.slice(0, 16)));
    if (sqliteHeader.startsWith("SQLite format 3")) {
      return { mimeType: "application/x-sqlite3", fileType: "SQLite Database" };
    }
  }

  // Check if it's mostly printable ASCII (text file)
  let printableCount = 0;
  const sampleSize = Math.min(512, bytes.length);
  for (let i = 0; i < sampleSize; i++) {
    const byte = bytes[i];
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
      printableCount++;
    }
  }

  if (printableCount / sampleSize > 0.85) {
    return { mimeType: "text/plain", fileType: "Text File" };
  }

  return { mimeType: "application/octet-stream", fileType: "Binary Data" };
}

/**
 * Format byte size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
