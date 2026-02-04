// ECG-specific data conversions for medical format reverse engineering

export interface ECGConversions {
  // Standard conversions
  uint8: number;
  uint16LE: number;
  uint16BE: number;
  uint32LE: number;
  uint32BE: number;
  int8: number;
  int16LE: number;
  int16BE: number;
  int32LE: number;
  int32BE: number;
  float32LE: number;
  float32BE: number;
  float64LE: number;
  float64BE: number;

  // ECG-specific conversions
  signed12bit: number | null;
  packed3byte: number | null;
  amplitudeMV: number | null;
  bitFlags: string;

  // Text
  ascii: string;
  utf8: string;
}

/**
 * Extract signed 12-bit sample from 2 bytes
 * Common in ECG formats (e.g., 12-bit ADC values)
 */
export function extract12BitSigned(bytes: number[]): number | null {
  if (bytes.length < 2) return null;

  // Combine two bytes into 12-bit value
  let value = (bytes[0] | (bytes[1] << 8)) & 0x0fff;

  // Check sign bit (bit 11)
  if (value & 0x0800) {
    // Negative number - extend sign
    value = value | 0xf000;
    value = -(~value + 1) & 0xffff;
  }

  return value;
}

/**
 * Extract 3-byte packed sample (24-bit)
 * Used in some proprietary ECG formats
 */
export function extract3BytePacked(bytes: number[]): number | null {
  if (bytes.length < 3) return null;

  // Little-endian 24-bit signed
  let value = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16);

  // Sign extend to 32-bit
  if (value & 0x800000) {
    value = value | 0xff000000;
  }

  return value;
}

/**
 * Convert ADC value to millivolts
 * Typical ECG: 1 LSB = 2.5 µV (for 12-bit, 5mV range)
 */
export function convertToMillivolts(
  adcValue: number,
  gain: number = 2.5,
): number {
  return (adcValue * gain) / 1000; // Convert µV to mV
}

/**
 * Format byte as binary flags
 */
export function formatBitFlags(byte: number): string {
  return byte.toString(2).padStart(8, "0");
}

/**
 * Convert bytes with all ECG-specific interpretations
 */
export function convertBytesECG(bytes: number[]): ECGConversions {
  const buffer = new ArrayBuffer(Math.max(8, bytes.length));
  const view = new DataView(buffer);

  // Fill buffer with bytes
  bytes.forEach((byte, i) => {
    view.setUint8(i, byte);
  });

  // Standard conversions
  const conversions: ECGConversions = {
    uint8: bytes.length > 0 ? view.getUint8(0) : 0,
    uint16LE: bytes.length >= 2 ? view.getUint16(0, true) : 0,
    uint16BE: bytes.length >= 2 ? view.getUint16(0, false) : 0,
    uint32LE: bytes.length >= 4 ? view.getUint32(0, true) : 0,
    uint32BE: bytes.length >= 4 ? view.getUint32(0, false) : 0,
    int8: bytes.length > 0 ? view.getInt8(0) : 0,
    int16LE: bytes.length >= 2 ? view.getInt16(0, true) : 0,
    int16BE: bytes.length >= 2 ? view.getInt16(0, false) : 0,
    int32LE: bytes.length >= 4 ? view.getInt32(0, true) : 0,
    int32BE: bytes.length >= 4 ? view.getInt32(0, false) : 0,
    float32LE: bytes.length >= 4 ? view.getFloat32(0, true) : 0,
    float32BE: bytes.length >= 4 ? view.getFloat32(0, false) : 0,
    float64LE: bytes.length >= 8 ? view.getFloat64(0, true) : 0,
    float64BE: bytes.length >= 8 ? view.getFloat64(0, false) : 0,

    // ECG-specific
    signed12bit: extract12BitSigned(bytes),
    packed3byte: extract3BytePacked(bytes),
    amplitudeMV:
      bytes.length >= 2 ? convertToMillivolts(view.getInt16(0, true)) : null,
    bitFlags:
      bytes.length > 0
        ? bytes.map((b) => formatBitFlags(b)).join(" ")
        : "00000000",

    // Text
    ascii: bytes
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join(""),
    utf8: new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(bytes),
    ),
  };

  return conversions;
}

/**
 * Format hex bytes with spacing
 */
export function formatHexBytesSpaced(bytes: number[]): string {
  return bytes
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

/**
 * Parse hex pattern string (e.g., "FF FF 11" or "FFFF11")
 */
export function parseHexPattern(pattern: string): number[] {
  const cleaned = pattern.replace(/\s+/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i += 2) {
    const byteStr = cleaned.substr(i, 2);
    if (byteStr.length === 2) {
      bytes.push(parseInt(byteStr, 16));
    }
  }

  return bytes;
}

/**
 * Apply XOR operation with a hex key
 * @param bytes - Input bytes to XOR
 * @param hexKey - Hex key string (e.g., "FF", "A5B3")
 * @returns XORed bytes or null if invalid key
 */
export function applyXor(bytes: number[], hexKey: string): number[] | null {
  try {
    const keyBytes = parseHexPattern(hexKey);
    if (keyBytes.length === 0) return null;

    // Apply XOR with key bytes cycling
    return bytes.map((byte, index) => {
      const keyByte = keyBytes[index % keyBytes.length];
      return byte ^ keyByte;
    });
  } catch (error) {
    return null;
  }
}
