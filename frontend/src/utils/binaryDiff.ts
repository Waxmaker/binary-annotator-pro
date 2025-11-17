/**
 * Diff types for binary comparison
 */
export enum DiffType {
  EQUAL = "equal",
  MODIFIED = "modified",
  ADDED = "added",
  REMOVED = "removed",
}

export interface DiffChunk {
  type: DiffType;
  offset: number;
  length: number;
  data1?: Uint8Array;
  data2?: Uint8Array;
}

export interface DiffStats {
  totalBytes: number;
  equalBytes: number;
  modifiedBytes: number;
  addedBytes: number;
  removedBytes: number;
  similarity: number; // 0-100%
}

/**
 * Compare two binary buffers and return diff chunks
 */
export function compareBinaryBuffers(
  buffer1: ArrayBuffer,
  buffer2: ArrayBuffer,
  chunkSize: number = 16,
): DiffChunk[] {
  const data1 = new Uint8Array(buffer1);
  const data2 = new Uint8Array(buffer2);
  const chunks: DiffChunk[] = [];

  const maxLength = Math.max(data1.length, data2.length);
  let offset = 0;

  while (offset < maxLength) {
    const end1 = Math.min(offset + chunkSize, data1.length);
    const end2 = Math.min(offset + chunkSize, data2.length);

    const chunk1 = data1.slice(offset, end1);
    const chunk2 = data2.slice(offset, end2);

    // Determine diff type
    let type: DiffType;
    if (offset >= data1.length && offset < data2.length) {
      type = DiffType.ADDED;
    } else if (offset >= data2.length && offset < data1.length) {
      type = DiffType.REMOVED;
    } else if (arraysEqual(chunk1, chunk2)) {
      type = DiffType.EQUAL;
    } else {
      type = DiffType.MODIFIED;
    }

    chunks.push({
      type,
      offset,
      length: Math.max(chunk1.length, chunk2.length),
      data1: chunk1.length > 0 ? chunk1 : undefined,
      data2: chunk2.length > 0 ? chunk2 : undefined,
    });

    offset += chunkSize;
  }

  return chunks;
}

/**
 * Calculate diff statistics
 */
export function calculateDiffStats(
  buffer1: ArrayBuffer,
  buffer2: ArrayBuffer,
): DiffStats {
  const data1 = new Uint8Array(buffer1);
  const data2 = new Uint8Array(buffer2);

  const minLength = Math.min(data1.length, data2.length);
  const maxLength = Math.max(data1.length, data2.length);

  let equalBytes = 0;
  let modifiedBytes = 0;

  for (let i = 0; i < minLength; i++) {
    if (data1[i] === data2[i]) {
      equalBytes++;
    } else {
      modifiedBytes++;
    }
  }

  const addedBytes = data2.length > data1.length ? data2.length - data1.length : 0;
  const removedBytes =
    data1.length > data2.length ? data1.length - data2.length : 0;

  const similarity = maxLength > 0 ? (equalBytes / maxLength) * 100 : 100;

  return {
    totalBytes: maxLength,
    equalBytes,
    modifiedBytes,
    addedBytes,
    removedBytes,
    similarity,
  };
}

/**
 * Find byte-level changes between two buffers
 */
export function findByteChanges(
  buffer1: ArrayBuffer,
  buffer2: ArrayBuffer,
): Array<{ offset: number; oldValue: number; newValue: number }> {
  const data1 = new Uint8Array(buffer1);
  const data2 = new Uint8Array(buffer2);
  const changes: Array<{ offset: number; oldValue: number; newValue: number }> =
    [];

  const minLength = Math.min(data1.length, data2.length);

  for (let i = 0; i < minLength; i++) {
    if (data1[i] !== data2[i]) {
      changes.push({
        offset: i,
        oldValue: data1[i],
        newValue: data2[i],
      });
    }
  }

  return changes;
}

/**
 * Find changed regions (consecutive changed bytes)
 */
export function findChangedRegions(
  buffer1: ArrayBuffer,
  buffer2: ArrayBuffer,
  minRegionSize: number = 4,
): Array<{ offset: number; length: number }> {
  const changes = findByteChanges(buffer1, buffer2);
  const regions: Array<{ offset: number; length: number }> = [];

  if (changes.length === 0) return regions;

  let currentRegion: { offset: number; length: number } | null = null;

  changes.forEach((change, index) => {
    if (!currentRegion) {
      currentRegion = { offset: change.offset, length: 1 };
    } else if (change.offset === currentRegion.offset + currentRegion.length) {
      // Consecutive change, extend region
      currentRegion.length++;
    } else {
      // Gap found, save current region if large enough
      if (currentRegion.length >= minRegionSize) {
        regions.push({ ...currentRegion });
      }
      currentRegion = { offset: change.offset, length: 1 };
    }

    // Handle last region
    if (
      index === changes.length - 1 &&
      currentRegion &&
      currentRegion.length >= minRegionSize
    ) {
      regions.push({ ...currentRegion });
    }
  });

  return regions;
}

/**
 * Calculate pattern correlation between two buffers
 * Returns correlation score for sliding windows
 */
export function calculatePatternCorrelation(
  buffer1: ArrayBuffer,
  buffer2: ArrayBuffer,
  windowSize: number = 256,
): number[] {
  const data1 = new Uint8Array(buffer1);
  const data2 = new Uint8Array(buffer2);
  const correlations: number[] = [];

  const minLength = Math.min(data1.length, data2.length);
  const step = Math.max(1, Math.floor(windowSize / 4));

  for (let i = 0; i < minLength; i += step) {
    const end = Math.min(i + windowSize, minLength);
    const window1 = data1.slice(i, end);
    const window2 = data2.slice(i, end);

    // Calculate correlation (percentage of matching bytes)
    let matches = 0;
    for (let j = 0; j < window1.length; j++) {
      if (window1[j] === window2[j]) {
        matches++;
      }
    }

    const correlation = window1.length > 0 ? (matches / window1.length) * 100 : 100;
    correlations.push(correlation);
  }

  return correlations;
}

/**
 * Helper function to compare two Uint8Arrays
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Format byte as hex string
 */
export function formatByte(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Get color for diff type
 */
export function getDiffColor(type: DiffType): string {
  switch (type) {
    case DiffType.EQUAL:
      return "#e8f5e9"; // light green
    case DiffType.MODIFIED:
      return "#fff9c4"; // light yellow
    case DiffType.ADDED:
      return "#e3f2fd"; // light blue
    case DiffType.REMOVED:
      return "#ffebee"; // light red
    default:
      return "#ffffff";
  }
}
