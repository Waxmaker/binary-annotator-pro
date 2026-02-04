import { useEffect, useRef } from "react";
import { Plus, Calculator, Binary } from "lucide-react";

interface HexViewerContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddToConfig: () => void;
  onCalculateChecksum?: () => void;
  onHuffmanDecode?: () => void;
  hasSelection: boolean;
}

export function HexViewerContextMenu({
  x,
  y,
  onClose,
  onAddToConfig,
  onCalculateChecksum,
  onHuffmanDecode,
  hasSelection,
}: HexViewerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <button
        className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
          hasSelection
            ? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            : "opacity-50 cursor-not-allowed"
        }`}
        onClick={() => {
          if (hasSelection) {
            onAddToConfig();
            onClose();
          }
        }}
        disabled={!hasSelection}
      >
        <Plus className="h-4 w-4" />
        <span>Add to config</span>
      </button>

      <button
        className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
          hasSelection
            ? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            : "opacity-50 cursor-not-allowed"
        }`}
        onClick={() => {
          if (hasSelection && onCalculateChecksum) {
            onCalculateChecksum();
            onClose();
          }
        }}
        disabled={!hasSelection}
      >
        <Calculator className="h-4 w-4" />
        <span>Calculate checksums</span>
      </button>

      <button
        className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
          hasSelection
            ? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            : "opacity-50 cursor-not-allowed"
        }`}
        onClick={() => {
          if (hasSelection && onHuffmanDecode) {
            onHuffmanDecode();
            onClose();
          }
        }}
        disabled={!hasSelection}
      >
        <Binary className="h-4 w-4" />
        <span>Huffman decode</span>
      </button>

      {!hasSelection && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-gray-200 dark:border-gray-700">
          Select bytes first
        </div>
      )}
    </div>
  );
}
