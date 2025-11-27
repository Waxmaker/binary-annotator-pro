import yaml from 'js-yaml';

/**
 * Adds a new tag to the YAML text
 * @param yamlText - Current YAML text
 * @param tagName - Name of the new tag
 * @param offset - Offset in hex (number)
 * @param size - Size in bytes
 * @param color - Hex color
 * @returns Updated YAML text
 */
export function addTagToYaml(
  yamlText: string,
  tagName: string,
  offset: number,
  size: number,
  color: string
): string {
  try {
    // Parse existing YAML
    let config: any = {};

    if (yamlText.trim()) {
      try {
        config = yaml.load(yamlText) || {};
      } catch (err) {
        // If parsing fails, start with empty config
        console.warn('Failed to parse existing YAML, starting fresh:', err);
        config = {};
      }
    }

    // Ensure tags section exists
    if (!config.tags) {
      config.tags = {};
    }

    // Check if tag name already exists
    if (config.tags[tagName]) {
      throw new Error(`Tag "${tagName}" already exists`);
    }

    // Add new tag
    config.tags[tagName] = {
      offset: `0x${offset.toString(16).toUpperCase().padStart(4, '0')}`,
      size: size,
      color: color,
    };

    // Generate YAML with proper formatting
    const newYaml = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });

    return newYaml;
  } catch (error) {
    throw error;
  }
}
