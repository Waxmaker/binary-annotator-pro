import { useRef, useCallback, useEffect, useState } from "react";
import { HexLine } from "./HexLine";
import { parseHexLines } from "@/utils/binaryUtils";
import { HighlightRange } from "@/utils/colorUtils";
import { FileText, Search } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { chunkManager } from "@/utils/chunkManager";

interface HexViewerProps {
  buffer: ArrayBuffer | null;
  fileName?: string; // For chunk-based loading
  fileSize?: number; // For chunk-based loading
  highlights: HighlightRange[];
  selection: { start: number; end: number; bytes: number[] } | null;
  onByteClick: (offset: number) => void;
  onByteMouseEnter: (offset: number) => void;
  scrollToOffset?: number | null;
  onClearSelection?: () => void;
}

const BYTES_PER_LINE = 16;
const LINE_HEIGHT = 24;
const VISIBLE_LINES = 50; // Number of lines to render at once

export function HexViewer({
  buffer,
  fileName,
  fileSize: propsFileSize,
  highlights,
  selection,
  onByteClick,
  onByteMouseEnter,
  scrollToOffset,
  onClearSelection,
}: HexViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [addressInput, setAddressInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [chunkData, setChunkData] = useState<Uint8Array | null>(null);
  const [chunkStart, setChunkStart] = useState(0);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);

  // Use chunk-based loading if fileName is provided, otherwise use buffer
  const useChunks = !buffer && fileName && propsFileSize;
  const fileSize = useChunks ? propsFileSize! : buffer ? buffer.byteLength : 0;

  // For chunk mode, create a virtual buffer from chunk data
  const effectiveBuffer =
    useChunks && chunkData
      ? chunkData.buffer.slice(0, chunkData.byteLength)
      : buffer;

  const lines = effectiveBuffer
    ? parseHexLines(effectiveBuffer, BYTES_PER_LINE, useChunks ? chunkStart : 0)
    : [];
  const totalHeight = Math.ceil(fileSize / BYTES_PER_LINE) * LINE_HEIGHT;

  // Generate address suggestions from highlights
  const addressSuggestions = highlights
    .map((h) => ({
      address: h.start,
      label:
        h.name || h.label || `Offset 0x${h.start.toString(16).toUpperCase()}`,
      color: h.color,
    }))
    .filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.address === item.address),
    )
    .sort((a, b) => a.address - b.address);

  // Calculate visible range
  // For chunk mode: adjust indices to be relative to the chunk
  const viewportStartLineIndex = Math.floor(scrollTop / LINE_HEIGHT);
  const chunkStartLineIndex = useChunks
    ? Math.floor(chunkStart / BYTES_PER_LINE)
    : 0;
  const relativeStartIndex = Math.max(
    0,
    viewportStartLineIndex - chunkStartLineIndex,
  );
  const relativeEndIndex = Math.min(
    relativeStartIndex + VISIBLE_LINES,
    lines.length,
  );
  const visibleLines = lines.slice(relativeStartIndex, relativeEndIndex);

  // For rendering, we need the absolute line index for positioning
  const startIndex = useChunks
    ? chunkStartLineIndex + relativeStartIndex
    : relativeStartIndex;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Parse address input (supports hex with 0x prefix, decimal, or just hex digits)
  const parseAddress = (input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
      // Try parsing as hex (with or without 0x prefix)
      if (trimmed.toLowerCase().startsWith("0x")) {
        return parseInt(trimmed, 16);
      }
      // If it looks like hex (only contains hex digits)
      if (/^[0-9a-fA-F]+$/.test(trimmed)) {
        return parseInt(trimmed, 16);
      }
      // Try parsing as decimal
      return parseInt(trimmed, 10);
    } catch {
      return null;
    }
  };

  const jumpToAddress = (address: number) => {
    if (address < 0 || address >= fileSize) return;

    if (containerRef.current) {
      const lineIndex = Math.floor(address / BYTES_PER_LINE);
      const targetScroll =
        lineIndex * LINE_HEIGHT - containerRef.current.clientHeight / 2;
      containerRef.current.scrollTop = Math.max(0, targetScroll);

      // Trigger byte click to select it
      onByteClick(address);
    }

    setShowSuggestions(false);
  };

  const handleAddressSubmit = () => {
    const address = parseAddress(addressInput);
    if (address !== null) {
      jumpToAddress(address);
    }
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddressSubmit();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Filter suggestions based on input
  const filteredSuggestions = addressSuggestions
    .filter((s) => {
      if (!addressInput.trim()) return true;
      const searchTerm = addressInput.toLowerCase();
      const hexAddr = s.address.toString(16).toLowerCase();
      const label = s.label.toLowerCase();
      return hexAddr.includes(searchTerm) || label.includes(searchTerm);
    })
    .slice(0, 10); // Limit to 10 suggestions

  useEffect(() => {
    if (
      scrollToOffset !== null &&
      scrollToOffset !== undefined &&
      containerRef.current
    ) {
      const lineIndex = Math.floor(scrollToOffset / BYTES_PER_LINE);
      const targetScroll =
        lineIndex * LINE_HEIGHT - containerRef.current.clientHeight / 2;
      containerRef.current.scrollTop = Math.max(0, targetScroll);
    }
  }, [scrollToOffset]);

  // Load chunks when scrolling (for chunk mode)
  useEffect(() => {
    if (!useChunks || !fileName) return;

    const loadChunkForScroll = async () => {
      // Calculate which chunk we need based on scroll position
      const firstVisibleLine = Math.floor(scrollTop / LINE_HEIGHT);
      const firstVisibleByte = firstVisibleLine * BYTES_PER_LINE;

      // Load a chunk centered around the visible area
      const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
      const chunkStartByte =
        Math.floor(firstVisibleByte / CHUNK_SIZE) * CHUNK_SIZE;

      // Skip if we already have this chunk
      if (chunkData && chunkStartByte === chunkStart) return;

      setIsLoadingChunk(true);

      try {
        // Initialize file in chunk manager
        chunkManager.initFile(fileName, fileSize);

        // Load chunk
        const chunk = await chunkManager.getBytes(
          fileName,
          chunkStartByte,
          CHUNK_SIZE,
        );

        setChunkData(chunk);
        setChunkStart(chunkStartByte);

        // Preload adjacent chunks
        chunkManager
          .preloadAround(fileName, firstVisibleByte)
          .catch(console.error);
      } catch (err) {
        console.error("Failed to load chunk:", err);
      } finally {
        setIsLoadingChunk(false);
      }
    };

    loadChunkForScroll();
  }, [useChunks, fileName, fileSize, scrollTop, chunkData, chunkStart]);

  // Handle keyboard shortcuts (Vim-style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to clear selection
      if (e.key === "Escape") {
        if (selection && onClearSelection) {
          onClearSelection();
          e.preventDefault();
        }
        // Also close autocomplete if open
        setShowSuggestions(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection, onClearSelection]);

  // Show loading state if we're in chunk mode and loading initial chunk
  if (useChunks && isLoadingChunk && !chunkData) {
    return (
      <div className="flex items-center justify-center h-full bg-hex-background text-muted-foreground">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-800"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-medium">Loading file chunks...</p>
          <p className="text-xs mt-2">
            Optimized for large files ({(fileSize / (1024 * 1024)).toFixed(1)}{" "}
            MB)
          </p>
        </div>
      </div>
    );
  }

  // Only show "No file loaded" if we're not in chunk mode and no buffer
  if (!buffer && !useChunks) {
    return (
      <div className="flex items-center justify-center h-full bg-hex-background text-muted-foreground">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No file loaded</p>
          <p className="text-xs mt-2">Upload a binary file to begin</p>
        </div>
      </div>
    );
  }

  const display_selection = () => {
    if (selection) {
      return (
        <div className="items-center gap-2 flex align-center justify-between w-full text-xs">
          <span className="font-mono text-hex-address">
            Selected: 0x{selection.start.toString(16).toUpperCase()} - 0x
            {selection.end}
          </span>
          <span className="font-mono text-hex-address">
            Size: {selection.end - selection.start + 1} bytes
          </span>
        </div>
      );
    }
  };

  return (
    <div className="h-full flex flex-col bg-hex-background relative">
      {/* Chunk Loading Indicator (during scroll) */}
      {useChunks && isLoadingChunk && chunkData && (
        <div className="absolute top-2 right-2 z-50 flex items-center gap-2 bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg px-3 py-1.5 shadow-lg">
          <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <span className="text-xs font-medium text-primary">
            Loading chunk...
          </span>
        </div>
      )}

      {/* Address Search Bar */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-2">
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Jump to address (hex: 0x1A2B or 1A2B, decimal: 6699)"
                value={addressInput}
                onChange={(e) => {
                  setAddressInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleAddressKeyDown}
                onFocus={() => setShowSuggestions(true)}
                className="pl-9 pr-20 font-mono text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {fileSize > 0 &&
                  `Max: 0x${(fileSize - 1).toString(16).toUpperCase()}`}
              </div>
            </div>
            <Button onClick={handleAddressSubmit} size="sm" className="px-4">
              Go
            </Button>
          </div>

          {/* Autocomplete Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {filteredSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setAddressInput(
                      `0x${suggestion.address.toString(16).toUpperCase()}`,
                    );
                    jumpToAddress(suggestion.address);
                  }}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: suggestion.color }}
                    />
                    <span className="text-sm truncate">{suggestion.label}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground ml-2">
                    0x
                    {suggestion.address
                      .toString(16)
                      .toUpperCase()
                      .padStart(4, "0")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {selection && selection.bytes.length > 0 ? (
        <div
          id="display_address_info_selection"
          className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2"
        >
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <p>{display_selection()}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Hex View */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto pt-2"
        onScroll={handleScroll}
        onClick={() => setShowSuggestions(false)}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: startIndex * LINE_HEIGHT,
              left: 0,
              right: 0,
            }}
          >
            {visibleLines.map((line, i) => {
              const lineIndex = startIndex + i;
              return (
                <HexLine
                  key={lineIndex}
                  offset={line.offset}
                  bytes={line.bytes}
                  highlights={highlights}
                  selection={
                    selection
                      ? { start: selection.start, end: selection.end }
                      : null
                  }
                  onByteClick={onByteClick}
                  onByteMouseEnter={onByteMouseEnter}
                  style={{ height: LINE_HEIGHT }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
