import { useEffect, useRef, useMemo, useState } from "react";
import { calculateByteHistogram } from "@/utils/binaryAnalysis";
import { useTheme } from "@/hooks/useTheme";

interface ByteHistogramProps {
  buffer: ArrayBuffer | null;
}

interface CursorInfo {
  x: number;
  byteValue: number;
  frequency: number;
}

export function ByteHistogram({ buffer }: ByteHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme, systemTheme } = useTheme();
  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);

  const histogram = useMemo(() => {
    if (!buffer) return null;
    return calculateByteHistogram(buffer);
  }, [buffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !histogram) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Determine if we're in dark mode
    const effectiveTheme = theme === "system" ? systemTheme : theme;
    const isDark = effectiveTheme === "dark";

    // Colors based on theme
    const bgColor = isDark ? "#0a0a0a" : "#ffffff";
    const gridColor = isDark ? "#27272a" : "#f4f4f5";
    const textColor = isDark ? "#a1a1aa" : "#52525b";
    const axisColor = isDark ? "#52525b" : "#27272a";

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Find max value for scaling
    const maxCount = Math.max(...histogram);
    if (maxCount === 0) return;

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = height - 40 - ((height - 60) * i) / 5;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    // Draw bars
    const barWidth = (width - 60) / 256;

    for (let i = 0; i < 256; i++) {
      const barHeight = (histogram[i] / maxCount) * (height - 60);
      const x = 40 + i * barWidth;
      const y = height - barHeight - 40;

      // Color gradient based on byte value
      const hue = (i / 256) * 280;
      const lightness = isDark ? 55 : 50;
      ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
      ctx.fillRect(x, y, Math.max(barWidth, 1), barHeight);
    }

    // Draw axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, height - 40);
    ctx.lineTo(width - 20, height - 40);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = textColor;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";

    // X-axis labels (byte values)
    for (let i = 0; i <= 255; i += 32) {
      const x = 40 + i * barWidth;
      ctx.fillText(`0x${i.toString(16).toUpperCase().padStart(2, '0')}`, x, height - 22);
    }

    // Y-axis labels (frequency)
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const y = height - 40 - ((height - 60) * i) / 5;
      const value = Math.round((maxCount * i) / 5);
      ctx.fillText(value.toLocaleString(), 35, y + 4);
    }

    // Title and info
    ctx.fillStyle = textColor;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Frequency", 5, 15);

    ctx.textAlign = "right";
    ctx.fillText(`Total bytes: ${histogram.reduce((a, b) => a + b, 0).toLocaleString()}`, width - 5, 15);

    // Draw legend
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = textColor;
    ctx.fillText("Byte Value →", width / 2, height - 5);

    // Draw cursor info if present
    if (cursorInfo) {
      ctx.save();

      // Draw vertical line at cursor
      const cursorColor = isDark ? "#fbbf24" : "#f59e0b";
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cursorInfo.x, 20);
      ctx.lineTo(cursorInfo.x, height - 40);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw cursor info box
      const infoText = `0x${cursorInfo.byteValue.toString(16).toUpperCase().padStart(2, '0')} (${cursorInfo.byteValue}) : ${cursorInfo.frequency.toLocaleString()}`;
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      const textWidth = ctx.measureText(infoText).width;
      const boxX = Math.min(cursorInfo.x + 10, width - textWidth - 25);
      const boxY = 35;

      ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.95)";
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 1;
      ctx.fillRect(boxX - 5, boxY - 15, textWidth + 10, 20);
      ctx.strokeRect(boxX - 5, boxY - 15, textWidth + 10, 20);

      ctx.fillStyle = cursorColor;
      ctx.fillText(infoText, boxX, boxY);

      ctx.restore();
    }
  }, [histogram, theme, systemTheme, cursorInfo]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !histogram) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;

    const padding = 40;
    const width = canvas.width;
    const barWidth = (width - 60) / 256;

    // Check if within graph bounds
    if (x < padding || x > width - 20) {
      setCursorInfo(null);
      return;
    }

    // Calculate byte value from x position
    const byteValue = Math.floor((x - padding) / barWidth);

    if (byteValue >= 0 && byteValue < 256) {
      const frequency = histogram[byteValue];
      setCursorInfo({ x, byteValue, frequency });
    }
  };

  const handleMouseLeave = () => {
    setCursorInfo(null);
  };

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
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full h-auto cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">
            📊 Interpretation Tips
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• <strong>Uniform distribution</strong>: Compressed or encrypted data</li>
            <li>• <strong>Peaks at 0x20-0x7E</strong>: ASCII text (printable characters)</li>
            <li>• <strong>Spike at 0x00</strong>: Null padding or uninitialized data</li>
          </ul>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">
            💡 What to Look For
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• <strong>Missing bytes</strong>: Some values never appear</li>
            <li>• <strong>Dominant bytes</strong>: Repeated patterns or fill bytes</li>
            <li>• <strong>Clusters</strong>: Specific encoding or protocol</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
