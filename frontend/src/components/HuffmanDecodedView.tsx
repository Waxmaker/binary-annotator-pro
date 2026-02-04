import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import type { HuffmanTable, HuffmanTableEntry } from "@/services/huffmanApi";
import { FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HuffmanDecodedViewProps {
  decodedResult: {
    symbols: number[];
    bits: string[];
    symbolMap: Map<number, string>;
  } | null;
  table: HuffmanTable | null;
  fileName?: string;
}

const SYMBOLS_PER_LINE = 16;
const LINE_HEIGHT = 24;
const VISIBLE_LINES = 50;

export function HuffmanDecodedView({
  decodedResult,
  table,
  fileName,
}: HuffmanDecodedViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [activeView, setActiveView] = useState<"hex" | "decimal" | "ascii">("hex");

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate virtual scrolling parameters
  const totalLines = decodedResult
    ? Math.ceil(decodedResult.symbols.length / SYMBOLS_PER_LINE)
    : 0;
  const totalHeight = totalLines * LINE_HEIGHT;

  const startLineIndex = Math.floor(scrollTop / LINE_HEIGHT);
  const endLineIndex = Math.min(startLineIndex + VISIBLE_LINES, totalLines);

  // Format symbol based on active view
  const formatSymbol = (symbol: number): string => {
    switch (activeView) {
      case "hex":
        return symbol.toString(16).toUpperCase().padStart(2, "0");
      case "decimal":
        return symbol.toString().padStart(3, " ");
      case "ascii":
        return symbol >= 32 && symbol <= 126
          ? String.fromCharCode(symbol)
          : ".";
      default:
        return symbol.toString();
    }
  };

  // Generate colors for symbols
  const symbolColors = useMemo(() => {
    if (!table?.entries) return new Map<number, string>();
    
    const colors = new Map<number, string>();
    table.entries.forEach((entry) => {
      const hue = (entry.symbol * 137) % 360;
      colors.set(entry.symbol, `hsla(${hue}, 70%, 60%, 0.3)`);
    });
    return colors;
  }, [table]);

  // Export decoded data
  const handleExport = () => {
    if (!decodedResult) return;

    const content = decodedResult.symbols.join(", ");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName || "decoded"}_huffman.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!decodedResult) return;
    
    const content = decodedResult.symbols.join(", ");
    navigator.clipboard.writeText(content);
  };

  // Render a single line
  const renderLine = (lineIndex: number) => {
    if (!decodedResult) return null;

    const lineStartIdx = lineIndex * SYMBOLS_PER_LINE;
    const lineSymbols = decodedResult.symbols.slice(
      lineStartIdx,
      lineStartIdx + SYMBOLS_PER_LINE
    );

    return (
      <div
        key={lineIndex}
        className="flex items-center font-mono text-xs hover:bg-muted/20"
        style={{ height: LINE_HEIGHT }}
      >
        {/* Index */}
        <div className="w-20 flex-shrink-0 text-hex-address pr-4 text-right select-none">
          {lineStartIdx.toString(16).toUpperCase().padStart(6, "0")}
        </div>

        {/* Symbols */}
        <div className="flex-1 flex gap-1">
          {lineSymbols.map((symbol, idx) => {
            const color = symbolColors.get(symbol);
            return (
              <span
                key={idx}
                className={`inline-flex items-center justify-center min-w-[1.5rem] px-1 rounded cursor-default select-none ${
                  color ? "font-semibold" : ""
                }`}
                style={{
                  backgroundColor: color || "transparent",
                }}
                title={`Symbol: ${symbol}, Code: ${decodedResult.symbolMap.get(symbol) || "N/A"}`}
              >
                {formatSymbol(symbol)}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  if (!decodedResult) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Decoded Output</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>No decoded data yet</p>
            <p className="text-xs mt-2">Select a file and table, then click Decode</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Decoded Output</CardTitle>
            <Badge variant="secondary">
              {decodedResult.symbols.length.toLocaleString()} symbols
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              Copy
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="flex-1 flex flex-col">
          <TabsList className="mb-2">
            <TabsTrigger value="hex">Hex</TabsTrigger>
            <TabsTrigger value="decimal">Decimal</TabsTrigger>
            <TabsTrigger value="ascii">ASCII</TabsTrigger>
          </TabsList>

          <TabsContent value={activeView} className="flex-1 m-0">
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="h-full overflow-auto bg-hex-background border rounded font-mono"
            >
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
                  ).map((lineIndex) => renderLine(lineIndex))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
          <div>Hover symbols to see their Huffman code</div>
          <div>Colored background indicates symbol frequency</div>
        </div>
      </CardContent>
    </Card>
  );
}
