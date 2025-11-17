import { useEffect, useRef, useMemo } from "react";
import { calculateByteHistogram } from "@/utils/binaryAnalysis";

interface ByteHistogramProps {
  buffer: ArrayBuffer | null;
}

export function ByteHistogram({ buffer }: ByteHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Find max value for scaling
    const maxCount = Math.max(...histogram);
    if (maxCount === 0) return;

    // Draw bars
    const barWidth = width / 256;

    for (let i = 0; i < 256; i++) {
      const barHeight = (histogram[i] / maxCount) * (height - 40);
      const x = i * barWidth;
      const y = height - barHeight - 20;

      // Color gradient based on byte value
      const hue = (i / 256) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Draw axes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = "#666";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";

    for (let i = 0; i < 256; i += 32) {
      const x = i * barWidth;
      ctx.fillText(`${i.toString(16).toUpperCase()}`, x, height - 5);
    }

    // Draw max count label
    ctx.textAlign = "left";
    ctx.fillText(`Max: ${maxCount}`, 5, 15);
  }, [histogram]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No file loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h3 className="text-sm font-semibold mb-2">Byte Frequency Distribution</h3>
      <canvas ref={canvasRef} width={800} height={200} className="w-full h-full" />
      <p className="text-xs text-muted-foreground mt-2">
        X-axis: Byte values (0x00 - 0xFF) • Y-axis: Frequency
      </p>
    </div>
  );
}
