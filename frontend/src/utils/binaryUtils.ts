export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function toHexString(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

export function toAsciiChar(byte: number): string {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
}

export function formatAddress(offset: number): string {
  return '0x' + offset.toString(16).padStart(8, '0').toUpperCase();
}

export interface HexLine {
  offset: number;
  bytes: number[];
  ascii: string;
}

export function parseHexLines(buffer: ArrayBuffer, bytesPerLine: number = 16, startOffset: number = 0): HexLine[] {
  const view = new Uint8Array(buffer);
  const lines: HexLine[] = [];

  for (let i = 0; i < view.length; i += bytesPerLine) {
    const bytes = Array.from(view.slice(i, Math.min(i + bytesPerLine, view.length)));
    const ascii = bytes.map(toAsciiChar).join('');

    lines.push({
      offset: startOffset + i,
      bytes,
      ascii,
    });
  }

  return lines;
}

export function findByteMatches(buffer: ArrayBuffer, searchValue: string): number[] {
  const view = new Uint8Array(buffer);
  const matches: number[] = [];

  // Convert search value to bytes (ASCII)
  const searchBytes = new TextEncoder().encode(searchValue);

  for (let i = 0; i <= view.length - searchBytes.length; i++) {
    let found = true;
    for (let j = 0; j < searchBytes.length; j++) {
      if (view[i + j] !== searchBytes[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      matches.push(i);
    }
  }

  return matches;
}

export function findHexPattern(buffer: ArrayBuffer, hexPattern: string): number[] {
  const view = new Uint8Array(buffer);
  const matches: number[] = [];

  // Parse hex pattern (e.g., "FF 00 AB" or "FF00AB")
  const cleanHex = hexPattern.replace(/\s+/g, '').toUpperCase();
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Hex pattern must have even number of characters');
  }

  const pattern: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substr(i, 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex pattern at position ${i}`);
    }
    pattern.push(byte);
  }

  // Search for pattern
  for (let i = 0; i <= view.length - pattern.length; i++) {
    let found = true;
    for (let j = 0; j < pattern.length; j++) {
      if (view[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      matches.push(i);
    }
  }

  return matches;
}
