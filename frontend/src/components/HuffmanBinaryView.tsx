import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import type { HuffmanTable, HuffmanTableEntry } from "@/services/huffmanApi";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface HuffmanBinaryViewProps {
  fileData: Uint8Array | null;
  startOffset: number;
  endOffset: number;
  decodedResult: {
    symbols: number[];
    bits: string[];
    symbolMap: Map<number, string>;
  } | null;
  table: HuffmanTable | null;
}

interface BitInfo {
  byteIndex: number;
  bitIndex: number;
  value: number;
  symbol?: number;
  code?: string;
  color: string;
}

const BITS_PER_BYTE = 8;
const BYTES_PER_LINE = 8; // Show 8 bytes = 64 bits per line
const BITS_PER_LINE = BYTES_PER_LINE * BITS_PER_BYTE;
const LINE_HEIGHT = 28;
const VISIBLE_LINES = 40;

export function HuffmanBinaryView({
  fileData,
  startOffset,
  endOffset,
  decodedResult,
  table,
}: HuffmanBinaryViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate all bits data - same as before
  const bitsData = useMemo((): BitInfo[] => {
    if (!fileData) return [];
    if (startOffset >= endOffset) return [];
    if (startOffset >= fileData.length) return [];

    const bits: BitInfo[] = [];
    const actualEndOffset = Math.min(endOffset, fileData.length);
    const length = actualEndOffset - startOffset;

    // Limit to reasonable size for performance (128KB = 1M bits)
    const maxBytes = Math.min(length, 131072);

    for (let i = 0; i < maxBytes; i++) {
      const byteIndex = startOffset + i;
      const byte = fileData[byteIndex];

      for (let bit = 0; bit < 8; bit++) {
        const bitValue = (byte >> (7 - bit)) & 1;
        bits.push({
          byteIndex: i,
          bitIndex: bit,
          value: bitValue,
          color: "",
        });
      }
    }

    // Color bits based on decoded symbols
    if (decodedResult && table?.entries) {
      let bitPos = 0;
      const symbolToColor = new Map<number, string>();

      // Generate colors for each symbol
      table.entries.forEach((entry) => {
        const hue = (entry.symbol * 137) % 360;
        symbolToColor.set(entry.symbol, `hsla(${hue}, 70%, 60%, 0.85)`);
      });

      // Assign colors to bits based on symbols
      decodedResult.symbols.forEach((symbol) => {
        const code = decodedResult.symbolMap.get(symbol);
        if (code) {
          const color = symbolToColor.get(symbol) || "";
          for (let i = 0; i < code.length && bitPos < bits.length; i++) {
            bits[bitPos].symbol = symbol;
            bits[bitPos].code = code;
            bits[bitPos].color = color;
            bitPos++;
          }
        }
      });
    }

    return bits;
  }, [fileData, startOffset, endOffset, decodedResult, table]);

  // Calculate virtual scrolling parameters - EXACT same pattern as HexViewer
  const totalLines = Math.ceil(bitsData.length / BITS_PER_LINE);
  const totalHeight = totalLines * LINE_HEIGHT;

  const startLineIndex = Math.floor(scrollTop / LINE_HEIGHT);
  const endLineIndex = Math.min(startLineIndex + VISIBLE_LINES, totalLines);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Validation messages
  const getValidationMessage = () => {
    if (!fileData) {
      return { type: "warning" as const, message: "Please select a file first" };
    }
    if (startOffset >= endOffset) {
      return { type: "warning" as const, message: "Start offset must be less than end offset" };
    }
    if (startOffset >= fileData.length) {
      return { type: "error" as const, message: `Start offset (0x${startOffset.toString(16)}) is beyond file size (0x${fileData.length.toString(16)})` };
    }
    return null;
  };

  const validation = getValidationMessage();

  const legend = useMemo(() => {
    if (!table?.entries) return [];

    return table.entries.map((entry) => {
      const hue = (entry.symbol * 137) % 360;
      return {
        symbol: entry.symbol,
        color: `hsla(${hue}, 70%, 60%, 0.85)`,
        code: entry.code,
      };
    });
  }, [table]);

  // Render a single line of bits - similar to HexLine
  const renderBitLine = (lineIndex: number) => {
    const lineStartBit = lineIndex * BITS_PER_LINE;
    const lineBits = bitsData.slice(lineStartBit, lineStartBit + BITS_PER_LINE);
    const byteOffset = startOffset + Math.floor(lineStartBit / 8);

    return (
      <div
        key={lineIndex}
        className="flex items-center font-mono text-xs hover:bg-muted/20"
        style={{ height: LINE_HEIGHT }}
      >
        {/* Address - same style as HexViewer */}
        <div className="w-24 flex-shrink-0 text-hex-address pr-4 text-right select-none">
          {byteOffset.toString(16).toUpperCase().padStart(6, "0")}
        </div>

        {/* Bits - styled like hex bytes */}
        <div className="flex-1 flex">
          {lineBits.map((bit, bitIdx) => {
            const isByteBoundary = bitIdx > 0 && bitIdx % 8 === 0;
            const hasColor = bit.color !== "";

            return (
              <span
                key={bitIdx}
                className={`inline-flex items-center justify-center w-5 h-5 text-[10px] cursor-default select-none ${
                  hasColor
                    ? "text-black font-bold"
                    : "text-hex-text hover:bg-muted/40"
                }`}
                style={{
                  marginLeft: isByteBoundary ? "12px" : "2px",
                  backgroundColor: hasColor ? bit.color : "transparent",
                  borderRadius: "2px",
                }}
                title={
                  bit.symbol !== undefined
                    ? `Symbol: ${bit.symbol}, Code: ${bit.code}, Bit ${bit.bitIndex} of byte 0x${(startOffset + bit.byteIndex).toString(16).toUpperCase()}`
                    : `Bit ${bit.bitIndex} of byte 0x${(startOffset + bit.byteIndex).toString(16).toUpperCase()}`
                }
              >
                {bit.value}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Binary View (Bit Level)</CardTitle>
          {bitsData.length > 0 && (
            <Badge variant="secondary">
              {bitsData.length.toLocaleString()} bits
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
        {validation && (
          <Alert variant={validation.type === "error" ? "destructive" : "default"} className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validation.message}</AlertDescription>
          </Alert>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto bg-hex-background border rounded"
        >
          {bitsData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>{fileData ? "Select a valid section" : "Select a file"}</p>
              </div>
            </div>
          ) : (
            <div style={{ height: totalHeight, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: startLineIndex * LINE_HEIGHT,
                  left: 0,
                  right: 0,
                }}
              >
                {Array.from(
                  { length: endLineIndex - startLineIndex },
                  (_, i) => startLineIndex + i
                ).map((lineIndex) => renderBitLine(lineIndex))}
              </div>
            </div>
          )}
        </div>

        {legend.length > 0 && (
          <div className="mt-4 p-3 border rounded-lg bg-muted/30">
            <div className="text-xs font-semibold mb-2">Symbol Legend:</div>
            <div className="flex flex-wrap gap-2">
              {legend.slice(0, 16).map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center gap-1.5 text-xs bg-background px-2 py-1 rounded border"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-black"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.symbol}
                  </div>
                  <span className="font-mono text-muted-foreground">{item.code}</span>
                </div>
              ))}
              {legend.length > 16 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{legend.length - 16} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs space-y-1">
          <div className="font-semibold text-muted-foreground">View explanation:</div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] text-hex-text">0</span>
            <span>Each cell = 1 bit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-black rounded"
              style={{ backgroundColor: "hsla(200, 70%, 60%, 0.85)" }}
            >1</span>
            <span>Colored bits = decoded symbols</span>
          </div>
          <div>8 bits = 1 byte (spaced for readability)</div>
        </div>
      </CardContent>
    </Card>
  );
}
