import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface BitmapViewProps {
  buffer: ArrayBuffer | null;
}

export function BitmapView({ buffer }: BitmapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(256);
  const [zoom, setZoom] = useState(1);

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
      imageData.data[pixelIndex] = value; // R
      imageData.data[pixelIndex + 1] = value; // G
      imageData.data[pixelIndex + 2] = value; // B
      imageData.data[pixelIndex + 3] = 255; // A
    }

    ctx.putImageData(imageData, 0, 0);
  }, [buffer, width]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No file loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">2D Bitmap Visualization</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Width:</Label>
            <span className="text-xs font-mono w-12">{width}px</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Bitmap Width</Label>
        <Slider
          value={[width]}
          onValueChange={([v]) => setWidth(v)}
          min={16}
          max={512}
          step={16}
        />
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 border rounded-lg p-2">
        <canvas
          ref={canvasRef}
          className="border border-gray-300"
          style={{
            imageRendering: "pixelated",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Zoom</Label>
        <Slider
          value={[zoom]}
          onValueChange={([v]) => setZoom(v)}
          min={1}
          max={8}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          {zoom}x magnification
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Each byte is rendered as a grayscale pixel. Patterns and structures become
        visible.
      </p>
    </div>
  );
}
