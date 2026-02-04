import { useMemo } from "react";
import type { HuffmanTable, HuffmanTableEntry } from "@/services/huffmanApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface HuffmanCodeTableProps {
  table: HuffmanTable | null;
  decodedResult: {
    symbols: number[];
    bits: string[];
    symbolMap: Map<number, string>;
  } | null;
}

interface TableRowData {
  entry: HuffmanTableEntry;
  count: number;
  frequency: number;
}

export function HuffmanCodeTable({
  table,
  decodedResult,
}: HuffmanCodeTableProps) {
  const tableData = useMemo((): TableRowData[] => {
    if (!table?.entries) return [];

    const totalSymbols = decodedResult?.symbols.length || 0;
    const symbolCounts = new Map<number, number>();

    decodedResult?.symbols.forEach((symbol) => {
      symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1);
    });

    return table.entries.map((entry) => {
      const count = symbolCounts.get(entry.symbol) || 0;
      return {
        entry,
        count,
        frequency: totalSymbols > 0 ? (count / totalSymbols) * 100 : 0,
      };
    });
  }, [table, decodedResult]);

  const stats = useMemo(() => {
    if (!tableData.length) return null;

    const totalBits = tableData.reduce(
      (sum, row) => sum + row.entry.code_length * row.count,
      0
    );
    const avgCodeLength =
      decodedResult?.symbols.length
        ? totalBits / decodedResult.symbols.length
        : 0;
    const maxCodeLength = Math.max(...tableData.map((r) => r.entry.code_length));
    const minCodeLength = Math.min(...tableData.map((r) => r.entry.code_length));

    return {
      totalBits,
      avgCodeLength,
      maxCodeLength,
      minCodeLength,
      uniqueSymbols: tableData.length,
    };
  }, [tableData, decodedResult]);

  if (!table) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground">
          <p>Select a Huffman table to view codes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Code Table: {table.name}</CardTitle>
          {decodedResult && (
            <Badge variant="secondary">
              {decodedResult.symbols.length} symbols
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {stats && decodedResult && (
          <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-muted/50 rounded-lg text-xs">
            <div>
              <div className="text-muted-foreground">Total Bits</div>
              <div className="font-mono font-semibold">{stats.totalBits.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg Length</div>
              <div className="font-mono font-semibold">{stats.avgCodeLength.toFixed(2)} bits</div>
            </div>
            <div>
              <div className="text-muted-foreground">Min/Max</div>
              <div className="font-mono font-semibold">
                {stats.minCodeLength}/{stats.maxCodeLength}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Unique Symbols</div>
              <div className="font-mono font-semibold">{stats.uniqueSymbols}</div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto border rounded-lg relative">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-20">Symbol</TableHead>
                <TableHead className="w-24">Code</TableHead>
                <TableHead className="w-20">Length</TableHead>
                {decodedResult && (
                  <>
                    <TableHead className="w-20">Count</TableHead>
                    <TableHead className="w-24">Frequency</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow
                  key={row.entry.symbol}
                  className={row.count > 0 ? "bg-primary/5" : ""}
                >
                  <TableCell className="font-mono font-semibold">
                    {row.entry.symbol}
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                      {row.entry.code}
                    </code>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">
                      {row.entry.code_length}
                    </Badge>
                  </TableCell>
                  {decodedResult && (
                    <>
                      <TableCell className="text-center font-mono">
                        {row.count > 0 ? (
                          <span className="text-primary font-semibold">{row.count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.frequency > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.min(row.frequency, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-12 text-right">
                              {row.frequency.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs space-y-2">
          <div className="font-semibold text-muted-foreground">How to read:</div>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-3 w-3" />
            <span>Symbol: The decoded value</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-3 w-3" />
            <span>Code: Binary representation</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-3 w-3" />
            <span>Length: Number of bits</span>
          </div>
          {decodedResult && (
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3 w-3" />
              <span>Highlighted rows appeared in decoded data</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
