export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function blendColors(color1: string, color2: string): string {
  // Simple color blending - take the first non-transparent color
  return color1 || color2;
}

export interface HighlightRange {
  start: number;
  end: number;
  color: string;
  name: string;
  type: 'search' | 'tag';
}

export function getHighlightsForByte(
  offset: number,
  highlights: HighlightRange[]
): HighlightRange[] {
  return highlights.filter(h => offset >= h.start && offset < h.end);
}

export function createHighlightStyle(highlights: HighlightRange[]): React.CSSProperties {
  if (highlights.length === 0) return {};

  // Sort highlights by size (smaller ranges first = higher priority)
  // This ensures that specific tags (e.g., 2 bytes at 0x001)
  // are visible over larger tags (e.g., 256 bytes at 0x000)
  const sortedHighlights = [...highlights].sort((a, b) => {
    const sizeA = a.end - a.start;
    const sizeB = b.end - b.start;
    return sizeA - sizeB; // Smaller size = higher priority
  });

  // Use the smallest (most specific) highlight color
  const primaryColor = sortedHighlights[0].color;

  return {
    backgroundColor: hexToRgba(primaryColor, 0.3),
    outline: `1px solid ${hexToRgba(primaryColor, 0.6)}`,
  };
}
