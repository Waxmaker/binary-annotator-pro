import { useEffect, useRef, useMemo } from "react";
import { calculateEntropyGraph } from "@/utils/binaryAnalysis";

interface EntropyGraphProps {
  buffer: ArrayBuffer | null;
  windowSize?: number;
}

export function EntropyGraph({ buffer, windowSize = 256 }: EntropyGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const padding = 40;

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 8; i++) {
      const y = padding + ((height - 2 * padding) * (8 - i)) / 8;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = "#666";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(i.toString(), padding - 5, y + 3);
    }

    // Draw entropy line
    ctx.strokeStyle = "#e74c3c";
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
    ctx.fillStyle = "rgba(231, 76, 60, 0.1)";
    ctx.fill();

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
    ctx.fillText("Entropy (bits)", 5, 15);

    // Calculate average entropy
    const avgEntropy =
      entropyData.reduce((a, b) => a + b, 0) / entropyData.length;
    ctx.fillStyle = "#666";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Avg: ${avgEntropy.toFixed(2)} bits`, width - 5, 15);

    // Draw interpretation guide
    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Low entropy = Structured data", width - padding, height - 5);
    ctx.fillText("High entropy = Random/Compressed", width - padding, height - 18);
  }, [entropyData]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No file loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h3 className="text-sm font-semibold mb-2">
        Entropy Analysis (Window: {windowSize} bytes)
      </h3>
      <canvas ref={canvasRef} width={800} height={200} className="w-full h-full" />
      <p className="text-xs text-muted-foreground mt-2">
        X-axis: Position in file • Y-axis: Shannon entropy (0-8 bits)
      </p>
    </div>
  );
}
