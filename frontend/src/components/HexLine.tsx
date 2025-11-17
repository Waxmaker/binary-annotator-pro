import { memo } from 'react';
import { formatAddress, toHexString } from '@/utils/binaryUtils';
import { HighlightRange, getHighlightsForByte, createHighlightStyle } from '@/utils/colorUtils';

interface HexLineProps {
  offset: number;
  bytes: number[];
  highlights: HighlightRange[];
  selection: { start: number; end: number } | null;
  onByteClick: (offset: number) => void;
  onByteMouseEnter: (offset: number) => void;
  style?: React.CSSProperties;
}

export const HexLine = memo(function HexLine({
  offset,
  bytes,
  highlights,
  selection,
  onByteClick,
  onByteMouseEnter,
  style,
}: HexLineProps) {
  const isSelected = (byteOffset: number) => {
    if (!selection) return false;
    return byteOffset >= selection.start && byteOffset <= selection.end;
  };

  return (
    <div
      className="flex items-center font-mono text-xs hover:bg-muted/20 transition-colors"
      style={style}
    >
      {/* Address */}
      <div className="w-24 flex-shrink-0 text-hex-address pr-4 text-right select-none">
        {formatAddress(offset)}
      </div>

      {/* Hex bytes */}
      <div className="flex-1 flex flex-wrap gap-1">
        {bytes.map((byte, i) => {
          const byteOffset = offset + i;
          const byteHighlights = getHighlightsForByte(byteOffset, highlights);
          const selected = isSelected(byteOffset);
          const highlightStyle = createHighlightStyle(byteHighlights);

          return (
            <span
              key={i}
              className={`px-1 cursor-pointer select-none transition-all ${
                selected
                  ? 'bg-hex-selected text-white font-bold'
                  : 'text-hex-text hover:bg-muted/40'
              }`}
              style={!selected ? highlightStyle : undefined}
              onClick={() => onByteClick(byteOffset)}
              onMouseEnter={() => onByteMouseEnter(byteOffset)}
              title={
                byteHighlights.length > 0
                  ? byteHighlights.map(h => h.name).join(', ')
                  : undefined
              }
            >
              {toHexString(byte)}
            </span>
          );
        })}
      </div>

      {/* ASCII */}
      <div className="w-32 flex-shrink-0 text-hex-ascii pl-4 border-l border-border">
        {bytes.map((byte, i) => {
          const byteOffset = offset + i;
          const selected = isSelected(byteOffset);
          const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '·';

          return (
            <span
              key={i}
              className={`cursor-pointer select-none ${
                selected ? 'bg-hex-selected text-white font-bold' : ''
              }`}
              onClick={() => onByteClick(byteOffset)}
            >
              {char}
            </span>
          );
        })}
      </div>
    </div>
  );
});
