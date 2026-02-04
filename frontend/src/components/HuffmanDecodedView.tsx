import { useMemo } from "react";
import type { HuffmanTable } from "@/services/huffmanApi";
import { FileText, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface HuffmanDecodedViewProps {
  decodedResult: {
    symbols: number[];
    bits: string[];
    symbolMap: Map<number, string>;
  } | null;
  table: HuffmanTable | null;
  fileName?: string;
}

export function HuffmanDecodedView({
  decodedResult,
  table,
  fileName,
}: HuffmanDecodedViewProps) {
  // Calculate symbol statistics
  const symbolStats = useMemo(() => {
    if (!decodedResult?.symbols.length) return [];

    const counts = new Map<number, number>();
    decodedResult.symbols.forEach((symbol) => {
      counts.set(symbol, (counts.get(symbol) || 0) + 1);
    });

    const total = decodedResult.symbols.length;
    
    return Array.from(counts.entries())
      .map(([symbol, count]) => ({
        symbol,
        count,
        percentage: (count / total) * 100,
        code: decodedResult.symbolMap.get(symbol) || "N/A",
      }))
      .sort((a, b) => b.count - a.count);
  }, [decodedResult]);

  // Calculate global stats
  const stats = useMemo(() => {
    if (!decodedResult?.symbols.length || !table?.entries) return null;

    const totalBits = decodedResult.bits.length;
    const uniqueSymbols = symbolStats.length;
    const avgCodeLength = totalBits / decodedResult.symbols.length;
    
    // Find min/max code lengths
    const codeLengths = table.entries.map(e => e.code_length);
    const minLength = Math.min(...codeLengths);
    const maxLength = Math.max(...codeLengths);

    return {
      totalSymbols: decodedResult.symbols.length,
      totalBits,
      uniqueSymbols,
      avgCodeLength,
      minLength,
      maxLength,
    };
  }, [decodedResult, table, symbolStats]);

  if (!decodedResult) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Decoded Results</CardTitle>
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
            <CardTitle className="text-sm font-semibold">Decoded Results</CardTitle>
            <Badge variant="secondary">
              {decodedResult.symbols.length.toLocaleString()} symbols
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col overflow-hidden space-y-4">
        {/* Global Statistics */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground">Total Bits</div>
              <div className="text-lg font-mono font-semibold">{stats.totalBits.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Avg Code Length</div>
              <div className="text-lg font-mono font-semibold">{stats.avgCodeLength.toFixed(2)} bits</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Code Length Range</div>
              <div className="text-lg font-mono font-semibold">{stats.minLength}-{stats.maxLength} bits</div>
            </div>
          </div>
        )}

        {/* Symbol Sequence */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Symbol Sequence</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Showing {Math.min(decodedResult.symbols.length, 1000)} of {decodedResult.symbols.length.toLocaleString()}
            </span>
          </div>
          
          <ScrollArea className="flex-1 border rounded-lg bg-hex-background p-3">
            <div className="font-mono text-sm">
              {decodedResult.symbols.slice(0, 1000).map((symbol, idx) => {
                const hue = (symbol * 137) % 360;
                const bgColor = `hsla(${hue}, 70%, 60%, 0.2)`;
                const borderColor = `hsla(${hue}, 70%, 60%, 0.5)`;
                
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 m-0.5 rounded text-xs cursor-default hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: bgColor,
                      border: `1px solid ${borderColor}`,
                    }}
                    title={`Index: ${idx}, Symbol: ${symbol}, Code: ${decodedResult.symbolMap.get(symbol) || "N/A"}`}
                  >
                    {symbol}
                  </span>
                );
              })}
              {decodedResult.symbols.length > 1000 && (
                <span className="text-muted-foreground text-xs ml-2">
                  ... +{decodedResult.symbols.length - 1000} more
                </span>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Symbol Statistics Table */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Symbol Statistics</span>
          </div>
          
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-3 space-y-2">
              {symbolStats.map(({ symbol, count, percentage, code }) => {
                const hue = (symbol * 137) % 360;
                const bgColor = `hsla(${hue}, 70%, 60%, 0.15)`;
                
                return (
                  <div
                    key={symbol}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                    style={{ backgroundColor: bgColor }}
                  >
                    {/* Symbol */}
                    <div className="w-12 text-center">
                      <span className="font-mono text-lg font-bold">{symbol}</span>
                    </div>
                    
                    {/* Code */}
                    <div className="w-24 font-mono text-xs text-muted-foreground">
                      {code}
                    </div>
                    
                    {/* Count */}
                    <div className="w-20 text-right font-mono text-sm">
                      {count.toLocaleString()}
                    </div>
                    
                    {/* Percentage Bar */}
                    <div className="flex-1 flex items-center gap-2">
                      <Progress value={percentage} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
