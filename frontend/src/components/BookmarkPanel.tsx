import { useState } from "react";
import { Bookmark } from "@/hooks/useBookmarks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bookmark as BookmarkIcon,
  Trash2,
  Edit,
  MapPin,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface BookmarkPanelProps {
  bookmarks: Bookmark[];
  selection: { start: number; end: number; bytes: number[] } | null;
  onAddBookmark: (offset: number, name?: string, note?: string, endOffset?: number) => void;
  onRemoveBookmark: (id: string) => void;
  onUpdateBookmark: (
    id: string,
    updates: Partial<Omit<Bookmark, "id" | "createdAt">>
  ) => void;
  onJumpToOffset: (offset: number) => void;
}

export const BookmarkPanel = ({
  bookmarks,
  selection,
  onAddBookmark,
  onRemoveBookmark,
  onUpdateBookmark,
  onJumpToOffset,
}: BookmarkPanelProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [bookmarkName, setBookmarkName] = useState("");
  const [bookmarkNote, setBookmarkNote] = useState("");

  const handleAddBookmark = () => {
    if (!selection) {
      toast.error("No byte selected");
      return;
    }

    const offset = selection.start;
    const endOffset = selection.end > selection.start ? selection.end : undefined;
    const name = bookmarkName.trim() || undefined;
    const note = bookmarkNote.trim() || undefined;

    onAddBookmark(offset, name, note, endOffset);
    setBookmarkName("");
    setBookmarkNote("");
    setDialogOpen(false);

    if (endOffset !== undefined) {
      const size = endOffset - offset + 1;
      toast.success(`Range bookmark added (${size} bytes)`);
    } else {
      toast.success("Bookmark added");
    }
  };

  const handleEditBookmark = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setBookmarkName(bookmark.name);
    setBookmarkNote(bookmark.note || "");
    setDialogOpen(true);
  };

  const handleUpdateBookmark = () => {
    if (!editingBookmark) return;

    onUpdateBookmark(editingBookmark.id, {
      name: bookmarkName.trim() || editingBookmark.name,
      note: bookmarkNote.trim() || undefined,
    });

    setEditingBookmark(null);
    setBookmarkName("");
    setBookmarkNote("");
    setDialogOpen(false);
    toast.success("Bookmark updated");
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingBookmark(null);
    setBookmarkName("");
    setBookmarkNote("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Bookmarks</h3>
          <span className="text-xs text-muted-foreground">
            ({bookmarks.length})
          </span>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={!selection}
              onClick={() => {
                setEditingBookmark(null);
                setBookmarkName("");
                setBookmarkNote("");
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBookmark ? "Edit Bookmark" : "Add Bookmark"}
              </DialogTitle>
              <DialogDescription>
                {editingBookmark
                  ? "Update bookmark information"
                  : selection && selection.end > selection.start
                    ? `Create a range bookmark from 0x${selection.start.toString(16).toUpperCase()} to 0x${selection.end.toString(16).toUpperCase()} (${selection.end - selection.start + 1} bytes)`
                    : `Create a bookmark at offset 0x${selection?.start.toString(16).toUpperCase()}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="Enter bookmark name"
                  value={bookmarkName}
                  onChange={(e) => setBookmarkName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Note (optional)</label>
                <Textarea
                  placeholder="Add a note about this location"
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button
                onClick={
                  editingBookmark ? handleUpdateBookmark : handleAddBookmark
                }
              >
                {editingBookmark ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto">
        {bookmarks.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No bookmarks yet. Select a byte and click Add to create one.
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {bookmarks
              .sort((a, b) => a.offset - b.offset)
              .map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="p-3 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow"
                  style={{ borderLeftColor: bookmark.color, borderLeftWidth: 4 }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {bookmark.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {bookmark.endOffset !== undefined ? (
                          <>
                            Range: 0x{bookmark.offset.toString(16).toUpperCase()} - 0x{bookmark.endOffset.toString(16).toUpperCase()}
                            <span className="ml-2 text-muted-foreground/70">
                              ({bookmark.endOffset - bookmark.offset + 1} bytes)
                            </span>
                          </>
                        ) : (
                          <>Offset: 0x{bookmark.offset.toString(16).toUpperCase()}</>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => onJumpToOffset(bookmark.offset)}
                        title="Jump to offset"
                      >
                        <MapPin className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEditBookmark(bookmark)}
                        title="Edit bookmark"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          onRemoveBookmark(bookmark.id);
                          toast.success("Bookmark removed");
                        }}
                        title="Remove bookmark"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {bookmark.note && (
                    <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                      {bookmark.note}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
