export interface ByteStatistics {
  min: number;
  max: number;
  average: number;
  median: number;
  mode: number;
  entropy: number;
  totalBytes: number;
  uniqueBytes: number;
  nullBytes: number;
  printableBytes: number;
}

export function calculateByteStatistics(buffer: ArrayBuffer | null): ByteStatistics | null {
  if (!buffer) {
    return null;
  }

  const data = new Uint8Array(buffer);
  const len = data.length;

  if (len === 0) {
    return null;
  }

  // Calculate min, max, sum
  let min = 255;
  let max = 0;
  let sum = 0;
  let nullCount = 0;
  let printableCount = 0;

  // Frequency map for mode and entropy
  const freq = new Array(256).fill(0);

  for (let i = 0; i < len; i++) {
    const byte = data[i];
    sum += byte;
    if (byte < min) min = byte;
    if (byte > max) max = byte;
    freq[byte]++;

    if (byte === 0) nullCount++;
    if (byte >= 32 && byte <= 126) printableCount++;
  }

  // Calculate average
  const average = sum / len;

  // Calculate median
  const sorted = Array.from(data).sort((a, b) => a - b);
  const median = len % 2 === 0
    ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
    : sorted[Math.floor(len / 2)];

  // Calculate mode (most frequent byte)
  let mode = 0;
  let maxFreq = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] > maxFreq) {
      maxFreq = freq[i];
      mode = i;
    }
  }

  // Calculate entropy
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] > 0) {
      const p = freq[i] / len;
      entropy -= p * Math.log2(p);
    }
  }

  // Count unique bytes
  const uniqueBytes = freq.filter(f => f > 0).length;

  return {
    min,
    max,
    average,
    median,
    mode,
    entropy,
    totalBytes: len,
    uniqueBytes,
    nullBytes: nullCount,
    printableBytes: printableCount,
  };
}
