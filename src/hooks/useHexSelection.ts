import { useState, useCallback } from 'react';

export interface HexSelection {
  start: number;
  end: number;
  bytes: number[];
}

export function useHexSelection(buffer: ArrayBuffer | null) {
  const [selection, setSelection] = useState<HexSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

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
