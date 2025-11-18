/**
 * Type-based search utilities for finding specific data types in binary files
 */

export type DataType =
  | "int8"
  | "uint8"
  | "int16le"
  | "int16be"
  | "uint16le"
  | "uint16be"
  | "int32le"
  | "int32be"
  | "uint32le"
  | "uint32be"
  | "float32le"
  | "float32be"
  | "float64le"
  | "float64be"
  | "string-ascii"
  | "string-utf8"
  | "timestamp-unix32"
  | "timestamp-unix64";

export interface TypeSearchResult {
  offset: number;
  value: any;
  type: DataType;
}

/**
 * Search for a specific value interpreted as a given data type
 */
export function searchByType(
  buffer: ArrayBuffer,
  searchValue: string,
  dataType: DataType,
  maxResults: number = 1000
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  switch (dataType) {
    case "int8":
      return searchInt8(view, parseInt(searchValue), maxResults);
    case "uint8":
      return searchUint8(data, parseInt(searchValue), maxResults);
    case "int16le":
      return searchInt16(view, parseInt(searchValue), false, maxResults);
    case "int16be":
      return searchInt16(view, parseInt(searchValue), true, maxResults);
    case "uint16le":
      return searchUint16(view, parseInt(searchValue), false, maxResults);
    case "uint16be":
      return searchUint16(view, parseInt(searchValue), true, maxResults);
    case "int32le":
      return searchInt32(view, parseInt(searchValue), false, maxResults);
    case "int32be":
      return searchInt32(view, parseInt(searchValue), true, maxResults);
    case "uint32le":
      return searchUint32(view, parseInt(searchValue), false, maxResults);
    case "uint32be":
      return searchUint32(view, parseInt(searchValue), true, maxResults);
    case "float32le":
      return searchFloat32(view, parseFloat(searchValue), false, maxResults);
    case "float32be":
      return searchFloat32(view, parseFloat(searchValue), true, maxResults);
    case "float64le":
      return searchFloat64(view, parseFloat(searchValue), false, maxResults);
    case "float64be":
      return searchFloat64(view, parseFloat(searchValue), true, maxResults);
    case "string-ascii":
      return searchStringASCII(data, searchValue, maxResults);
    case "string-utf8":
      return searchStringUTF8(data, searchValue, maxResults);
    case "timestamp-unix32":
      return searchUnixTimestamp32(view, searchValue, maxResults);
    case "timestamp-unix64":
      return searchUnixTimestamp64(view, searchValue, maxResults);
    default:
      return [];
  }
}

function searchInt8(view: DataView, target: number, maxResults: number): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  for (let i = 0; i < view.byteLength && results.length < maxResults; i++) {
    const value = view.getInt8(i);
    if (value === target) {
      results.push({ offset: i, value, type: "int8" });
    }
  }
  return results;
}

function searchUint8(data: Uint8Array, target: number, maxResults: number): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  for (let i = 0; i < data.length && results.length < maxResults; i++) {
    if (data[i] === target) {
      results.push({ offset: i, value: data[i], type: "uint8" });
    }
  }
  return results;
}

function searchInt16(
  view: DataView,
  target: number,
  bigEndian: boolean,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const type: DataType = bigEndian ? "int16be" : "int16le";
  for (let i = 0; i <= view.byteLength - 2 && results.length < maxResults; i++) {
    const value = view.getInt16(i, !bigEndian);
    if (value === target) {
      results.push({ offset: i, value, type });
    }
  }
  return results;
}

function searchUint16(
  view: DataView,
  target: number,
  bigEndian: boolean,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const type: DataType = bigEndian ? "uint16be" : "uint16le";
  for (let i = 0; i <= view.byteLength - 2 && results.length < maxResults; i++) {
    const value = view.getUint16(i, !bigEndian);
    if (value === target) {
      results.push({ offset: i, value, type });
    }
  }
  return results;
}

function searchInt32(
  view: DataView,
  target: number,
  bigEndian: boolean,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const type: DataType = bigEndian ? "int32be" : "int32le";
  for (let i = 0; i <= view.byteLength - 4 && results.length < maxResults; i++) {
    const value = view.getInt32(i, !bigEndian);
    if (value === target) {
      results.push({ offset: i, value, type });
    }
  }
  return results;
}

function searchUint32(
  view: DataView,
  target: number,
  bigEndian: boolean,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const type: DataType = bigEndian ? "uint32be" : "uint32le";
  for (let i = 0; i <= view.byteLength - 4 && results.length < maxResults; i++) {
    const value = view.getUint32(i, !bigEndian);
    if (value === target) {
      results.push({ offset: i, value, type });
    }
  }
  return results;
}

function searchFloat32(
  view: DataView,
  target: number,
  bigEndian: boolean,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const type: DataType = bigEndian ? "float32be" : "float32le";
  const epsilon = Math.abs(target) * 0.0001 || 0.0001; // 0.01% tolerance

  for (let i = 0; i <= view.byteLength - 4 && results.length < maxResults; i++) {
    const value = view.getFloat32(i, !bigEndian);
    if (!isNaN(value) && Math.abs(value - target) < epsilon) {
      results.push({ offset: i, value, type });
    }
  }
  return results;
}

function searchFloat64(
  view: DataView,
  target: number,
  bigEndian: boolean,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const type: DataType = bigEndian ? "float64be" : "float64le";
  const epsilon = Math.abs(target) * 0.0001 || 0.0001;

  for (let i = 0; i <= view.byteLength - 8 && results.length < maxResults; i++) {
    const value = view.getFloat64(i, !bigEndian);
    if (!isNaN(value) && Math.abs(value - target) < epsilon) {
      results.push({ offset: i, value, type });
    }
  }
  return results;
}

function searchStringASCII(
  data: Uint8Array,
  target: string,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const targetBytes = Array.from(target).map((c) => c.charCodeAt(0));

  for (let i = 0; i <= data.length - targetBytes.length && results.length < maxResults; i++) {
    let match = true;
    for (let j = 0; j < targetBytes.length; j++) {
      if (data[i + j] !== targetBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      results.push({ offset: i, value: target, type: "string-ascii" });
    }
  }
  return results;
}

function searchStringUTF8(
  data: Uint8Array,
  target: string,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  const encoder = new TextEncoder();
  const targetBytes = encoder.encode(target);

  for (let i = 0; i <= data.length - targetBytes.length && results.length < maxResults; i++) {
    let match = true;
    for (let j = 0; j < targetBytes.length; j++) {
      if (data[i + j] !== targetBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      results.push({ offset: i, value: target, type: "string-utf8" });
    }
  }
  return results;
}

function searchUnixTimestamp32(
  view: DataView,
  targetDateStr: string,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  let targetTimestamp: number;

  try {
    targetTimestamp = Math.floor(new Date(targetDateStr).getTime() / 1000);
  } catch {
    return results;
  }

  // Search with 1 day tolerance
  const tolerance = 86400; // 1 day in seconds

  for (let i = 0; i <= view.byteLength - 4 && results.length < maxResults; i++) {
    const timestamp = view.getUint32(i, true); // Little endian
    // Unix timestamp range: 1970-2050
    if (timestamp > 0 && timestamp < 2524608000) {
      if (Math.abs(timestamp - targetTimestamp) < tolerance) {
        const date = new Date(timestamp * 1000);
        results.push({ offset: i, value: date.toISOString(), type: "timestamp-unix32" });
      }
    }
  }
  return results;
}

function searchUnixTimestamp64(
  view: DataView,
  targetDateStr: string,
  maxResults: number
): TypeSearchResult[] {
  const results: TypeSearchResult[] = [];
  let targetTimestamp: number;

  try {
    targetTimestamp = new Date(targetDateStr).getTime();
  } catch {
    return results;
  }

  const tolerance = 86400000; // 1 day in milliseconds

  for (let i = 0; i <= view.byteLength - 8 && results.length < maxResults; i++) {
    try {
      const timestamp = Number(view.getBigInt64(i, true)); // Little endian
      // Unix timestamp range in ms
      if (timestamp > 0 && timestamp < 2524608000000) {
        if (Math.abs(timestamp - targetTimestamp) < tolerance) {
          const date = new Date(timestamp);
          results.push({ offset: i, value: date.toISOString(), type: "timestamp-unix64" });
        }
      }
    } catch {
      // Skip invalid BigInt reads
    }
  }
  return results;
}

/**
 * Get display name for data type
 */
export function getDataTypeName(type: DataType): string {
  const names: Record<DataType, string> = {
    int8: "Int8 (signed byte)",
    uint8: "UInt8 (unsigned byte)",
    int16le: "Int16 (LE, signed)",
    int16be: "Int16 (BE, signed)",
    uint16le: "UInt16 (LE, unsigned)",
    uint16be: "UInt16 (BE, unsigned)",
    int32le: "Int32 (LE, signed)",
    int32be: "Int32 (BE, signed)",
    uint32le: "UInt32 (LE, unsigned)",
    uint32be: "UInt32 (BE, unsigned)",
    float32le: "Float32 (LE)",
    float32be: "Float32 (BE)",
    float64le: "Float64 (LE)",
    float64be: "Float64 (BE)",
    "string-ascii": "ASCII String",
    "string-utf8": "UTF-8 String",
    "timestamp-unix32": "Unix Timestamp (32-bit)",
    "timestamp-unix64": "Unix Timestamp (64-bit)",
  };
  return names[type] || type;
}

/**
 * Get all available data types grouped by category
 */
export function getDataTypeCategories() {
  return {
    "Integers (8-bit)": ["int8", "uint8"] as DataType[],
    "Integers (16-bit)": ["int16le", "int16be", "uint16le", "uint16be"] as DataType[],
    "Integers (32-bit)": ["int32le", "int32be", "uint32le", "uint32be"] as DataType[],
    "Floating Point": ["float32le", "float32be", "float64le", "float64be"] as DataType[],
    Strings: ["string-ascii", "string-utf8"] as DataType[],
    Timestamps: ["timestamp-unix32", "timestamp-unix64"] as DataType[],
  };
}

/**
 * Get the byte size of a data type (returns undefined for variable-length types like strings)
 */
export function getDataTypeSize(type: DataType): number | undefined {
  const sizes: Partial<Record<DataType, number>> = {
    int8: 1,
    uint8: 1,
    int16le: 2,
    int16be: 2,
    uint16le: 2,
    uint16be: 2,
    int32le: 4,
    int32be: 4,
    uint32le: 4,
    uint32be: 4,
    float32le: 4,
    float32be: 4,
    float64le: 8,
    float64be: 8,
    "timestamp-unix32": 4,
    "timestamp-unix64": 8,
    // string types are variable length
  };
  return sizes[type];
}
