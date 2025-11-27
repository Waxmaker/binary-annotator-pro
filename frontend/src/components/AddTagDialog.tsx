import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AddTagDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (tagName: string, color: string) => void;
  selectionStart: number;
  selectionEnd: number;
  selectionSize: number;
}

const DEFAULT_COLORS = [
  "#95E1D3", "#FFD93D", "#6BCF7F", "#4D96FF", "#FF6B9D",
  "#E7679A", "#A76183", "#FCBAD3", "#AA96DA", "#F38181",
  "#4ECDC4", "#FF6B6B", "#FFB6B9", "#FEC8D8", "#C9ADA7"
];

export function AddTagDialog({
  open,
  onClose,
  onConfirm,
  selectionStart,
  selectionEnd,
  selectionSize,
}: AddTagDialogProps) {
  const [tagName, setTagName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTagName("");
      // Pick a random color for variety
      const randomColor = DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
      setColor(randomColor);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!tagName.trim()) {
      return;
    }

    onConfirm(tagName.trim(), color);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagName.trim()) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Tag to Configuration</DialogTitle>
          <DialogDescription>
            Create a new tag for the selected bytes in your YAML configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selection Info */}
          <div className="rounded-lg bg-muted p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Selected Range:</div>
            <div className="font-mono text-sm">
              <span className="text-primary">0x{selectionStart.toString(16).toUpperCase().padStart(4, '0')}</span>
              {" → "}
              <span className="text-primary">0x{selectionEnd.toString(16).toUpperCase().padStart(4, '0')}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Size: {selectionSize} bytes
            </div>
          </div>

          {/* Tag Name Input */}
          <div className="space-y-2">
            <Label htmlFor="tag-name">Tag Name *</Label>
            <Input
              id="tag-name"
              placeholder="e.g., patient_metadata"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Use lowercase with underscores (e.g., lead_i_data)
            </p>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label htmlFor="tag-color">Color</Label>
            <div className="flex gap-2">
              <Input
                id="tag-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 p-1 cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 font-mono"
                placeholder="#FF0000"
              />
            </div>
            <div className="flex gap-2 flex-wrap mt-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded border-2 transition-all ${
                    color === c ? "border-primary scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!tagName.trim()}>
            Add Tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
