import { useEffect, useRef, useMemo } from "react";
import { calculatePatternCorrelation } from "@/utils/binaryDiff";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface PatternCorrelationProps {
  buffer1: ArrayBuffer | null;
  buffer2: ArrayBuffer | null;
  fileName1?: string;
  fileName2?: string;
}

export function PatternCorrelation({
  buffer1,
  buffer2,
  fileName1 = "File 1",
  fileName2 = "File 2",
}: PatternCorrelationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [windowSize, setWindowSize] = useState(256);

  const correlationData = useMemo(() => {
    if (!buffer1 || !buffer2) return null;
    return calculatePatternCorrelation(buffer1, buffer2, windowSize);
  }, [buffer1, buffer2, windowSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !correlationData || correlationData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;

    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - 2 * padding) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = "#666";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      const percent = 100 - i * 25;
      ctx.fillText(`${percent}%`, padding - 5, y + 3);
    }

    // Draw correlation line
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const xStep = (width - 2 * padding) / (correlationData.length - 1 || 1);

    correlationData.forEach((correlation, i) => {
      const x = padding + i * xStep;
      const y = padding + ((height - 2 * padding) * (100 - correlation)) / 100;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill area under curve
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = "rgba(52, 152, 219, 0.1)";
    ctx.fill();

    // Draw threshold line at 50%
    const thresholdY = padding + (height - 2 * padding) / 2;
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, thresholdY);
    ctx.lineTo(width - padding, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#e74c3c";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("50% threshold", padding + 5, thresholdY - 5);

    // Draw axes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw title
    ctx.fillStyle = "#333";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Pattern Correlation", 5, 15);

    // Calculate average correlation
    const avgCorrelation =
      correlationData.reduce((a, b) => a + b, 0) / correlationData.length;
    ctx.fillStyle = "#666";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Avg: ${avgCorrelation.toFixed(1)}%`, width - 5, 15);

    // Find regions below 50% correlation (different patterns)
    const differentRegions = correlationData.filter((c) => c < 50).length;
    ctx.fillText(
      `Different regions: ${differentRegions}/${correlationData.length}`,
      width - 5,
      30,
    );
  }, [correlationData]);

  if (!buffer1 || !buffer2) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select two files to compare
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Pattern Correlation Analysis</h3>
        <p className="text-xs text-muted-foreground">
          Shows how similar byte patterns are across both files using sliding windows
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Window Size: {windowSize} bytes</Label>
        <Slider
          value={[windowSize]}
          onValueChange={([v]) => setWindowSize(v)}
          min={64}
          max={1024}
          step={64}
        />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <canvas ref={canvasRef} width={800} height={300} className="w-full" />
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <strong>X-axis:</strong> Position in file (sliding windows)
        </p>
        <p>
          <strong>Y-axis:</strong> Correlation percentage (0-100%)
        </p>
        <p>
          <strong>Interpretation:</strong>
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            <strong>100%</strong> = Perfect match (identical patterns)
          </li>
          <li>
            <strong>75-99%</strong> = High similarity (minor variations)
          </li>
          <li>
            <strong>50-75%</strong> = Moderate similarity (some differences)
          </li>
          <li>
            <strong>&lt;50%</strong> = Low similarity (major differences)
          </li>
        </ul>
      </div>
    </div>
  );
}
