/**
 * Intelligent file sampling for large binary files
 * Creates a representative sample by taking data from beginning, middle, and end
 */

export interface SamplingInfo {
  isSampled: boolean;
  originalSize: number;
  sampleSize: number;
  strategy: string;
}

const MAX_SAMPLE_SIZE = 30 * 1024 * 1024; // 30 MB max sample
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks

/**
 * Creates a sampled ArrayBuffer from a large file
 * Strategy: First 10MB + Last 10MB + 10MB from middle
 */
export async function createSampledBuffer(
  file: File
): Promise<{ buffer: ArrayBuffer; info: SamplingInfo }> {
  const fileSize = file.size;

  // If file is small enough, return full buffer
  if (fileSize <= MAX_SAMPLE_SIZE) {
    const buffer = await file.arrayBuffer();
    return {
      buffer,
      info: {
        isSampled: false,
        originalSize: fileSize,
        sampleSize: fileSize,
        strategy: "full",
      },
    };
  }

  // For large files, sample intelligently
  const samples: ArrayBuffer[] = [];
  let totalSampled = 0;

  // 1. First 10MB
  const firstChunk = file.slice(0, CHUNK_SIZE);
  samples.push(await firstChunk.arrayBuffer());
  totalSampled += CHUNK_SIZE;

  // 2. Middle 10MB (centered)
  const middleStart = Math.floor((fileSize - CHUNK_SIZE) / 2);
  const middleChunk = file.slice(middleStart, middleStart + CHUNK_SIZE);
  samples.push(await middleChunk.arrayBuffer());
  totalSampled += CHUNK_SIZE;

  // 3. Last 10MB
  const lastStart = Math.max(0, fileSize - CHUNK_SIZE);
  const lastChunk = file.slice(lastStart, fileSize);
  samples.push(await lastChunk.arrayBuffer());
  totalSampled += Math.min(CHUNK_SIZE, fileSize - lastStart);

  // Combine samples into single buffer
  const combinedBuffer = new Uint8Array(totalSampled);
  let offset = 0;

  for (const sample of samples) {
    combinedBuffer.set(new Uint8Array(sample), offset);
    offset += sample.byteLength;
  }

  return {
    buffer: combinedBuffer.buffer,
    info: {
      isSampled: true,
      originalSize: fileSize,
      sampleSize: totalSampled,
      strategy: "first+middle+last",
    },
  };
}

/**
 * Format sampling info for display
 */
export function formatSamplingInfo(info: SamplingInfo): string {
  if (!info.isSampled) {
    return `Analyzing full file (${formatBytes(info.originalSize)})`;
  }

  return `Analyzing ${formatBytes(info.sampleSize)} sample from ${formatBytes(info.originalSize)} file`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
