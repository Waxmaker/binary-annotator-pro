// API base URL - use environment variable or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function uploadBinaryFile(
  file: File,
  vendor?: string,
): Promise<any> {
  const form = new FormData();
  form.append("file", file);
  if (vendor) form.append("vendor", vendor);

  const res = await fetch(`${API_BASE_URL}/upload/binary`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadYamlFile(file: File): Promise<any> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/upload/yaml`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`YAML upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBinaryList() {
  const res = await fetch(`${API_BASE_URL}/get/list/binary`);

  if (!res.ok) {
    throw new Error("Failed to fetch binary list");
  }

  return await res.json();
}

export async function fetchBinaryFile(name: string) {
  const res = await fetch(`${API_BASE_URL}/get/binary/${name}`);

  if (!res.ok) {
    throw new Error("Failed to fetch binary file");
  }

  return await res.arrayBuffer();
}

export async function renameBinaryFile(oldName: string, newName: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/rename/binary/${oldName}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ new_name: newName }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `Rename failed: ${res.statusText}`);
  }

  return res.json();
}

// YAML Config API functions

export interface YamlConfigItem {
  id: number;
  name: string;
  file_id?: number;
  yaml: string;
  created_at: string;
  updated_at: string;
}

export async function fetchYamlList(): Promise<YamlConfigItem[]> {
  const res = await fetch(`${API_BASE_URL}/get/list/yaml`);

  if (!res.ok) {
    throw new Error("Failed to fetch YAML config list");
  }

  return await res.json();
}

export async function fetchYamlConfig(name: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/get/yaml/${name}`);

  if (!res.ok) {
    throw new Error("Failed to fetch YAML config");
  }

  return await res.text();
}

export async function createYamlConfig(
  name: string,
  yaml: string,
  fileName?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/upload/yaml`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      yaml,
      file_name: fileName,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create YAML config: ${res.statusText}`);
  }

  return res.json();
}

export async function updateYamlConfig(
  name: string,
  yaml: string,
  newName?: string,
  fileName?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/update/yaml/${name}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      yaml,
      new_name: newName,
      file_name: fileName,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update YAML config: ${res.statusText}`);
  }

  return res.json();
}

export async function deleteYamlConfig(name: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/delete/yaml/${name}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`Failed to delete YAML config: ${res.statusText}`);
  }

  return res.json();
}

// Binary Search API

export interface SearchRequest {
  file_name: string;
  value: string;
  type: string;
}

export interface SearchResult {
  offset: number;
  length: number;
  value?: string;
}

export interface SearchResponse {
  matches: SearchResult[];
  count: number;
}

export async function searchBinary(
  fileName: string,
  value: string,
  type: string,
  start?: number,
  end?: number,
  regex?: boolean
): Promise<SearchResponse> {
  const body: any = {
    file_name: fileName,
    value,
    type,
  };

  if (start !== undefined) body.start = start;
  if (end !== undefined) body.end = end;
  if (regex !== undefined) body.regex = regex;

  const res = await fetch(`${API_BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Search failed");
  }

  return res.json();
}

// CSV Processing API
export interface CSVParseResponse {
  type: "multi-lead" | "timestamp-value" | "simple";
  samples?: number[];
  timestamps?: number[];
  leadNames?: string[];
  leads?: number[][];
  count: number;
}

export async function parseCSV(csvData: string): Promise<CSVParseResponse> {
  const res = await fetch(`${API_BASE_URL}/parse/csv`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: csvData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "CSV parsing failed");
  }

  return res.json();
}
