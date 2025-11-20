import { useState, useCallback, useEffect, useRef } from 'react';

export interface HexSelection {
  start: number;
  end: number;
  bytes: number[];
}

export function useHexSelection(buffer: ArrayBuffer | null) {
  const [selection, setSelection] = useState<HexSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const previousBufferRef = useRef<ArrayBuffer | null>(null);

  // Update selection bytes when buffer changes (file switch)
  // Keep the same offset range but load bytes from the new file
  useEffect(() => {
    // Check if buffer actually changed
    if (buffer === previousBufferRef.current) {
      return;
    }

    previousBufferRef.current = buffer;

    if (!buffer) {
      // No buffer - clear selection if switching to empty state
      if (selection) {
        setSelection(null);
        setIsSelecting(false);
        setSelectionStart(null);
      }
      return;
    }

    if (!selection) {
      // No selection to update
      return;
    }

    // Keep the same offset range, but update bytes from new buffer
    const view = new Uint8Array(buffer);
    const start = selection.start;
    const end = selection.end;

    // Make sure the selection range is valid for the new buffer
    if (start >= buffer.byteLength) {
      // Selection is out of bounds in new file - clear it
      setSelection(null);
      setIsSelecting(false);
      setSelectionStart(null);
      return;
    }

    // Adjust end if it exceeds new buffer size
    const adjustedEnd = Math.min(end, buffer.byteLength - 1);
    const bytes = Array.from(view.slice(start, adjustedEnd + 1));

    setSelection({ start, end: adjustedEnd, bytes });
  }, [buffer, selection]);

  const startSelection = useCallback((offset: number) => {
    setIsSelecting(true);
    setSelectionStart(offset);
    setSelection({ start: offset, end: offset, bytes: [] });
  }, []);

  const updateSelection = useCallback((offset: number) => {
    if (!isSelecting || selectionStart === null || !buffer) return;

    const start = Math.min(selectionStart, offset);
    const end = Math.max(selectionStart, offset);
    
    const view = new Uint8Array(buffer);
    const bytes = Array.from(view.slice(start, end + 1));

    setSelection({ start, end, bytes });
  }, [isSelecting, selectionStart, buffer]);

  const endSelection = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsSelecting(false);
    setSelectionStart(null);
  }, []);

  const selectRange = useCallback((start: number, end: number) => {
    if (!buffer) return;
    
    const view = new Uint8Array(buffer);
    const bytes = Array.from(view.slice(start, end + 1));
    
    setSelection({ start, end, bytes });
  }, [buffer]);

  return {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    selectRange,
  };
}
