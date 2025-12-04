// Binary comparison API services

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface DiffChunk {
  offset: number;
  type: "equal" | "modified" | "added" | "removed";
  bytes1?: number[];
  bytes2?: number[];
  diff_mask?: boolean[];
}

export interface BinaryDiffResponse {
  chunks: DiffChunk[];
  total_chunks: number;
  truncated: boolean;
}

export interface DiffStats {
  total_bytes: number;
  changed_bytes: number;
  unchanged_bytes: number;
  percent_changed: number;
  file1_size: number;
  file2_size: number;
  size_difference: number;
  changed_regions: number;
  longest_unchanged: number;
}

export interface ByteChange {
  offset: number;
  old: number;
  new: number;
}

export interface ChangedRegion {
  start: number;
  end: number;
  length: number;
}

export interface DeltaAnalysisResponse {
  stats: DiffStats;
  changes: ByteChange[];
  regions: ChangedRegion[];
}

export interface CorrelationPoint {
  offset: number;
  correlation: number;
}

export interface PatternCorrelationResponse {
  correlations: CorrelationPoint[];
  average: number;
  min_value: number;
  max_value: number;
  sampled: boolean;
}

export interface StreamingDiffResponse {
  chunks: DiffChunk[];
  next_offset: number;
  has_more: boolean;
  file1_size: number;
  file2_size: number;
}

/**
 * Compare two binary files and get diff chunks
 */
export async function compareBinaryFiles(
  file1Id: number,
  file2Id: number,
  chunkSize: number = 16,
  maxResults: number = 10000
): Promise<BinaryDiffResponse> {
  const response = await fetch(`${API_BASE_URL}/compare/diff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file1_id: file1Id,
      file2_id: file2Id,
      chunk_size: chunkSize,
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Analyze delta/changes between two binary files
 */
export async function analyzeDelta(
  file1Id: number,
  file2Id: number,
  minRegionSize: number = 4,
  maxChangePoints: number = 1000
): Promise<DeltaAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/compare/delta`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file1_id: file1Id,
      file2_id: file2Id,
      min_region_size: minRegionSize,
      max_change_points: maxChangePoints,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Calculate pattern correlation between two binary files
 */
export async function calculatePatternCorrelation(
  file1Id: number,
  file2Id: number,
  windowSize: number = 256,
  maxSamples: number = 5000
): Promise<PatternCorrelationResponse> {
  const response = await fetch(`${API_BASE_URL}/compare/correlation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file1_id: file1Id,
      file2_id: file2Id,
      window_size: windowSize,
      max_samples: maxSamples,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Streaming comparison for very large files
 * Fetch diff chunks incrementally
 */
export async function streamingCompare(
  file1Id: number,
  file2Id: number,
  chunkSize: number = 16 * 1000, // 16KB default
  offset: number = 0
): Promise<StreamingDiffResponse> {
  const response = await fetch(`${API_BASE_URL}/compare/streaming`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file1_id: file1Id,
      file2_id: file2Id,
      chunk_size: chunkSize,
      offset: offset,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Export comparison results as JSON download
 */
export async function exportComparison(
  file1Id: number,
  file2Id: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/compare/export?file1_id=${file1Id}&file2_id=${file2Id}`
  );

  if (!response.ok) {
    throw new Error(`Export failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparison_${file1Id}_${file2Id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
