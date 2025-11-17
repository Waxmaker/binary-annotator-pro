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
  
  // Use the first highlight color with transparency
  const primaryColor = highlights[0].color;
  
  return {
    backgroundColor: hexToRgba(primaryColor, 0.3),
    outline: `1px solid ${hexToRgba(primaryColor, 0.6)}`,
  };
}
