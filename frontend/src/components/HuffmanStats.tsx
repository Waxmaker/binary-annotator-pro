import type { HuffmanTable, HuffmanTableEntry } from "@/services/huffmanApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Binary,
  TrendingDown,
  Hash,
  Clock,
} from "lucide-react";

interface HuffmanStatsProps {
  decodedResult: {
    symbols: number[];
    bits: string[];
    symbolMap: Map<number, string>;
  };
  table: HuffmanTable;
  fileSize: number;
}

export function HuffmanStats({
  decodedResult,
  table,
  fileSize,
}: HuffmanStatsProps) {
  // Calculate statistics
  const totalBits = decodedResult.bits.length;
  const totalBytes = Math.ceil(totalBits / 8);
  const compressionRatio = fileSize > 0 ? (totalBytes / fileSize) * 100 : 0;
  const spaceSaved = 100 - compressionRatio;

  // Calculate symbol frequency
  const symbolCounts = new Map<number, number>();
  decodedResult.symbols.forEach((symbol) => {
    symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1);
  });

  // Calculate average code length
  const avgCodeLength = totalBits / decodedResult.symbols.length;

  // Find most/least frequent symbols
  let maxFreq = 0;
  let minFreq = Infinity;
  let mostFrequent: number | null = null;
  let leastFrequent: number | null = null;

  symbolCounts.forEach((count, symbol) => {
    if (count > maxFreq) {
      maxFreq = count;
      mostFrequent = symbol;
    }
    if (count < minFreq) {
      minFreq = count;
      leastFrequent = symbol;
    }
  });

  // Get code lengths for most/least frequent
  const getCodeLength = (symbol: number | null): number => {
    if (symbol === null) return 0;
    const code = decodedResult.symbolMap.get(symbol);
    return code?.length || 0;
  };

  const mostFrequentCodeLen = getCodeLength(mostFrequent);
  const leastFrequentCodeLen = getCodeLength(leastFrequent);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Decoding Statistics</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground">Symbols</div>
              <div className="text-lg font-mono font-semibold">
                {decodedResult.symbols.length.toLocaleString()}
              </div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-xs text-muted-foreground">Total Bits</div>
              <div className="text-lg font-mono font-semibold">
                {totalBits.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avg Code Length</span>
              <span className="font-mono font-semibold">
                {avgCodeLength.toFixed(2)} bits
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Unique Symbols</span>
              <span className="font-mono font-semibold">
                {symbolCounts.size}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-green-500" />
            <span className="text-sm font-semibold">Compression Analysis</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Original Size</span>
              <span className="font-mono">{fileSize.toLocaleString()} bytes</span>
            </div>            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Decoded Size</span>
              <span className="font-mono">{totalBytes.toLocaleString()} bytes</span>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Compression Ratio</span>
                <Badge
                  variant={spaceSaved > 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {spaceSaved > 0 ? "+" : ""}
                  {spaceSaved.toFixed(1)}%
                </Badge>
              </div>
              <Progress value={Math.min(compressionRatio, 100)} className="h-2" />
              <div className="text-[10px] text-muted-foreground mt-1">
                {spaceSaved > 0
                  ? `${spaceSaved.toFixed(1)}% space saved`
                  : spaceSaved < 0
                  ? `${Math.abs(spaceSaved).toFixed(1)}% overhead`
                  : "No compression"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold">Symbol Analysis</span>
          </div>

          {mostFrequent !== null && (
            <div className="space-y-2">
              <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                <div className="text-[10px] text-green-600 dark:text-green-400 font-semibold">
                  Most Frequent
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono font-bold">{mostFrequent}</span>
                  <div className="text-right">
                    <div className="text-xs font-semibold">{maxFreq}×</div>
                    <div className="text-[10px] text-muted-foreground">
                      {mostFrequentCodeLen} bits
                    </div>
                  </div>
                </div>
              </div>

              {leastFrequent !== null && leastFrequent !== mostFrequent && (
                <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800">
                  <div className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
                    Least Frequent
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-mono font-bold">{leastFrequent}</span>
                    <div className="text-right">
                      <div className="text-xs font-semibold">{minFreq}×</div>
                      <div className="text-[10px] text-muted-foreground">
                        {leastFrequentCodeLen} bits
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {mostFrequentCodeLen < leastFrequentCodeLen && (
                <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded">
                  ✓ Optimal: Most frequent symbol has shortest code
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold">Table Info</span>
          </div>

          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium truncate max-w-[120px]">{table.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entries</span>
              <span>{table.entries?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>
                {table.created_at
                  ? new Date(table.created_at).toLocaleDateString()
                  : "-"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
