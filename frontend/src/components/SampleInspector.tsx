import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { SampleStats } from "@/hooks/useSamples";
import { EcgSettings } from "./EcgSettings";

interface SampleInspectorProps {
  samples: number[];
  timestamps?: number[];
  stats: SampleStats | null;
  settings: EcgSettings;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  overlayMode?: boolean;
  rawData?: any;
  convertedData?: any;
}

export function SampleInspector({
  samples,
  timestamps = [],
  stats,
  settings,
  selectedIndex,
  onSelectIndex,
  overlayMode = false,
  rawData,
  convertedData,
}: SampleInspectorProps) {
  // Calculate actual duration from timestamps if available
  const hasTimestamps = timestamps.length > 0;
  const estimatedDuration = hasTimestamps && timestamps.length > 0
    ? (timestamps[timestamps.length - 1] - timestamps[0]).toFixed(2)
    : stats
    ? (stats.count / settings.horizontalScale).toFixed(2)
    : "0";

  // Calculate stats for converted data if available
  const convertedStats = convertedData?.samples ? {
    count: convertedData.samples.length,
    min: Math.min(...convertedData.samples),
    max: Math.max(...convertedData.samples),
    mean: convertedData.samples.reduce((a: number, b: number) => a + b, 0) / convertedData.samples.length,
  } : null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">
          Sample Inspector
        </h2>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Overlay Mode Indicator */}
        {overlayMode && (
          <div className="p-3 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs font-medium text-blue-800">Overlay Mode Active</span>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">Overview</h3>
            {overlayMode && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Raw</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Converted</span>
                </div>
              </div>
            )}
          </div>
          {stats ? (
            <div className="grid grid-cols-2 gap-2">
              <Card className="bg-accent/10">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Min Value</div>
                  <div className="text-lg font-semibold">{stats.min}</div>
                </CardContent>
              </Card>
              <Card className="bg-accent/10">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Max Value</div>
                  <div className="text-lg font-semibold">{stats.max}</div>
                </CardContent>
              </Card>
              <Card className="bg-accent/10">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Mean</div>
                  <div className="text-lg font-semibold">
                    {stats.mean.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-accent/10">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">RMS</div>
                  <div className="text-lg font-semibold">
                    {stats.rms.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-accent/10">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Sample Count</div>
                  <div className="text-lg font-semibold">{stats.count}</div>
                </CardContent>
              </Card>
              <Card className="bg-accent/10">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Duration (s)</div>
                  <div className="text-lg font-semibold">{estimatedDuration}</div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">
              No samples loaded
            </div>
          )}

        {/* Converted Data Stats (Overlay Mode) */}
        {overlayMode && convertedStats && (
          <div className="p-4 border-t border-panel-border">
            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Converted Data (µV)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600">Min Value</div>
                  <div className="text-lg font-semibold text-blue-800">
                    {convertedStats.min.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600">Max Value</div>
                  <div className="text-lg font-semibold text-blue-800">
                    {convertedStats.max.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600">Mean</div>
                  <div className="text-lg font-semibold text-blue-800">
                    {convertedStats.mean.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600">Sample Count</div>
                  <div className="text-lg font-semibold text-blue-800">
                    {convertedStats.count}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        </div>

        {/* Sample Explorer */}
        <div className="flex-1 border-t border-panel-border flex flex-col overflow-hidden">
          <div className="p-4 pb-2">
            <h3 className="text-xs font-semibold text-foreground">
              Sample Explorer
            </h3>
          </div>
          <ScrollArea className="flex-1">
            {samples.length > 0 ? (
              <div className="px-4 pb-4">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 px-2">Index</th>
                      <th className="py-2 px-2">Value</th>
                      <th className="py-2 px-2">Time (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((value, index) => {
                      // Use real timestamp if available, otherwise calculate from index
                      const timeDisplay = hasTimestamps && timestamps[index] !== undefined
                        ? (timestamps[index] * 1000).toFixed(1)
                        : ((index / settings.horizontalScale) * 1000).toFixed(1);
                      const isSelected = selectedIndex === index;
                      return (
                        <tr
                          key={index}
                          className={`border-b border-border hover:bg-accent/50 cursor-pointer transition-colors ${
                            isSelected ? "bg-accent" : ""
                          }`}
                          onClick={() => onSelectIndex?.(index)}
                        >
                          <td className="py-2 px-2 font-mono">{index}</td>
                          <td className="py-2 px-2 font-mono font-semibold">
                            {value}
                          </td>
                          <td className="py-2 px-2 font-mono text-muted-foreground">
                            {timeDisplay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8">
                Load samples to view data
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
