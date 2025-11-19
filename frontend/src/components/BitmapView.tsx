import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HighlightRange } from "@/utils/colorUtils";
import { useTheme } from "@/hooks/useTheme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

interface BitmapViewProps {
  buffer: ArrayBuffer | null;
  highlights: HighlightRange[];
}

type ColorMode = "grayscale" | "heatmap" | "rgb" | "entropy";

export function BitmapView({ buffer, highlights }: BitmapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const { theme, systemTheme } = useTheme();

  const [width, setWidth] = useState(256);
  const [zoom, setZoom] = useState(2);
  const [colorMode, setColorMode] = useState<ColorMode>("heatmap");
  const [showHighlights, setShowHighlights] = useState(true);
  const [highlightOpacity, setHighlightOpacity] = useState(40);

  // Draw main bitmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const data = new Uint8Array(buffer);
    const height = Math.ceil(data.length / width);

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Create image data
    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < data.length; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const pixelIndex = (y * width + x) * 4;
      const value = data[i];

      let r, g, b;

      switch (colorMode) {
        case "grayscale":
          r = g = b = value;
          break;

        case "heatmap": {
          // Blue -> Cyan -> Green -> Yellow -> Red heatmap
          const normalized = value / 255;
          if (normalized < 0.25) {
            r = 0;
            g = Math.floor(normalized * 4 * 255);
            b = 255;
          } else if (normalized < 0.5) {
            r = 0;
            g = 255;
            b = Math.floor((0.5 - normalized) * 4 * 255);
          } else if (normalized < 0.75) {
            r = Math.floor((normalized - 0.5) * 4 * 255);
            g = 255;
            b = 0;
          } else {
            r = 255;
            g = Math.floor((1 - normalized) * 4 * 255);
            b = 0;
          }
          break;
        }

        case "rgb": {
          // Interpret as RGB: groups of 3 bytes
          const baseOffset = Math.floor(i / 3) * 3;
          if (baseOffset + 2 < data.length) {
            r = data[baseOffset];
            g = data[baseOffset + 1];
            b = data[baseOffset + 2];
          } else {
            r = g = b = value;
          }
          break;
        }

        case "entropy": {
          // Calculate local entropy (simple version: variation from neighbors)
          let variation = 0;
          const neighbors = [
            i - 1, i + 1,
            i - width, i + width,
          ];
          for (const n of neighbors) {
            if (n >= 0 && n < data.length) {
              variation += Math.abs(value - data[n]);
            }
          }
          variation = Math.min(255, variation / 2);

          // High variation = red, low = blue
          if (variation < 85) {
            r = 0;
            g = Math.floor(variation * 3);
            b = 255;
          } else if (variation < 170) {
            r = Math.floor((variation - 85) * 3);
            g = 255;
            b = Math.floor((170 - variation) * 3);
          } else {
            r = 255;
            g = Math.floor((255 - variation) * 3);
            b = 0;
          }
          break;
        }
      }

      imageData.data[pixelIndex] = r;
      imageData.data[pixelIndex + 1] = g;
      imageData.data[pixelIndex + 2] = b;
      imageData.data[pixelIndex + 3] = 255; // A
    }

    ctx.putImageData(imageData, 0, 0);
  }, [buffer, width, colorMode]);

  // Draw highlight overlay
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!canvas || !mainCanvas || !buffer || !showHighlights) {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match main canvas size
    canvas.width = mainCanvas.width;
    canvas.height = mainCanvas.height;

    // Clear overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw highlights
    const data = new Uint8Array(buffer);

    highlights.forEach((highlight) => {
      const startOffset = highlight.start;
      const endOffset = highlight.end;

      // Parse color (supports hex and named colors)
      let color = highlight.color;

      // Convert hex to rgba
      if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        color = `rgba(${r}, ${g}, ${b}, ${highlightOpacity / 100})`;
      } else {
        // For named colors, add opacity
        color = color.replace(')', `, ${highlightOpacity / 100})`).replace('rgb(', 'rgba(');
      }

      ctx.fillStyle = color;

      // Fill pixels for this highlight range
      for (let offset = startOffset; offset < endOffset && offset < data.length; offset++) {
        const x = offset % width;
        const y = Math.floor(offset / width);
        ctx.fillRect(x, y, 1, 1);
      }

      // Draw border around highlight region
      const startX = startOffset % width;
      const startY = Math.floor(startOffset / width);
      const endX = (endOffset - 1) % width;
      const endY = Math.floor((endOffset - 1) / width);

      ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.8)'); // More opaque border
      ctx.lineWidth = 1 / zoom; // Adjust for zoom

      // Draw rectangle for single-line highlights
      if (startY === endY) {
        ctx.strokeRect(startX - 0.5, startY - 0.5, endX - startX + 1, 1);
      } else {
        // Multi-line: draw top and bottom bounds
        ctx.strokeRect(startX - 0.5, startY - 0.5, width - startX, 1);
        ctx.strokeRect(0, endY - 0.5, endX + 1, 1);
      }
    });
  }, [buffer, width, highlights, showHighlights, highlightOpacity, zoom]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No file loaded
      </div>
    );
  }

  const effectiveTheme = theme === "system" ? systemTheme : theme;
  const isDark = effectiveTheme === "dark";

  return (
    <div className="p-6 space-y-4">
      {/* Controls */}
      <div className="grid grid-cols-2 gap-4">
        {/* Color Mode */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Color Mode</Label>
          <Select value={colorMode} onValueChange={(v) => setColorMode(v as ColorMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grayscale">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-black to-white rounded"></div>
                  Grayscale
                </div>
              </SelectItem>
              <SelectItem value="heatmap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500 rounded"></div>
                  Heatmap
                </div>
              </SelectItem>
              <SelectItem value="rgb">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 rounded"></div>
                  RGB Interpretation
                </div>
              </SelectItem>
              <SelectItem value="entropy">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 rounded"></div>
                  Local Entropy
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {colorMode === "grayscale" && "Classic byte value visualization"}
            {colorMode === "heatmap" && "Low values = blue, high = red"}
            {colorMode === "rgb" && "Bytes interpreted as RGB pixels"}
            {colorMode === "entropy" && "Local variation visualization"}
          </p>
        </div>

        {/* Highlight Toggle */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Tag Overlay</Label>
          <Button
            variant={showHighlights ? "default" : "outline"}
            className="w-full justify-start"
            onClick={() => setShowHighlights(!showHighlights)}
          >
            {showHighlights ? (
              <Eye className="h-4 w-4 mr-2" />
            ) : (
              <EyeOff className="h-4 w-4 mr-2" />
            )}
            {showHighlights ? "Showing Tags" : "Tags Hidden"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {highlights.length} tag(s) available
          </p>
        </div>
      </div>

      {/* Width Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Bitmap Width</Label>
          <span className="text-xs font-mono text-muted-foreground">{width} bytes/row</span>
        </div>
        <Slider
          value={[width]}
          onValueChange={([v]) => setWidth(v)}
          min={16}
          max={512}
          step={16}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Adjust to reveal patterns - powers of 2 (256, 512) often work well
        </p>
      </div>

      {/* Zoom Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Zoom Level</Label>
          <span className="text-xs font-mono text-muted-foreground">{zoom}x</span>
        </div>
        <Slider
          value={[zoom]}
          onValueChange={([v]) => setZoom(v)}
          min={1}
          max={8}
          step={1}
          className="w-full"
        />
      </div>

      {/* Highlight Opacity (only when highlights are shown) */}
      {showHighlights && highlights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Tag Opacity</Label>
            <span className="text-xs font-mono text-muted-foreground">{highlightOpacity}%</span>
          </div>
          <Slider
            value={[highlightOpacity]}
            onValueChange={([v]) => setHighlightOpacity(v)}
            min={10}
            max={80}
            step={5}
            className="w-full"
          />
        </div>
      )}

      {/* Canvas Container */}
      <div className={`overflow-auto rounded-lg border ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-4`}>
        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            className="block"
            style={{
              imageRendering: "pixelated",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              imageRendering: "pixelated",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="font-semibold text-purple-600 dark:text-purple-400 mb-1">
            🎨 Color Modes
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• <strong>Grayscale</strong>: Traditional binary visualization</li>
            <li>• <strong>Heatmap</strong>: Byte values as temperature</li>
            <li>• <strong>RGB</strong>: Interpret as image data</li>
            <li>• <strong>Entropy</strong>: Local randomness indicator</li>
          </ul>
        </div>

        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
          <p className="font-semibold text-cyan-600 dark:text-cyan-400 mb-1">
            🏷️ Tag Overlay
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• <strong>Colored regions</strong>: YAML annotations</li>
            <li>• <strong>Borders</strong>: Tag boundaries</li>
            <li>• <strong>Adjust opacity</strong>: Balance data/tags</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
