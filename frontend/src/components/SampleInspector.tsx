import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { SampleStats } from "@/hooks/useSamples";
import { EcgSettings } from "./EcgSettings";

interface SampleInspectorProps {
  samples: number[];
  stats: SampleStats | null;
  settings: EcgSettings;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
}

export function SampleInspector({
  samples,
  stats,
  settings,
  selectedIndex,
  onSelectIndex,
}: SampleInspectorProps) {
  // Estimate duration based on horizontal scale (samples per second)
  const estimatedDuration = stats
    ? (stats.count / settings.horizontalScale).toFixed(2)
    : "0";

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">
          Sample Inspector
        </h2>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats Overview */}
        <div className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-foreground">Overview</h3>
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
                      const timeMs = (
                        (index / settings.horizontalScale) *
                        1000
                      ).toFixed(1);
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
                            {timeMs}
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
