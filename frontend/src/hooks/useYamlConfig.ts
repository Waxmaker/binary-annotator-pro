import { useState, useCallback, useMemo } from 'react';
import { parseYamlConfig, YamlConfig, getDefaultYaml } from '@/utils/yamlParser';
import { findByteMatches } from '@/utils/binaryUtils';
import { HighlightRange } from '@/utils/colorUtils';

export function useYamlConfig(buffer: ArrayBuffer | null) {
  const [yamlText, setYamlText] = useState(getDefaultYaml());
  const [config, setConfig] = useState<YamlConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateYaml = useCallback((text: string) => {
    setYamlText(text);
    const { config: parsed, error: parseError } = parseYamlConfig(text);
    setConfig(parsed);
    setError(parseError);
  }, []);

  const highlights = useMemo((): HighlightRange[] => {
    if (!config || !buffer) return [];

    const ranges: HighlightRange[] = [];

    // Add tag highlights
    if (config.tags) {
      Object.entries(config.tags).forEach(([name, tag]) => {
        ranges.push({
          start: tag.offset as number,
          end: (tag.offset as number) + tag.size,
          color: tag.color,
          name,
          type: 'tag',
        });
      });
    }

    // Add search highlights
    if (config.search) {
      Object.entries(config.search).forEach(([name, search]) => {
        const matches = findByteMatches(buffer, search.value);
        matches.forEach(offset => {
          ranges.push({
            start: offset,
            end: offset + search.value.length,
            color: search.color,
            name: `${name} (${search.value})`,
            type: 'search',
          });
        });
      });
    }

    return ranges;
  }, [config, buffer]);

  // Parse initial YAML
  useMemo(() => {
    const { config: parsed, error: parseError } = parseYamlConfig(yamlText);
    setConfig(parsed);
    setError(parseError);
  }, []);

  return {
    yamlText,
    config,
    error,
    highlights,
    updateYaml,
  };
}
