import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseYamlConfig, YamlConfig, getDefaultYaml } from '@/utils/yamlParser';
import { HighlightRange } from '@/utils/colorUtils';
import { searchBinary } from '@/lib/api';

export function useYamlConfig(buffer: ArrayBuffer | null, fileName: string | null) {
  const [yamlText, setYamlText] = useState(getDefaultYaml());
  const [config, setConfig] = useState<YamlConfig | null>(null);
  const [searchHighlights, setSearchHighlights] = useState<HighlightRange[]>([]);
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

    return ranges;
  }, [config, buffer]);

  // Perform backend searches when config changes
  useEffect(() => {
    if (!config || !config.search || !fileName) {
      setSearchHighlights([]);
      return;
    }

    const performSearches = async () => {
      const allHighlights: HighlightRange[] = [];

      for (const [name, search] of Object.entries(config.search)) {
        const searchType = search.type || 'string-ascii';

        try {
          const response = await searchBinary(fileName, search.value, searchType);

          response.matches.forEach((match) => {
            allHighlights.push({
              start: match.offset,
              end: match.offset + match.length,
              color: search.color,
              name: `${name} (${search.value})`,
              type: 'search',
            });
          });
        } catch (error) {
          console.warn(`Failed to search for ${name}:`, error);
        }
      }

      setSearchHighlights(allHighlights);
    };

    performSearches();
  }, [config, fileName]);

  // Parse initial YAML
  useMemo(() => {
    const { config: parsed, error: parseError } = parseYamlConfig(yamlText);
    setConfig(parsed);
    setError(parseError);
  }, []);

  // Combine tag highlights with search highlights
  const allHighlights = useMemo(() => {
    return [...highlights, ...searchHighlights];
  }, [highlights, searchHighlights]);

  return {
    yamlText,
    config,
    error,
    highlights: allHighlights,
    updateYaml,
  };
}
