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
