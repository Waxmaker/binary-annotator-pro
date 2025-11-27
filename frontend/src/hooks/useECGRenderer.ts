import { useEffect, useRef } from "react";
import { EcgSettings } from "@/components/EcgSettings";

// ECG Data structure
interface ECGData {
  samples: number[];
  timestamps?: number[];
  multiLeadData?: {
    leadNames: string[];
    leads: number[][];
  } | null;
}

interface UseECGRendererProps {
  samples: number[];
  settings: EcgSettings;
  width: number;
  height: number;
  selectedIndex?: number;
  zoom?: number;
  offset?: number;
  overlayMode?: boolean;
  showRaw?: boolean;
  showConverted?: boolean;
  rawData?: any;
  convertedData?: any;
}

export function useECGRenderer({
  samples,
  settings,
  width,
  height,
  selectedIndex,
  zoom = 1,
  offset = 0,
  overlayMode = false,
  showRaw = true,
  showConverted = true,
  rawData,
  convertedData,
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

    // Draw waveforms based on overlay mode
    const drawWaveform = (waveSamples: number[], color: string, alpha: number = 1) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = settings.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      if (settings.lineStyle === "smooth") {
        drawSmoothCurve(ctx, points);
      } else if (settings.lineStyle === "step") {
        drawStepCurve(ctx, points);
      } else {
        drawLinearCurve(ctx, points);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // Debug logs
    console.log("Render state:", { 
      overlayMode, 
      showRaw, 
      showConverted, 
      hasRawData: !!rawData, 
      hasConvertedData: !!convertedData,
      rawSamplesLength: rawData?.samples?.length,
      convertedSamplesLength: convertedData?.samples?.length
    });

    if (overlayMode && rawData && convertedData) {
      console.log("Drawing overlay mode");

      // Calculate visible range for both datasets (use the same range for alignment)
      const maxLength = Math.max(rawData.samples?.length || 0, convertedData.samples?.length || 0);
      const samplesPerView = Math.max(10, Math.floor(maxLength / zoom));
      const startIdx = Math.min(offset, Math.max(0, maxLength - samplesPerView));
      const endIdx = Math.min(startIdx + samplesPerView, maxLength);

      // Collect all visible samples from both datasets for unified scaling
      let allVisibleSamples: number[] = [];
      if (showRaw && rawData.samples && rawData.samples.length > 0) {
        const rawVis = rawData.samples.slice(startIdx, Math.min(endIdx, rawData.samples.length));
        allVisibleSamples = allVisibleSamples.concat(rawVis);
      }
      if (showConverted && convertedData.samples && convertedData.samples.length > 0) {
        const convVis = convertedData.samples.slice(startIdx, Math.min(endIdx, convertedData.samples.length));
        allVisibleSamples = allVisibleSamples.concat(convVis);
      }

      // Calculate unified scale parameters (so both curves use the same scale)
      let globalMin = Math.min(...allVisibleSamples);
      let globalMax = Math.max(...allVisibleSamples);
      let globalRange = globalMax - globalMin || 1;
      let globalAbsMax = Math.max(...allVisibleSamples.map(Math.abs));

      console.log("Unified scaling:", { globalMin, globalMax, globalRange, globalAbsMax });

      // Draw raw data (red) if enabled
      if (showRaw && rawData.samples && rawData.samples.length > 0) {
        try {
          console.log("Drawing raw data, samples:", rawData.samples.length);

          const rawVisibleSamples = rawData.samples.slice(startIdx, Math.min(endIdx, rawData.samples.length));
          let rawProcessed = [...rawVisibleSamples];

          // Use UNIFIED scaling instead of independent scaling
          if (settings.normalize) {
            rawProcessed = rawVisibleSamples.map((s) => ((s - globalMin) / globalRange) * 2 - 1);
          }

          if (settings.autoScale && !settings.normalize) {
            if (globalAbsMax > 0) {
              rawProcessed = rawProcessed.map((s) => s / globalAbsMax);
            }
          }

          const rawSpacing = (width - 40) / (rawProcessed.length - 1 || 1);
          const rawPoints = rawProcessed.map((val, idx) => ({
            x: 20 + idx * rawSpacing,
            y: centerY - val * settings.verticalScale * 50,
          }));

          ctx.strokeStyle = "#ff4444";
          ctx.lineWidth = settings.lineWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.globalAlpha = 0.7;

          ctx.beginPath();
          if (settings.lineStyle === "smooth") {
            drawSmoothCurve(ctx, rawPoints);
          } else if (settings.lineStyle === "step") {
            drawStepCurve(ctx, rawPoints);
          } else {
            drawLinearCurve(ctx, rawPoints);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          console.log("Raw data drawn successfully");
        } catch (error) {
          console.error("Error drawing raw data:", error);
        }
      }

      // Draw converted data (blue) if enabled
      if (showConverted && convertedData.samples && convertedData.samples.length > 0) {
        try {
          console.log("Drawing converted data, samples:", convertedData.samples.length);
          console.log("Converted data structure:", convertedData);

          const convertedVisibleSamples = convertedData.samples.slice(startIdx, Math.min(endIdx, convertedData.samples.length));
          let convertedProcessed = [...convertedVisibleSamples];

          // Use UNIFIED scaling instead of independent scaling
          if (settings.normalize) {
            convertedProcessed = convertedVisibleSamples.map((s) => ((s - globalMin) / globalRange) * 2 - 1);
          }

          if (settings.autoScale && !settings.normalize) {
            if (globalAbsMax > 0) {
              convertedProcessed = convertedProcessed.map((s) => s / globalAbsMax);
            }
          }

          const convertedSpacing = (width - 40) / (convertedProcessed.length - 1 || 1);
          const convertedPoints = convertedProcessed.map((val, idx) => ({
            x: 20 + idx * convertedSpacing,
            y: centerY - val * settings.verticalScale * 50,
          }));

          ctx.strokeStyle = "#4444ff";
          ctx.lineWidth = settings.lineWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.globalAlpha = 0.7;

          ctx.beginPath();
          if (settings.lineStyle === "smooth") {
            drawSmoothCurve(ctx, convertedPoints);
          } else if (settings.lineStyle === "step") {
            drawStepCurve(ctx, convertedPoints);
          } else {
            drawLinearCurve(ctx, convertedPoints);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          console.log("Converted data drawn successfully");
        } catch (error) {
          console.error("Error drawing converted data:", error);
        }
      }

      // Draw legend
      ctx.globalAlpha = 1;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      
      let legendY = 10;
      if (showRaw && rawData.samples) {
        ctx.fillStyle = "#ff4444";
        ctx.fillRect(10, legendY, 15, 3);
        ctx.fillStyle = "#333";
        ctx.fillText("Raw", 30, legendY - 2);
        legendY += 20;
      }
      
      if (showConverted && convertedData.samples) {
        ctx.fillStyle = "#4444ff";
        ctx.fillRect(10, legendY, 15, 3);
        ctx.fillStyle = "#333";
        ctx.fillText("Converted (µV)", 30, legendY - 2);
      }

    } else {
      // Single waveform mode
      drawWaveform(processedSamples, settings.derivativeHighlight ? "#ff0000" : "#e74c3c");
    }

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
  }, [samples, settings, width, height, selectedIndex, zoom, offset, overlayMode, showRaw, showConverted, rawData, convertedData]);

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
