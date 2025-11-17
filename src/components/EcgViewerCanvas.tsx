import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useECGRenderer } from "@/hooks/useECGRenderer";
import { EcgSettings } from "./EcgSettings";

interface EcgViewerCanvasProps {
  samples: number[];
  settings: EcgSettings;
  selectedIndex?: number;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  offset?: number;
  onOffsetChange?: (offset: number) => void;
}

export function EcgViewerCanvas({
  samples,
  settings,
  selectedIndex,
  zoom = 1,
  onZoomChange,
  offset = 0,
  onOffsetChange,
}: EcgViewerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const canvasRef = useECGRenderer({
    samples,
    settings,
    width: dimensions.width,
    height: dimensions.height,
    selectedIndex,
    zoom,
    offset,
  });

  const handleZoomIn = () => {
    if (onZoomChange) {
      onZoomChange(Math.min(zoom + 0.2, 5));
    }
  };

  const handleZoomOut = () => {
    if (onZoomChange) {
      onZoomChange(Math.max(zoom - 0.2, 0.2));
    }
  };

  const handleMoveLeft = () => {
    if (onOffsetChange) {
      onOffsetChange(Math.max(offset - 50, 0));
    }
  };

  const handleMoveRight = () => {
    if (onOffsetChange && samples.length > 0) {
      const maxOffset = Math.max(0, samples.length - 100);
      onOffsetChange(Math.min(offset + 50, maxOffset));
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ECG Waveform</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleMoveLeft}
            disabled={offset === 0}
            title="Move left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleMoveRight}
            disabled={samples.length === 0}
            title="Move right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleZoomOut}
            disabled={zoom <= 0.2}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-xs text-muted-foreground min-w-[3rem] text-right">
            {zoom.toFixed(1)}x
          </span>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={containerRef} className="flex-1 overflow-hidden bg-white">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        {/* Timeline Legend */}
        {samples.length > 0 && (
          <div className="h-12 border-t border-panel-border bg-panel-header px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Sample Count: {samples.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <span>
                    Duration: {((samples.length / settings.horizontalScale) * 1000).toFixed(0)}ms
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-primary" />
                  <span>Zoom: {zoom.toFixed(1)}x</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  Viewing: {Math.floor(offset)} - {Math.min(Math.floor(offset + samples.length / zoom), samples.length)}
                </span>
                <span className="text-muted-foreground/50">|</span>
                <span className="font-mono">
                  {((offset / settings.horizontalScale) * 1000).toFixed(0)}ms -
                  {((Math.min(offset + samples.length / zoom, samples.length) / settings.horizontalScale) * 1000).toFixed(0)}ms
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
