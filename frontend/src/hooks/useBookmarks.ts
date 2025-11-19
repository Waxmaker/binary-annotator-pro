import { useState, useCallback, useEffect } from "react";

export interface Bookmark {
  id: string;
  offset: number;
  endOffset?: number; // Optional: for range selection (start = offset, end = endOffset)
  name: string;
  color: string;
  note?: string;
  createdAt: number;
}

const STORAGE_KEY = "hex-viewer-bookmarks";

export const useBookmarks = (fileName: string | null) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Load bookmarks from localStorage when file changes
  useEffect(() => {
    if (!fileName) {
      setBookmarks([]);
      return;
    }

    const storageKey = `${STORAGE_KEY}-${fileName}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        setBookmarks(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to parse bookmarks:", err);
        setBookmarks([]);
      }
    } else {
      setBookmarks([]);
    }
  }, [fileName]);

  // Save bookmarks to localStorage
  const saveBookmarks = useCallback(
    (newBookmarks: Bookmark[]) => {
      if (!fileName) return;

      const storageKey = `${STORAGE_KEY}-${fileName}`;
      localStorage.setItem(storageKey, JSON.stringify(newBookmarks));
      setBookmarks(newBookmarks);
    },
    [fileName]
  );

  const addBookmark = useCallback(
    (offset: number, name?: string, note?: string, endOffset?: number) => {
      const colors = [
        "#ef4444", // red
        "#f59e0b", // amber
        "#10b981", // green
        "#3b82f6", // blue
        "#8b5cf6", // violet
        "#ec4899", // pink
      ];

      // Generate default name based on whether it's a range or single offset
      let defaultName: string;
      if (endOffset !== undefined && endOffset > offset) {
        const size = endOffset - offset + 1;
        defaultName = `Range 0x${offset.toString(16).toUpperCase()}-0x${endOffset.toString(16).toUpperCase()} (${size} bytes)`;
      } else {
        defaultName = `Offset 0x${offset.toString(16).toUpperCase()}`;
      }

      const newBookmark: Bookmark = {
        id: `bookmark-${Date.now()}-${Math.random()}`,
        offset,
        endOffset: endOffset !== undefined && endOffset > offset ? endOffset : undefined,
        name: name || defaultName,
        color: colors[bookmarks.length % colors.length],
        note,
        createdAt: Date.now(),
      };

      saveBookmarks([...bookmarks, newBookmark]);
    },
    [bookmarks, saveBookmarks]
  );

  const removeBookmark = useCallback(
    (id: string) => {
      saveBookmarks(bookmarks.filter((b) => b.id !== id));
    },
    [bookmarks, saveBookmarks]
  );

  const updateBookmark = useCallback(
    (id: string, updates: Partial<Omit<Bookmark, "id" | "createdAt">>) => {
      saveBookmarks(
        bookmarks.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    },
    [bookmarks, saveBookmarks]
  );

  const clearBookmarks = useCallback(() => {
    saveBookmarks([]);
  }, [saveBookmarks]);

  const getBookmarkAtOffset = useCallback(
    (offset: number) => {
      return bookmarks.find((b) => b.offset === offset);
    },
    [bookmarks]
  );

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    clearBookmarks,
    getBookmarkAtOffset,
  };
};
