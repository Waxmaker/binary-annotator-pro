/**
 * Calculate Shannon entropy for a chunk of data
 * Returns value between 0 (no entropy) and 8 (maximum entropy for bytes)
 */
export function calculateEntropy(data: Uint8Array): number {
  if (data.length === 0) return 0;

  const frequencies = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) {
    frequencies[data[i]]++;
  }

  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const probability = frequencies[i] / data.length;
      entropy -= probability * Math.log2(probability);
    }
  }

  return entropy;
}

/**
 * Calculate entropy over sliding windows throughout the file
 */
export function calculateEntropyGraph(
  buffer: ArrayBuffer,
  windowSize: number = 256,
): number[] {
  const data = new Uint8Array(buffer);
  const result: number[] = [];

  if (data.length === 0) return result;

  const step = Math.max(1, Math.floor(windowSize / 4));

  for (let i = 0; i < data.length; i += step) {
    const end = Math.min(i + windowSize, data.length);
    const chunk = data.slice(i, end);
    result.push(calculateEntropy(chunk));
  }

  return result;
}

/**
 * Calculate byte frequency histogram
 */
export function calculateByteHistogram(buffer: ArrayBuffer): number[] {
  const data = new Uint8Array(buffer);
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < data.length; i++) {
    histogram[data[i]]++;
  }

  return histogram;
}

/**
 * Calculate digram (byte pair) frequencies
 * Returns a 256x256 matrix of frequencies
 */
export function calculateDigrams(buffer: ArrayBuffer): number[][] {
  const data = new Uint8Array(buffer);
  const digrams: number[][] = Array(256)
    .fill(0)
    .map(() => Array(256).fill(0));

  for (let i = 0; i < data.length - 1; i++) {
    const first = data[i];
    const second = data[i + 1];
    digrams[first][second]++;
  }

  return digrams;
}

/**
 * Get top N most frequent digrams
 */
export function getTopDigrams(
  digrams: number[][],
  n: number = 20,
): Array<{ first: number; second: number; count: number }> {
  const pairs: Array<{ first: number; second: number; count: number }> = [];

  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      if (digrams[i][j] > 0) {
        pairs.push({ first: i, second: j, count: digrams[i][j] });
      }
    }
  }

  return pairs.sort((a, b) => b.count - a.count).slice(0, n);
}

/**
 * Generate 2D bitmap data for visualization
 * Maps bytes to grayscale values
 */
export function generateBitmapData(
  buffer: ArrayBuffer,
  width: number = 256,
): ImageData {
  const data = new Uint8Array(buffer);
  const height = Math.ceil(data.length / width);
  const imageData = new ImageData(width, height);

  for (let i = 0; i < data.length; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const pixelIndex = (y * width + x) * 4;

    const value = data[i];
    imageData.data[pixelIndex] = value; // R
    imageData.data[pixelIndex + 1] = value; // G
    imageData.data[pixelIndex + 2] = value; // B
    imageData.data[pixelIndex + 3] = 255; // A
  }

  return imageData;
}

/**
 * Format byte as hex string
 */
export function byteToHex(byte: number): string {
  return "0x" + byte.toString(16).toUpperCase().padStart(2, "0");
}
