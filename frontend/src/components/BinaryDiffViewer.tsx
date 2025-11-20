import { useMemo, useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowUp, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  compareBinaryBuffers,
  DiffChunk,
  DiffType,
  formatByte,
  getDiffColor,
} from "@/utils/binaryDiff";

interface BinaryDiffViewerProps {
  buffer1: ArrayBuffer | null;
  buffer2: ArrayBuffer | null;
  fileName1?: string;
  fileName2?: string;
  fileSize1?: number;
  fileSize2?: number;
}

const SCROLL_POSITION_KEY = "binaryDiffViewer_scrollPosition";

export function BinaryDiffViewer({
  buffer1,
  buffer2,
  fileName1 = "File 1",
  fileName2 = "File 2",
  fileSize1,
  fileSize2,
}: BinaryDiffViewerProps) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [cursorOffset, setCursorOffset] = useState<number | null>(null);

  const diffChunks = useMemo(() => {
    if (!buffer1 || !buffer2) return [];
    return compareBinaryBuffers(buffer1, buffer2, 16);
  }, [buffer1, buffer2]);

  // Save scroll position to localStorage
  const saveScrollPosition = () => {
    if (!scrollViewportRef.current || isRestoringScroll) return;
    const scrollTop = scrollViewportRef.current.scrollTop;
    localStorage.setItem(SCROLL_POSITION_KEY, scrollTop.toString());
  };

  // Restore scroll position from localStorage
  useEffect(() => {
    if (!scrollViewportRef.current || diffChunks.length === 0) return;

    const savedPosition = localStorage.getItem(SCROLL_POSITION_KEY);
    if (savedPosition) {
      setIsRestoringScroll(true);
      const scrollTop = parseInt(savedPosition, 10);

      // Delay to ensure DOM is ready
      setTimeout(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollTop = scrollTop;
        }
        setIsRestoringScroll(false);
      }, 100);
    }
  }, [diffChunks]);

  // Handle scroll events
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      saveScrollPosition();
      setShowBackToTop(viewport.scrollTop > 300);
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [isRestoringScroll]);

  const handleBackToTop = () => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  if (!buffer1 || !buffer2) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select two files to compare
      </div>
    );
  }

  const renderDiffContent = () => (
    <>
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_1fr] gap-4 mb-2 font-semibold text-xs border-b pb-2">
        <div>Offset</div>
        <div>{fileName1}</div>
        <div>{fileName2}</div>
      </div>

      {/* Diff rows */}
      {diffChunks.map((chunk, index) => (
        <DiffRow
          key={index}
          chunk={chunk}
          onMouseEnter={() => setCursorOffset(chunk.offset)}
          onMouseLeave={() => setCursorOffset(null)}
        />
      ))}
    </>
  );

  return (
    <div className="h-full flex flex-col relative">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Side-by-Side Binary Diff</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setZoomOpen(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open in big view</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <ScrollArea className="flex-1" viewportRef={scrollViewportRef}>
        <div className="p-4">
          {renderDiffContent()}
        </div>
      </ScrollArea>

      {/* Cursor info tooltip */}
      {cursorOffset !== null && (
        <div className="absolute top-20 left-4 bg-background/95 border border-primary/50 rounded-lg shadow-lg px-3 py-2 text-xs font-mono pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Offset:</span>
            <span className="text-primary font-semibold">
              0x{cursorOffset.toString(16).toUpperCase().padStart(8, '0')}
            </span>
          </div>
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <Button
          onClick={handleBackToTop}
          className="fixed bottom-8 right-8 rounded-full w-12 h-12 p-0 shadow-lg z-50"
          size="icon"
          title="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}

      {/* Legend */}
      <div className="p-4 border-t border-panel-border bg-panel-header">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border"
              style={{ backgroundColor: getDiffColor(DiffType.EQUAL) }}
            />
            <span>Equal</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border"
              style={{ backgroundColor: getDiffColor(DiffType.MODIFIED) }}
            />
            <span>Modified</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border"
              style={{ backgroundColor: getDiffColor(DiffType.ADDED) }}
            />
            <span>Added</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border"
              style={{ backgroundColor: getDiffColor(DiffType.REMOVED) }}
            />
            <span>Removed</span>
          </div>
        </div>
      </div>

      {/* Zoom Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Side-by-Side Binary Diff</DialogTitle>
            <DialogDescription>
              Comparing {fileName1} and {fileName2}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6">
              {renderDiffContent()}
            </div>
          </ScrollArea>
          <div className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 border"
                  style={{ backgroundColor: getDiffColor(DiffType.EQUAL) }}
                />
                <span>Equal</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 border"
                  style={{ backgroundColor: getDiffColor(DiffType.MODIFIED) }}
                />
                <span>Modified</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 border"
                  style={{ backgroundColor: getDiffColor(DiffType.ADDED) }}
                />
                <span>Added</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 border"
                  style={{ backgroundColor: getDiffColor(DiffType.REMOVED) }}
                />
                <span>Removed</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiffRow({
  chunk,
  onMouseEnter,
  onMouseLeave
}: {
  chunk: DiffChunk;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const renderBytes = (data: Uint8Array | undefined, isFile2: boolean) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-muted-foreground text-xs italic">
          {isFile2 ? "(added)" : "(removed)"}
        </div>
      );
    }

    return (
      <div className="font-mono text-xs flex flex-wrap gap-1">
        {Array.from(data).map((byte, i) => {
          // Highlight individual byte differences within modified chunks
          let bgColor = getDiffColor(chunk.type);
          if (
            chunk.type === DiffType.MODIFIED &&
            chunk.data1 &&
            chunk.data2 &&
            i < chunk.data1.length &&
            i < chunk.data2.length
          ) {
            if (chunk.data1[i] !== chunk.data2[i]) {
              bgColor = isFile2 ? "#ffcdd2" : "#fff59d"; // red for file2, yellow for file1
            }
          }

          return (
            <span
              key={i}
              className="px-1 rounded text-black"
              style={{ backgroundColor: bgColor }}
            >
              {formatByte(byte)}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="grid grid-cols-[80px_1fr_1fr] gap-4 py-2 border-b hover:bg-accent/30"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="font-mono text-xs text-muted-foreground">
        {chunk.offset.toString(16).toUpperCase().padStart(8, "0")}
      </div>
      <div>{renderBytes(chunk.data1, false)}</div>
      <div>{renderBytes(chunk.data2, true)}</div>
    </div>
  );
}
