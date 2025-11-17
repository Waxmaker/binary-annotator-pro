// Binary pattern search utilities for ECG format analysis

export interface PatternMatch {
  offset: number;
  length: number;
  context?: number[]; // Surrounding bytes for context
}

/**
 * Search for a hex pattern in buffer
 * Pattern can be: "FF FF 11" or "FFFF11" or array of bytes
 */
export function findHexPattern(
  buffer: ArrayBuffer,
  pattern: string | number[]
): PatternMatch[] {
  const view = new Uint8Array(buffer);
  const matches: PatternMatch[] = [];
  
  // Parse pattern if string
  const patternBytes = typeof pattern === 'string' 
    ? parseHexString(pattern) 
    : pattern;
  
  if (patternBytes.length === 0) return matches;
  
  // Search for pattern
  for (let i = 0; i <= view.length - patternBytes.length; i++) {
    let found = true;
    
    for (let j = 0; j < patternBytes.length; j++) {
      if (view[i + j] !== patternBytes[j]) {
        found = false;
        break;
      }
    }
    
    if (found) {
      // Get context (8 bytes before and after)
      const contextStart = Math.max(0, i - 8);
      const contextEnd = Math.min(view.length, i + patternBytes.length + 8);
      const context = Array.from(view.slice(contextStart, contextEnd));
      
      matches.push({
        offset: i,
        length: patternBytes.length,
        context,
      });
    }
  }
  
  return matches;
}

/**
 * Find repeating patterns (useful for finding lead data blocks)
 */
export function findRepeatingPattern(
  buffer: ArrayBuffer,
  minLength: number = 2,
  maxLength: number = 16,
  minOccurrences: number = 3
): Array<{ pattern: number[]; offsets: number[] }> {
  const view = new Uint8Array(buffer);
  const results: Array<{ pattern: number[]; offsets: number[] }> = [];
  const foundPatterns = new Set<string>();
  
  // Limit search to first 64KB for performance
  const searchLimit = Math.min(view.length, 65536);
  
  for (let length = minLength; length <= maxLength; length++) {
    for (let start = 0; start < searchLimit - length; start++) {
      const pattern = Array.from(view.slice(start, start + length));
      const patternKey = pattern.join(',');
      
      if (foundPatterns.has(patternKey)) continue;
      
      // Find all occurrences of this pattern
      const offsets: number[] = [];
      for (let i = 0; i <= view.length - length; i++) {
        let match = true;
        for (let j = 0; j < length; j++) {
          if (view[i + j] !== pattern[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          offsets.push(i);
        }
      }
      
      if (offsets.length >= minOccurrences) {
        foundPatterns.add(patternKey);
        results.push({ pattern, offsets });
      }
    }
  }
  
  // Sort by number of occurrences (most frequent first)
  return results.sort((a, b) => b.offsets.length - a.offsets.length);
}

/**
 * Find delimiters/markers in binary data
 */
export function findDelimiters(buffer: ArrayBuffer): PatternMatch[] {
  const commonDelimiters = [
    [0xFF, 0xFF],           // Common marker
    [0x00, 0x00],           // Null delimiter
    [0xAA, 0xAA],           // Pattern marker
    [0x55, 0x55],           // Alt pattern
    [0xFF, 0xFF, 0xFF, 0xFF], // 4-byte marker
    [0x0D, 0x0A],           // CRLF (sometimes in mixed formats)
  ];
  
  const allMatches: PatternMatch[] = [];
  
  for (const delimiter of commonDelimiters) {
    const matches = findHexPattern(buffer, delimiter);
    allMatches.push(...matches);
  }
  
  // Sort by offset
  return allMatches.sort((a, b) => a.offset - b.offset);
}

/**
 * Analyze data entropy to find compressed/encrypted sections
 */
export function analyzeEntropy(
  buffer: ArrayBuffer,
  blockSize: number = 256
): Array<{ offset: number; entropy: number }> {
  const view = new Uint8Array(buffer);
  const results: Array<{ offset: number; entropy: number }> = [];
  
  for (let i = 0; i < view.length; i += blockSize) {
    const block = view.slice(i, Math.min(i + blockSize, view.length));
    const entropy = calculateEntropy(block);
    results.push({ offset: i, entropy });
  }
  
  return results;
}

/**
 * Calculate Shannon entropy of a byte sequence
 */
function calculateEntropy(data: Uint8Array): number {
  const frequencies = new Map<number, number>();
  
  // Count byte frequencies
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }
  
  // Calculate entropy
  let entropy = 0;
  const length = data.length;
  
  frequencies.forEach(count => {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  });
  
  return entropy;
}

/**
 * Parse hex string to bytes
 */
function parseHexString(hex: string): number[] {
  const cleaned = hex.replace(/\s+/g, '');
  const bytes: number[] = [];
  
  for (let i = 0; i < cleaned.length; i += 2) {
    const byteStr = cleaned.substr(i, 2);
    if (byteStr.length === 2 && /^[0-9A-Fa-f]{2}$/.test(byteStr)) {
      bytes.push(parseInt(byteStr, 16));
    }
  }
  
  return bytes;
}

/**
 * Find potential ECG lead blocks by analyzing data structure
 */
export function findLeadBlocks(
  buffer: ArrayBuffer,
  expectedLeadCount: number = 12,
  minSamplesPerLead: number = 1000
): Array<{ offset: number; possibleLeadData: boolean; reason: string }> {
  const view = new Uint8Array(buffer);
  const results: Array<{ offset: number; possibleLeadData: boolean; reason: string }> = [];
  
  const blockSize = minSamplesPerLead * 2; // Assuming 16-bit samples
  
  for (let i = 0; i < view.length - blockSize; i += 512) {
    const block = view.slice(i, i + blockSize);
    
    // Check for characteristics of ECG data:
    // 1. Not all zeros or all 0xFF
    // 2. Values in reasonable range for ADC
    // 3. Some variation (not constant)
    
    const allSame = block.every(b => b === block[0]);
    if (allSame) continue;
    
    // Check if values look like 12-bit or 16-bit samples
    let validSampleCount = 0;
    for (let j = 0; j < block.length - 1; j += 2) {
      const sample = (block[j] | (block[j + 1] << 8));
      // 12-bit samples typically in range -2048 to 2047
      // 16-bit samples typically in range -32768 to 32767
      if (Math.abs(sample) < 32768) {
        validSampleCount++;
      }
    }
    
    const validRatio = validSampleCount / (blockSize / 2);
    if (validRatio > 0.8) {
      results.push({
        offset: i,
        possibleLeadData: true,
        reason: `High valid sample ratio (${(validRatio * 100).toFixed(1)}%)`,
      });
    }
  }
  
  return results;
}
