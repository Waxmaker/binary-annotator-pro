import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  calculateDiffStats,
  findByteChanges,
  findChangedRegions,
  formatByte,
} from "@/utils/binaryDiff";

interface DeltaAnalysisProps {
  buffer1: ArrayBuffer | null;
  buffer2: ArrayBuffer | null;
  fileName1?: string;
  fileName2?: string;
}

export function DeltaAnalysis({
  buffer1,
  buffer2,
  fileName1 = "File 1",
  fileName2 = "File 2",
}: DeltaAnalysisProps) {
  const { stats, changes, regions } = useMemo(() => {
    if (!buffer1 || !buffer2) {
      return { stats: null, changes: [], regions: [] };
    }
    return {
      stats: calculateDiffStats(buffer1, buffer2),
      changes: findByteChanges(buffer1, buffer2),
      regions: findChangedRegions(buffer1, buffer2, 4),
    };
  }, [buffer1, buffer2]);

  if (!buffer1 || !buffer2) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select two files to compare
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h3 className="text-sm font-semibold">Delta Analysis</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Statistics */}
          {stats && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Statistics</h4>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Equal Bytes</div>
                    <div className="text-2xl font-bold text-green-700">
                      {stats.equalBytes.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {((stats.equalBytes / stats.totalBytes) * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">
                      Modified Bytes
                    </div>
                    <div className="text-2xl font-bold text-yellow-700">
                      {stats.modifiedBytes.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {((stats.modifiedBytes / stats.totalBytes) * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Similarity</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {stats.similarity.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Overall match
                    </div>
                  </CardContent>
                </Card>

                {stats.addedBytes > 0 && (
                  <Card className="bg-cyan-50 border-cyan-200">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Added Bytes
                      </div>
                      <div className="text-2xl font-bold text-cyan-700">
                        {stats.addedBytes.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        File 2 longer
                      </div>
                    </CardContent>
                  </Card>
                )}

                {stats.removedBytes > 0 && (
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Removed Bytes
                      </div>
                      <div className="text-2xl font-bold text-red-700">
                        {stats.removedBytes.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        File 1 longer
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Changed Regions */}
          <div>
            <h4 className="text-sm font-semibold mb-3">
              Changed Regions ({regions.length})
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-accent">
                  <tr className="text-left">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Offset</th>
                    <th className="py-2 px-3">Length</th>
                    <th className="py-2 px-3">End Offset</th>
                    <th className="py-2 px-3">Percent of File</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        No significant changed regions found (min 4 consecutive bytes)
                      </td>
                    </tr>
                  ) : (
                    regions.map((region, index) => (
                      <tr key={index} className="border-t hover:bg-accent/50">
                        <td className="py-2 px-3">{index + 1}</td>
                        <td className="py-2 px-3 font-mono">
                          0x{region.offset.toString(16).toUpperCase().padStart(8, "0")}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          {region.length} bytes
                        </td>
                        <td className="py-2 px-3 font-mono">
                          0x
                          {(region.offset + region.length)
                            .toString(16)
                            .toUpperCase()
                            .padStart(8, "0")}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {stats
                            ? ((region.length / stats.totalBytes) * 100).toFixed(2)
                            : "0"}
                          %
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual byte changes (limited to first 100) */}
          <div>
            <h4 className="text-sm font-semibold mb-3">
              Byte Changes (showing {Math.min(changes.length, 100)} of{" "}
              {changes.length})
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-accent">
                  <tr className="text-left">
                    <th className="py-2 px-3">Offset</th>
                    <th className="py-2 px-3">Old Value</th>
                    <th className="py-2 px-3">New Value</th>
                    <th className="py-2 px-3">Delta</th>
                    <th className="py-2 px-3">ASCII</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.slice(0, 100).map((change, index) => {
                    const delta = change.newValue - change.oldValue;
                    const oldChar =
                      change.oldValue >= 32 && change.oldValue <= 126
                        ? String.fromCharCode(change.oldValue)
                        : "·";
                    const newChar =
                      change.newValue >= 32 && change.newValue <= 126
                        ? String.fromCharCode(change.newValue)
                        : "·";

                    return (
                      <tr key={index} className="border-t hover:bg-accent/50">
                        <td className="py-2 px-3 font-mono">
                          0x
                          {change.offset.toString(16).toUpperCase().padStart(8, "0")}
                        </td>
                        <td className="py-2 px-3 font-mono bg-red-50">
                          {formatByte(change.oldValue)}
                        </td>
                        <td className="py-2 px-3 font-mono bg-green-50">
                          {formatByte(change.newValue)}
                        </td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">
                          {delta > 0 ? "+" : ""}
                          {delta}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {oldChar} → {newChar}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {changes.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing first 100 changes. Total: {changes.length} byte changes
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
