import { useEffect, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateDigrams, getTopDigrams, byteToHex } from "@/utils/binaryAnalysis";

interface DigramAnalysisProps {
  buffer: ArrayBuffer | null;
}

export function DigramAnalysis({ buffer }: DigramAnalysisProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { digrams, topDigrams } = useMemo(() => {
    if (!buffer) return { digrams: null, topDigrams: [] };
    const d = calculateDigrams(buffer);
    const top = getTopDigrams(d, 20);
    return { digrams: d, topDigrams: top };
  }, [buffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !digrams) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 256;
    canvas.width = size;
    canvas.height = size;

    // Find max value for scaling
    let maxCount = 0;
    for (let i = 0; i < 256; i++) {
      for (let j = 0; j < 256; j++) {
        if (digrams[i][j] > maxCount) {
          maxCount = digrams[i][j];
        }
      }
    }

    if (maxCount === 0) return;

    // Draw heatmap
    for (let i = 0; i < 256; i++) {
      for (let j = 0; j < 256; j++) {
        const count = digrams[i][j];
        const intensity = Math.sqrt(count / maxCount); // Square root for better visualization

        // Color from blue (low) to red (high)
        let r, g, b;
        if (intensity < 0.5) {
          r = 0;
          g = Math.floor(intensity * 2 * 255);
          b = 255;
        } else {
          r = Math.floor((intensity - 0.5) * 2 * 255);
          g = 255 - Math.floor((intensity - 0.5) * 2 * 255);
          b = 0;
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(j, i, 1, 1);
      }
    }
  }, [digrams]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No file loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <h3 className="text-sm font-semibold">Digram Analysis (Byte Pairs)</h3>

      <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
        {/* Heatmap */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            256x256 Heatmap
          </h4>
          <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg p-2">
            <canvas
              ref={canvasRef}
              className="border border-gray-300"
              style={{ imageRendering: "pixelated", maxWidth: "100%", maxHeight: "100%" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            X-axis: Second byte • Y-axis: First byte
          </p>
        </div>

        {/* Top digrams list */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            Top 20 Most Frequent Pairs
          </h4>
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-2">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-left">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Pair</th>
                    <th className="py-2 px-2">ASCII</th>
                    <th className="py-2 px-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topDigrams.map((digram, index) => {
                    const firstChar =
                      digram.first >= 32 && digram.first <= 126
                        ? String.fromCharCode(digram.first)
                        : "·";
                    const secondChar =
                      digram.second >= 32 && digram.second <= 126
                        ? String.fromCharCode(digram.second)
                        : "·";

                    return (
                      <tr key={index} className="border-b hover:bg-accent/50">
                        <td className="py-1 px-2 text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="py-1 px-2 font-mono">
                          {byteToHex(digram.first)} {byteToHex(digram.second)}
                        </td>
                        <td className="py-1 px-2 font-mono text-primary">
                          {firstChar}
                          {secondChar}
                        </td>
                        <td className="py-1 px-2 text-right font-semibold">
                          {digram.count.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            High frequency pairs may indicate compression patterns or repeated structures
          </p>
        </div>
      </div>
    </div>
  );
}
