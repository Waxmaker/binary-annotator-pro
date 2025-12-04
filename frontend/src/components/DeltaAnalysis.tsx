import { useMemo, useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  calculateDiffStats,
  findByteChanges,
  findChangedRegions,
  formatByte,
} from "@/utils/binaryDiff";
import { analyzeDelta } from "@/services/comparisonApi";
import { toast } from "sonner";

interface DeltaAnalysisProps {
  buffer1: ArrayBuffer | null;
  buffer2: ArrayBuffer | null;
  fileName1?: string;
  fileName2?: string;
  fileSize1?: number;
  fileSize2?: number;
  file1Id?: number;
  file2Id?: number;
}

export function DeltaAnalysis({
  buffer1,
  buffer2,
  fileName1 = "File 1",
  fileName2 = "File 2",
  fileSize1,
  fileSize2,
  file1Id,
  file2Id,
}: DeltaAnalysisProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const useApi = !buffer1 || !buffer2;

  // Load from API for large files
  useEffect(() => {
    if (!useApi || !file1Id || !file2Id) {
      setApiData(null);
      return;
    }

    const loadDelta = async () => {
      setIsLoadingApi(true);
      try {
        const response = await analyzeDelta(file1Id, file2Id, 4, 1000);
        // Convert API response to local format
        const stats = {
          totalBytes: response.stats.total_bytes,
          equalBytes: response.stats.unchanged_bytes,
          modifiedBytes: response.stats.changed_bytes,
          similarity: 100 - response.stats.percent_changed,
          file1Size: response.stats.file1_size,
          file2Size: response.stats.file2_size,
        };
        // Changes and regions come directly from API (no base64 encoding for these)
        setApiData({ stats, changes: response.changes, regions: response.regions });
      } catch (err: any) {
        console.error("Failed to analyze delta:", err);
        toast.error(`Failed to analyze delta: ${err.message}`);
        setApiData({ stats: null, changes: [], regions: [] });
      } finally {
        setIsLoadingApi(false);
      }
    };

    loadDelta();
  }, [useApi, file1Id, file2Id]);

  const localData = useMemo(() => {
    if (useApi || !buffer1 || !buffer2) {
      return { stats: null, changes: [], regions: [] };
    }
    return {
      stats: calculateDiffStats(buffer1, buffer2),
      changes: findByteChanges(buffer1, buffer2),
      regions: findChangedRegions(buffer1, buffer2, 4),
    };
  }, [buffer1, buffer2, useApi]);

  const { stats, changes, regions } = useApi ? (apiData || { stats: null, changes: [], regions: [] }) : localData;

  if (isLoadingApi) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-sm font-medium">Analyzing delta...</p>
        </div>
      </div>
    );
  }

  if (!useApi && (!buffer1 || !buffer2)) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select two files to compare
      </div>
    );
  }

  if (useApi && (!file1Id || !file2Id)) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        File IDs required for large file comparison
      </div>
    );
  }

  const renderContent = () => (
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
  );

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-panel-border bg-panel-header">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Delta Analysis</h3>
            {!zoomOpen && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setZoomOpen(true)}
                      className="ml-2"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Expand view</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {renderContent()}
        </ScrollArea>
      </div>

      {/* Zoom Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Delta Analysis</DialogTitle>
            <DialogDescription className="text-xs">
              Expanded view - {fileName1} vs {fileName2}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            {renderContent()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
