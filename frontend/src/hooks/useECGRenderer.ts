import { useEffect, useRef } from "react";
import { EcgSettings } from "@/components/EcgSettings";

interface UseECGRendererProps {
  samples: number[];
  settings: EcgSettings;
  width: number;
  height: number;
  selectedIndex?: number;
  zoom?: number;
  offset?: number;
}

export function useECGRenderer({
  samples,
  settings,
  width,
  height,
  selectedIndex,
  zoom = 1,
  offset = 0,
}: UseECGRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (settings.showGrid) {
      drawGrid(ctx, width, height, settings.gridDensity);
    }

    // No samples to render
    if (samples.length === 0) {
      ctx.fillStyle = "#888";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Paste ECG samples on the left to begin.", width / 2, height / 2);
      return;
    }

    // Apply zoom and offset to determine visible range
    const samplesPerView = Math.max(10, Math.floor(samples.length / zoom));
    const startIdx = Math.min(offset, Math.max(0, samples.length - samplesPerView));
    const endIdx = Math.min(startIdx + samplesPerView, samples.length);
    const visibleSamples = samples.slice(startIdx, endIdx);

    // Normalize samples if needed
    let processedSamples = [...visibleSamples];
    if (settings.normalize) {
      const min = Math.min(...visibleSamples);
      const max = Math.max(...visibleSamples);
      const range = max - min || 1;
      processedSamples = visibleSamples.map((s) => ((s - min) / range) * 2 - 1);
    }

    // Auto-scale
    if (settings.autoScale) {
      const max = Math.max(...processedSamples.map(Math.abs));
      if (max > 0) {
        processedSamples = processedSamples.map((s) => s / max);
      }
    }

    // Calculate positions
    const centerY = height / 2 + settings.baselineOffset;
    const spacing = (width - 40) / (processedSamples.length - 1 || 1);

    const points: { x: number; y: number }[] = processedSamples.map((val, i) => ({
      x: 20 + i * spacing,
      y: centerY - val * settings.verticalScale * 50,
    }));

    // Detect R-peaks (simple local maxima detection) in visible range
    const rpeaks: number[] = [];
    if (settings.rpeakDetection && visibleSamples.length > 2) {
      for (let i = 1; i < visibleSamples.length - 1; i++) {
        if (
          visibleSamples[i] > visibleSamples[i - 1] &&
          visibleSamples[i] > visibleSamples[i + 1] &&
          visibleSamples[i] > 0
        ) {
          rpeaks.push(i);
        }
      }
    }

    // Draw waveform
    ctx.strokeStyle = settings.derivativeHighlight ? "#ff0000" : "#e74c3c";
    ctx.lineWidth = settings.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    if (settings.lineStyle === "smooth") {
      drawSmoothCurve(ctx, points);
    } else if (settings.lineStyle === "step") {
      drawStepCurve(ctx, points);
    } else {
      drawLinearCurve(ctx, points);
    }
    ctx.stroke();

    // Mark R-peaks
    if (settings.rpeakDetection && rpeaks.length > 0) {
      ctx.fillStyle = "#3498db";
      rpeaks.forEach((idx) => {
        ctx.beginPath();
        ctx.arc(points[idx].x, points[idx].y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Highlight selected point (adjust for offset)
    if (selectedIndex !== undefined) {
      const relativeIndex = selectedIndex - startIdx;
      if (relativeIndex >= 0 && relativeIndex < points.length && points[relativeIndex]) {
        ctx.strokeStyle = "#f39c12";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(points[relativeIndex].x, points[relativeIndex].y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [samples, settings, width, height, selectedIndex, zoom, offset]);

  return canvasRef;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  density: number,
) {
  ctx.strokeStyle = "#fdd";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x < width; x += density) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y < height; y += density) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawLinearCurve(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
}

function drawStepCurve(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
  }
}

function drawSmoothCurve(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
) {
  if (points.length < 2) return;

  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
}
