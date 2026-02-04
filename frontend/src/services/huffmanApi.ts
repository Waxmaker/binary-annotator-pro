// Huffman table API

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface HuffmanTableEntry {
  id: number;
  created_at: string;
  table_id: number;
  symbol: number;
  code_length: number;
  code: string;
}

export interface HuffmanTable {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  description?: string;
  entries?: HuffmanTableEntry[];
}

export interface CreateHuffmanTableRequest {
  name: string;
  description?: string;
  entries: {
    symbol: number;
    code_length: number;
  }[];
}

export interface DecodeHuffmanRequest {
  table_id: number;
  file_id: number;
  offset: number;
  length: number;
  bit_offset?: number;
}

export interface DecodeHuffmanResponse {
  table_name: string;
  decoded: number[];
  count: number;
}

export interface AnalyzeHuffmanRequest {
  file_id: number;
  offset: number;
  length: number;
  max_code_length: number;
}

export interface DetectedPattern {
  pattern: string;
  length: number;
  count: number;
}

/**
 * Create a new Huffman table
 */
export async function createHuffmanTable(
  request: CreateHuffmanTableRequest
): Promise<HuffmanTable> {
  const response = await fetch(`${API_BASE_URL}/huffman/tables`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * List all Huffman tables (without entries)
 */
export async function listHuffmanTables(): Promise<HuffmanTable[]> {
  const response = await fetch(`${API_BASE_URL}/huffman/tables`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get a Huffman table by ID with all entries
 */
export async function getHuffmanTable(id: number): Promise<HuffmanTable> {
  const response = await fetch(`${API_BASE_URL}/huffman/tables/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get a Huffman table by name with all entries
 */
export async function getHuffmanTableByName(name: string): Promise<HuffmanTable> {
  const response = await fetch(`${API_BASE_URL}/huffman/tables/name/${encodeURIComponent(name)}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Update an existing Huffman table
 */
export async function updateHuffmanTable(
  id: number,
  request: CreateHuffmanTableRequest
): Promise<HuffmanTable> {
  const response = await fetch(`${API_BASE_URL}/huffman/tables/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a Huffman table by ID
 */
export async function deleteHuffmanTable(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/huffman/tables/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

/**
 * Decode a binary selection using a Huffman table
 */
export async function decodeHuffmanSelection(
  request: DecodeHuffmanRequest
): Promise<DecodeHuffmanResponse> {
  const response = await fetch(`${API_BASE_URL}/huffman/decode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Analyze binary data to detect potential Huffman patterns
 */
export async function analyzeHuffmanPatterns(
  request: AnalyzeHuffmanRequest
): Promise<{
  patterns: DetectedPattern[];
  total_bits: number;
}> {
  const response = await fetch(`${API_BASE_URL}/huffman/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
