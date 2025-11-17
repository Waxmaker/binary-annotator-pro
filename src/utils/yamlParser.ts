import yaml from 'js-yaml';

export interface SearchRule {
  value: string;
  color: string;
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
    
    return { config: parsed, error: null };
  } catch (e) {
    return {
      config: null,
      error: e instanceof Error ? e.message : 'Failed to parse YAML',
    };
  }
}

export function getDefaultYaml(): string {
  return `# Binary File Configuration
# Define search patterns and tagged regions

search:
  signature:
    value: "DICM"
    color: "#FF6B6B"
  
  patient_name:
    value: "John"
    color: "#4ECDC4"

tags:
  file_header:
    offset: 0x0000
    size: 128
    color: "#95E1D3"
  
  preamble:
    offset: 0x0080
    size: 4
    color: "#F38181"
  
  metadata_block:
    offset: 0x0200
    size: 512
    color: "#AA96DA"
  
  data_segment:
    offset: 0x1000
    size: 2048
    color: "#FCBAD3"
`;
}
