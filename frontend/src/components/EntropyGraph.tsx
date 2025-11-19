import { useEffect, useRef, useMemo } from "react";
import { calculateEntropyGraph } from "@/utils/binaryAnalysis";
import { useTheme } from "@/hooks/useTheme";

interface EntropyGraphProps {
  buffer: ArrayBuffer | null;
  windowSize?: number;
}

export function EntropyGraph({ buffer, windowSize = 256 }: EntropyGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme, systemTheme } = useTheme();

  const entropyData = useMemo(() => {
    if (!buffer) return null;
    return calculateEntropyGraph(buffer, windowSize);
  }, [buffer, windowSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !entropyData || entropyData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;

    // Determine if we're in dark mode
    const effectiveTheme = theme === "system" ? systemTheme : theme;
    const isDark = effectiveTheme === "dark";

    // Colors based on theme
    const bgColor = isDark ? "#0a0a0a" : "#ffffff";
    const gridColor = isDark ? "#27272a" : "#f4f4f5";
    const textColor = isDark ? "#a1a1aa" : "#52525b";
    const axisColor = isDark ? "#52525b" : "#27272a";
    const lineColor = isDark ? "#ef4444" : "#dc2626";
    const fillColor = isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(220, 38, 38, 0.1)";

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 8; i++) {
      const y = padding + ((height - 2 * padding) * (8 - i)) / 8;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = textColor;
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(i.toString(), padding - 8, y + 4);
    }

    // Vertical grid lines
    const gridSteps = 10;
    for (let i = 0; i <= gridSteps; i++) {
      const x = padding + ((width - 2 * padding) * i) / gridSteps;
      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw entropy line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const xStep = (width - 2 * padding) / (entropyData.length - 1 || 1);

    entropyData.forEach((entropy, i) => {
      const x = padding + i * xStep;
      const y = padding + ((height - 2 * padding) * (8 - entropy)) / 8;

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
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Calculate statistics
    const avgEntropy =
      entropyData.reduce((a, b) => a + b, 0) / entropyData.length;
    const maxEntropy = Math.max(...entropyData);
    const minEntropy = Math.min(...entropyData);

    // Draw title and stats
    ctx.fillStyle = textColor;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Entropy (bits)", 8, 15);

    ctx.textAlign = "right";
    ctx.fillText(`Avg: ${avgEntropy.toFixed(2)}`, width - 8, 15);
    ctx.fillText(`Max: ${maxEntropy.toFixed(2)}`, width - 8, 28);
    ctx.fillText(`Min: ${minEntropy.toFixed(2)}`, width - 8, 41);

    // Draw axis labels
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Position in file →", width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Entropy (0-8 bits) →", 0, 0);
    ctx.restore();
  }, [entropyData, theme, systemTheme]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No file loaded
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-muted/20 rounded-lg p-4 border">
        <canvas ref={canvasRef} width={900} height={350} className="w-full h-auto" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="font-semibold text-green-600 dark:text-green-400 mb-2">
            🟢 Low Entropy (0-3)
          </p>
          <p className="text-muted-foreground">
            Highly structured data: headers, ASCII text, repeated patterns, null bytes
          </p>
        </div>

        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
            🟡 Medium Entropy (3-6)
          </p>
          <p className="text-muted-foreground">
            Mixed data: structured but varied content, some compression
          </p>
        </div>

        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="font-semibold text-red-600 dark:text-red-400 mb-2">
            🔴 High Entropy (6-8)
          </p>
          <p className="text-muted-foreground">
            Random-looking data: encrypted, compressed, or truly random
          </p>
        </div>
      </div>

      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs">
        <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">
          💡 Analysis Tips
        </p>
        <p className="text-muted-foreground">
          Sudden entropy changes often indicate section boundaries (uncompressed → compressed, plaintext → encrypted).
          Window size: {windowSize} bytes - larger windows smooth out noise, smaller windows show finer details.
        </p>
      </div>
    </div>
  );
}
