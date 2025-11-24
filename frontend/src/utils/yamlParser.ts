import yaml from 'js-yaml';
import { DataType } from './typeSearch';

export type SearchType = DataType | 'hex';

export interface SearchRule {
  value: string;
  color: string;
  type?: SearchType; // Default to 'string-ascii' if not specified
  start?: number | string; // Optional start offset (hex or decimal)
  end?: number | string; // Optional end offset (hex or decimal)
  regex?: boolean; // Enable regex matching (for hex and string types)
}

export interface TagRule {
  offset: number | string;
  size: number;
  color: string;
}

export interface YamlConfig {
  search?: Record<string, SearchRule>;
  tags?: Record<string, TagRule>;
}

export interface ParsedYamlResult {
  config: YamlConfig | null;
  error: string | null;
}

export function parseYamlConfig(yamlText: string): ParsedYamlResult {
  try {
    const parsed = yaml.load(yamlText) as YamlConfig;
    
    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      return { config: null, error: 'Invalid YAML structure' };
    }
    
    // Convert hex string offsets to numbers
    if (parsed.tags) {
      Object.keys(parsed.tags).forEach(key => {
        const tag = parsed.tags![key];
        if (typeof tag.offset === 'string') {
          tag.offset = parseInt(tag.offset, 16);
        }
      });
    }

    // Convert hex string start/end to numbers in search rules
    if (parsed.search) {
      Object.keys(parsed.search).forEach(key => {
        const search = parsed.search![key];
        if (search.start !== undefined && typeof search.start === 'string') {
          search.start = parseInt(search.start, 16);
        }
        if (search.end !== undefined && typeof search.end === 'string') {
          search.end = parseInt(search.end, 16);
        }
      });
    }

    return { config: parsed, error: null };
  } catch (e) {
    return {
      config: null,
      error: e instanceof Error ? e.message : 'Failed to parse YAML',
    };
  }
}

export function getDefaultYaml(): string {
  return `# ECG/Holter Binary Format Configuration
# Used for reverse-engineering medical device formats

search:
  # Common firmware signatures (ASCII string)
  firmware_magic:
    value: "DICM"
    type: string-ascii
    color: "#FF6B6B"

  # Delimiter patterns (hex bytes)
  sync_marker:
    value: "FF FF"
    type: hex
    color: "#4ECDC4"

  # Device identifiers (ASCII)
  nihon_kohden:
    value: "NK"
    type: string-ascii
    color: "#95E1D3"

  schiller:
    value: "SCH"
    type: string-ascii
    color: "#F38181"

  # Example: Search for specific integer value
  # sample_rate_500:
  #   value: "500"
  #   type: uint16le
  #   color: "#FFD93D"

tags:
  # File header (typical for most ECG formats)
  file_header:
    offset: 0x0000
    size: 256
    color: "#95E1D3"
    # Often contains: magic bytes, version, device ID, patient info
  
  # Metadata block
  patient_metadata:
    offset: 0x0100
    size: 512
    color: "#AA96DA"
    # Patient name, ID, DOB, gender, acquisition time
  
  # Lead configuration
  lead_config:
    offset: 0x0300
    size: 128
    color: "#FCBAD3"
    # Number of leads, sample rate, gain settings, filters
  
  # Lead I samples (2 bytes per sample, 16-bit signed)
  lead_i_data:
    offset: 0x1000
    size: 10000
    color: "#FFD93D"
    # 5000 samples at 500 Hz = 10 seconds
  
  # Lead II samples
  lead_ii_data:
    offset: 0x3710
    size: 10000
    color: "#6BCF7F"
  
  # Lead III samples  
  lead_iii_data:
    offset: 0x5E20
    size: 10000
    color: "#4D96FF"
  
  # Waveform footer / checksum
  data_checksum:
    offset: 0x8530
    size: 4
    color: "#FF6B9D"

# Notes for reverse engineering:
# - Most ECG formats use 16-bit signed integers for amplitude
# - Sample rates: 250 Hz, 500 Hz, 1000 Hz are common
# - 12-lead ECG: I, II, III, aVR, aVL, aVF, V1-V6
# - Look for: sync bytes, CRC/checksums, timestamp fields
# - Holter formats may include RR intervals, annotations
`;
}
