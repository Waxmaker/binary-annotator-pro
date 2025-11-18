/**
 * Pattern clustering utilities using simple algorithms
 * No heavy ML - just smart heuristics and clustering
 */

export interface Chunk {
  offset: number;
  bytes: number[];
  hash: string;
}

export interface Cluster {
  id: number;
  representative: Chunk;
  members: Chunk[];
  color: string;
}

/**
 * Calculate simple hash for a byte array
 */
function simpleHash(bytes: number[]): string {
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = (hash << 5) - hash + bytes[i];
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Calculate Hamming distance between two byte arrays
 */
function hammingDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) distance++;
  }
  // Add difference in length
  distance += Math.abs(a.length - b.length);
  return distance;
}

/**
 * Divide buffer into fixed-size chunks
 */
export function chunkBuffer(
  buffer: ArrayBuffer,
  chunkSize: number = 256,
  maxChunks: number = 1000
): Chunk[] {
  const data = new Uint8Array(buffer);
  const chunks: Chunk[] = [];

  const step = Math.max(1, Math.floor(data.length / maxChunks));

  for (let i = 0; i < data.length && chunks.length < maxChunks; i += step) {
    const end = Math.min(i + chunkSize, data.length);
    const bytes = Array.from(data.slice(i, end));

    chunks.push({
      offset: i,
      bytes,
      hash: simpleHash(bytes),
    });
  }

  return chunks;
}

/**
 * Cluster chunks by similarity using a simple greedy algorithm
 */
export function clusterChunks(
  chunks: Chunk[],
  maxDistance: number = 10
): Cluster[] {
  if (chunks.length === 0) return [];

  const clusters: Cluster[] = [];
  const assigned = new Set<number>();
  const colors = [
    "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
    "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"
  ];

  for (let i = 0; i < chunks.length; i++) {
    if (assigned.has(i)) continue;

    // Create new cluster
    const cluster: Cluster = {
      id: clusters.length,
      representative: chunks[i],
      members: [chunks[i]],
      color: colors[clusters.length % colors.length],
    };

    assigned.add(i);

    // Find similar chunks
    for (let j = i + 1; j < chunks.length; j++) {
      if (assigned.has(j)) continue;

      const distance = hammingDistance(
        chunks[i].bytes,
        chunks[j].bytes
      );

      if (distance <= maxDistance) {
        cluster.members.push(chunks[j]);
        assigned.add(j);
      }
    }

    // Only keep clusters with multiple members (repeated patterns)
    if (cluster.members.length > 1) {
      clusters.push(cluster);
    }
  }

  // Sort by cluster size (largest first)
  clusters.sort((a, b) => b.members.length - a.members.length);

  return clusters;
}

/**
 * Find exact repeating patterns (same hash)
 */
export function findExactRepeats(chunks: Chunk[]): Cluster[] {
  const hashMap = new Map<string, Chunk[]>();

  // Group by hash
  for (const chunk of chunks) {
    if (!hashMap.has(chunk.hash)) {
      hashMap.set(chunk.hash, []);
    }
    hashMap.get(chunk.hash)!.push(chunk);
  }

  const colors = [
    "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
    "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"
  ];

  // Create clusters from groups with multiple occurrences
  const clusters: Cluster[] = [];
  let clusterId = 0;

  for (const [hash, members] of hashMap.entries()) {
    if (members.length > 1) {
      clusters.push({
        id: clusterId,
        representative: members[0],
        members,
        color: colors[clusterId % colors.length],
      });
      clusterId++;
    }
  }

  // Sort by cluster size
  clusters.sort((a, b) => b.members.length - a.members.length);

  return clusters;
}

/**
 * Analyze structure - find periodic patterns
 */
export function findPeriodicStructures(
  buffer: ArrayBuffer,
  minPeriod: number = 32,
  maxPeriod: number = 4096
): Array<{ period: number; confidence: number; offsets: number[] }> {
  const data = new Uint8Array(buffer);
  const results: Array<{ period: number; confidence: number; offsets: number[] }> = [];

  // Test different period sizes
  for (let period = minPeriod; period <= maxPeriod; period *= 2) {
    let matches = 0;
    let total = 0;
    const offsets: number[] = [];

    // Compare chunks at periodic intervals
    for (let i = 0; i + period * 2 < data.length; i += period) {
      total++;
      let chunkMatches = 0;
      const compareSize = Math.min(32, period); // Compare first 32 bytes

      for (let j = 0; j < compareSize; j++) {
        if (data[i + j] === data[i + period + j]) {
          chunkMatches++;
        }
      }

      if (chunkMatches > compareSize * 0.8) {
        matches++;
        offsets.push(i);
      }
    }

    const confidence = total > 0 ? matches / total : 0;

    if (confidence > 0.5 && matches > 3) {
      results.push({ period, confidence, offsets });
    }
  }

  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence);

  return results.slice(0, 5); // Return top 5
}

/**
 * Calculate entropy for a chunk to detect compressed/encrypted data
 */
export function calculateChunkEntropy(bytes: number[]): number {
  const freq = new Array(256).fill(0);

  for (const byte of bytes) {
    freq[byte]++;
  }

  let entropy = 0;
  const len = bytes.length;

  for (const count of freq) {
    if (count > 0) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Classify chunks by entropy (low/medium/high)
 */
export function classifyByEntropy(
  chunks: Chunk[]
): { low: Chunk[]; medium: Chunk[]; high: Chunk[] } {
  const low: Chunk[] = [];
  const medium: Chunk[] = [];
  const high: Chunk[] = [];

  for (const chunk of chunks) {
    const entropy = calculateChunkEntropy(chunk.bytes);

    if (entropy < 3) {
      low.push(chunk); // Structured/repetitive data
    } else if (entropy < 6) {
      medium.push(chunk); // Mixed data
    } else {
      high.push(chunk); // Compressed/encrypted
    }
  }

  return { low, medium, high };
}
