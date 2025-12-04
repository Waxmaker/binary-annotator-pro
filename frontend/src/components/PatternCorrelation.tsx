import { useEffect, useRef, useMemo, useState } from "react";
import { calculatePatternCorrelation } from "@/utils/binaryDiff";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Maximize2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";
import { formatAddress } from "@/utils/binaryUtils";
import { calculatePatternCorrelation as apiCalculatePatternCorrelation } from "@/services/comparisonApi";
import { toast } from "sonner";

interface PatternCorrelationProps {
  buffer1: ArrayBuffer | null;
  buffer2: ArrayBuffer | null;
  fileName1?: string;
  fileName2?: string;
  fileSize1?: number;
  fileSize2?: number;
  file1Id?: number;
  file2Id?: number;
}

interface CursorInfo {
  x: number;
  offset: number;
  correlation: number;
}

export function PatternCorrelation({
  buffer1,
  buffer2,
  fileName1 = "File 1",
  fileName2 = "File 2",
  fileSize1,
  fileSize2,
  file1Id,
  file2Id,
}: PatternCorrelationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme, systemTheme } = useTheme();
  const [windowSize, setWindowSize] = useState(256);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);
  const [apiData, setApiData] = useState<Array<{ offset: number; correlation: number }> | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const useApi = !buffer1 || !buffer2;

  // Load from API for large files
  useEffect(() => {
    if (!useApi || !file1Id || !file2Id) {
      setApiData(null);
      return;
    }

    const loadCorrelation = async () => {
      setIsLoadingApi(true);
      try {
        const response = await apiCalculatePatternCorrelation(file1Id, file2Id, windowSize, 5000);
        setApiData(response.correlations);
        if (response.sampled) {
          toast.info(`Showing sampled correlation data`);
        }
      } catch (err: any) {
        console.error("Failed to calculate correlation:", err);
        toast.error(`Failed to calculate correlation: ${err.message}`);
        setApiData([]);
      } finally {
        setIsLoadingApi(false);
      }
    };

    loadCorrelation();
  }, [useApi, file1Id, file2Id, windowSize]);

  const localCorrelationData = useMemo(() => {
    if (useApi || !buffer1 || !buffer2) return null;
    return calculatePatternCorrelation(buffer1, buffer2, windowSize);
  }, [buffer1, buffer2, windowSize, useApi]);

  const correlationData = useApi ? apiData : localCorrelationData;

  if (isLoadingApi) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-sm font-medium">Calculating pattern correlation...</p>
        </div>
      </div>
    );
  }

  if (!useApi && (!buffer1 || !buffer2)) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select two files to compare
      </div>
    );
  }

  if (useApi && (!file1Id || !file2Id)) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        File IDs required for large file comparison
      </div>
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !correlationData || correlationData.length === 0) return;

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
    const lineColor = isDark ? "#60a5fa" : "#3b82f6";
    const fillColor = isDark ? "rgba(96, 165, 250, 0.15)" : "rgba(59, 130, 246, 0.1)";
    const thresholdColor = isDark ? "#f87171" : "#ef4444";

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - 2 * padding) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = textColor;
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      const percent = 100 - i * 25;
      ctx.fillText(`${percent}%`, padding - 8, y + 4);
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

    // Draw correlation line
    ctx.strokeStyle = lineColor;
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
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw threshold line at 50%
    const thresholdY = padding + (height - 2 * padding) / 2;
    ctx.strokeStyle = thresholdColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, thresholdY);
    ctx.lineTo(width - padding, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = thresholdColor;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("50% threshold", padding + 5, thresholdY - 5);

    // Draw axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Calculate average correlation
    const avgCorrelation =
      correlationData.reduce((a, b) => a + b, 0) / correlationData.length;

    // Draw stats
    ctx.fillStyle = textColor;
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Avg: ${avgCorrelation.toFixed(1)}%`, width - 5, 20);

    // Find regions below 50% correlation (different patterns)
    const differentRegions = correlationData.filter((c) => c < 50).length;
    ctx.fillText(
      `Different: ${differentRegions}/${correlationData.length}`,
      width - 5,
      35,
    );

    // Draw cursor info if present
    if (cursorInfo) {
      ctx.save();

      // Draw vertical line at cursor
      ctx.strokeStyle = isDark ? "#fbbf24" : "#f59e0b";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cursorInfo.x, padding);
      ctx.lineTo(cursorInfo.x, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw cursor info box
      const infoText = `Offset: ${formatAddress(cursorInfo.offset)} | ${cursorInfo.correlation.toFixed(1)}%`;
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      const textWidth = ctx.measureText(infoText).width;
      const boxX = Math.min(cursorInfo.x + 10, width - textWidth - 25);
      const boxY = padding + 15;

      ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.95)";
      ctx.strokeStyle = isDark ? "#fbbf24" : "#f59e0b";
      ctx.lineWidth = 1;
      ctx.fillRect(boxX - 5, boxY - 15, textWidth + 10, 20);
      ctx.strokeRect(boxX - 5, boxY - 15, textWidth + 10, 20);

      ctx.fillStyle = isDark ? "#fbbf24" : "#f59e0b";
      ctx.fillText(infoText, boxX, boxY);

      ctx.restore();
    }
  }, [correlationData, theme, systemTheme, cursorInfo]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !correlationData || !buffer1) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;

    const padding = 50;
    const width = canvas.width;

    // Check if within graph bounds
    if (x < padding || x > width - padding) {
      setCursorInfo(null);
      return;
    }

    // Calculate offset from x position
    const xStep = (width - 2 * padding) / (correlationData.length - 1 || 1);
    const dataIndex = Math.round((x - padding) / xStep);

    if (dataIndex >= 0 && dataIndex < correlationData.length) {
      const offset = Math.floor((dataIndex / correlationData.length) * buffer1.byteLength);
      const correlation = correlationData[dataIndex];

      setCursorInfo({ x, offset, correlation });
    }
  };

  const handleMouseLeave = () => {
    setCursorInfo(null);
  };

  const renderContent = () => (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold mb-2">Pattern Correlation Analysis</h3>
          <p className="text-xs text-muted-foreground">
            Shows how similar byte patterns are across both files using sliding windows
          </p>
        </div>
        {!zoomOpen && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setZoomOpen(true)}
                  className="ml-2"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Expand view</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
        <canvas
          ref={canvasRef}
          width={900}
          height={400}
          className="w-full h-auto cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
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

  if (!buffer1 || !buffer2) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select two files to compare
      </div>
    );
  }

  return (
    <>
      {renderContent()}

      {/* Zoom Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Pattern Correlation Analysis</DialogTitle>
            <DialogDescription className="text-xs">
              Expanded view - {fileName1} vs {fileName2}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
