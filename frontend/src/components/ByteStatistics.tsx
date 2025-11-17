import { useMemo } from "react";
import { calculateByteStatistics } from "@/utils/byteStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ByteStatisticsProps {
  buffer: ArrayBuffer | null;
}

export const ByteStatistics = ({ buffer }: ByteStatisticsProps) => {
  const stats = useMemo(() => calculateByteStatistics(buffer), [buffer]);

  if (!stats) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No file loaded
      </div>
    );
  }

  const formatByte = (value: number) => `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
  const formatPercent = (value: number, total: number) =>
    `${((value / total) * 100).toFixed(1)}%`;

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Byte Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Min Value</div>
              <div className="font-mono font-semibold">{formatByte(stats.min)} ({stats.min})</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Max Value</div>
              <div className="font-mono font-semibold">{formatByte(stats.max)} ({stats.max})</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Average</div>
              <div className="font-mono font-semibold">{stats.average.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Median</div>
              <div className="font-mono font-semibold">{stats.median.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Mode</div>
              <div className="font-mono font-semibold">{formatByte(stats.mode)} ({stats.mode})</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Entropy</div>
              <div className="font-mono font-semibold">{stats.entropy.toFixed(3)} bits</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Byte Composition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Bytes</span>
            <span className="font-mono font-semibold">{stats.totalBytes.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unique Bytes</span>
            <span className="font-mono font-semibold">
              {stats.uniqueBytes} / 256 ({formatPercent(stats.uniqueBytes, 256)})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Null Bytes (0x00)</span>
            <span className="font-mono font-semibold">
              {stats.nullBytes.toLocaleString()} ({formatPercent(stats.nullBytes, stats.totalBytes)})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Printable ASCII</span>
            <span className="font-mono font-semibold">
              {stats.printableBytes.toLocaleString()} ({formatPercent(stats.printableBytes, stats.totalBytes)})
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
