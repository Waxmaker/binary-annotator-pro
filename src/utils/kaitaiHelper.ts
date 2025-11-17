// Kaitai Struct helper - generate KSY templates from YAML config

import { YamlConfig } from './yamlParser';

export interface KaitaiField {
  id: string;
  type?: string;
  size?: number;
  contents?: string;
}

export interface KaitaiStruct {
  meta: {
    id: string;
    endian: 'le' | 'be';
    title?: string;
  };
  seq: KaitaiField[];
}

/**
 * Generate a Kaitai Struct YAML template from current tag configuration
 */
export function generateKaitaiTemplate(
  config: YamlConfig | null,
  fileName: string = 'ecg_format'
): string {
  if (!config || !config.tags) {
    return generateDefaultKaitai();
  }
  
  const structId = fileName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  
  let ksy = `meta:
  id: ${structId}
  file-extension:
    - dat
    - ecg
    - bin
  endian: le
  title: ECG Format Structure
  
doc: |
  Reverse-engineered ECG/Holter format structure.
  Generated from binary analysis workbench.
  
seq:
`;
  
  // Convert tags to Kaitai fields
  const tags = Object.entries(config.tags).sort(
    ([, a], [, b]) => (a.offset as number) - (b.offset as number)
  );
  
  tags.forEach(([name, tag]) => {
    const fieldId = name.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const offset = tag.offset as number;
    const size = tag.size;
    
    ksy += `  - id: ${fieldId}\n`;
    
    // Determine type based on size
    if (size === 1) {
      ksy += `    type: u1\n`;
    } else if (size === 2) {
      ksy += `    type: u2\n`;
    } else if (size === 4) {
      ksy += `    type: u4\n`;
    } else if (size === 8) {
      ksy += `    type: u8\n`;
    } else {
      ksy += `    size: ${size}\n`;
    }
    
    ksy += `    doc: "${name} at offset 0x${offset.toString(16).toUpperCase()}"\n`;
  });
  
  // Add types section for common ECG structures
  ksy += `
types:
  lead_sample:
    seq:
      - id: value
        type: s2
        doc: "Signed 16-bit amplitude value"
  
  ecg_lead_block:
    seq:
      - id: samples
        type: lead_sample
        repeat: expr
        repeat-expr: 1000  # Adjust based on actual sample count
        doc: "Array of ECG samples for one lead"
`;
  
  return ksy;
}

/**
 * Generate default Kaitai template
 */
function generateDefaultKaitai(): string {
  return `meta:
  id: ecg_format
  file-extension:
    - dat
    - ecg
  endian: le
  title: ECG Format Structure
  
seq:
  - id: header
    size: 256
    doc: "File header containing metadata"
  
  - id: lead_data
    type: lead_block
    repeat: expr
    repeat-expr: 12
    doc: "12-lead ECG data"

types:
  lead_block:
    seq:
      - id: lead_samples
        type: s2
        repeat: expr
        repeat-expr: 5000
        doc: "5000 samples per lead at 500 Hz (10 seconds)"
`;
}

/**
 * Generate selection as Kaitai snippet
 */
export function generateKaitaiSnippet(
  selectionBytes: number[],
  startOffset: number,
  fieldName: string = 'selected_field'
): string {
  const size = selectionBytes.length;
  const fieldId = fieldName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  
  let snippet = `# Kaitai field definition for selection\n`;
  snippet += `- id: ${fieldId}\n`;
  
  // Determine appropriate type
  if (size === 1) {
    snippet += `  type: u1\n`;
  } else if (size === 2) {
    snippet += `  type: u2  # or s2 for signed\n`;
  } else if (size === 4) {
    snippet += `  type: u4  # or f4 for float\n`;
  } else {
    snippet += `  size: ${size}\n`;
  }
  
  snippet += `  doc: "Field at offset 0x${startOffset.toString(16).toUpperCase()} (${size} bytes)"\n`;
  
  return snippet;
}

/**
 * Export Kaitai template as downloadable file
 */
export function downloadKaitaiTemplate(ksy: string, fileName: string = 'format.ksy'): void {
  const blob = new Blob([ksy], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Suggest field types based on byte patterns
 */
export function suggestFieldType(bytes: number[]): string {
  if (bytes.length === 0) return 'unknown';
  if (bytes.length === 1) return 'u1 or s1';
  if (bytes.length === 2) {
    const value = bytes[0] | (bytes[1] << 8);
    if (value > 32767) return 's2 (signed 16-bit)';
    return 'u2 (unsigned 16-bit)';
  }
  if (bytes.length === 4) {
    return 'u4, s4, or f4 (float)';
  }
  if (bytes.length === 8) {
    return 'u8, s8, or f8 (double)';
  }
  
  // Check if it's a string
  const isAscii = bytes.every(b => (b >= 32 && b <= 126) || b === 0);
  if (isAscii) {
    return 'strz (null-terminated string)';
  }
  
  return `bytes[${bytes.length}]`;
}
