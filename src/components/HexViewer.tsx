import { useRef, useCallback, useEffect, useState } from 'react';
import { HexLine } from './HexLine';
import { parseHexLines } from '@/utils/binaryUtils';
import { HighlightRange } from '@/utils/colorUtils';
import { FileText } from 'lucide-react';

interface HexViewerProps {
  buffer: ArrayBuffer | null;
  highlights: HighlightRange[];
  selection: { start: number; end: number; bytes: number[] } | null;
  onByteClick: (offset: number) => void;
  onByteMouseEnter: (offset: number) => void;
  scrollToOffset?: number | null;
}

const BYTES_PER_LINE = 16;
const LINE_HEIGHT = 24;
const VISIBLE_LINES = 50; // Number of lines to render at once

export function HexViewer({
  buffer,
  highlights,
  selection,
  onByteClick,
  onByteMouseEnter,
  scrollToOffset,
}: HexViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const lines = buffer ? parseHexLines(buffer, BYTES_PER_LINE) : [];
  const totalHeight = lines.length * LINE_HEIGHT;

  // Calculate visible range
  const startIndex = Math.floor(scrollTop / LINE_HEIGHT);
  const endIndex = Math.min(startIndex + VISIBLE_LINES, lines.length);
  const visibleLines = lines.slice(startIndex, endIndex);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    if (scrollToOffset !== null && scrollToOffset !== undefined && containerRef.current) {
      const lineIndex = Math.floor(scrollToOffset / BYTES_PER_LINE);
      const targetScroll = lineIndex * LINE_HEIGHT - (containerRef.current.clientHeight / 2);
      containerRef.current.scrollTop = Math.max(0, targetScroll);
    }
  }, [scrollToOffset]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-full bg-hex-background text-muted-foreground">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No file loaded</p>
          <p className="text-xs mt-2">Upload a binary file to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-full bg-hex-background overflow-auto"
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ 
          position: 'absolute',
          top: startIndex * LINE_HEIGHT,
          left: 0,
          right: 0,
        }}>
          {visibleLines.map((line, i) => {
            const lineIndex = startIndex + i;
            return (
              <HexLine
                key={lineIndex}
                offset={line.offset}
                bytes={line.bytes}
                highlights={highlights}
                selection={
                  selection
                    ? { start: selection.start, end: selection.end }
                    : null
                }
                onByteClick={onByteClick}
                onByteMouseEnter={onByteMouseEnter}
                style={{ height: LINE_HEIGHT }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
