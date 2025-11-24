import { useState, useCallback, useEffect, useRef } from "react";
import { evaluate } from "mathjs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface NotesPanelProps {
  fileName?: string | null;
  onJumpToOffset?: (offset: number, length?: number) => void;
}

export const NotesPanel = ({ fileName, onJumpToOffset }: NotesPanelProps) => {
  const [notes, setNotes] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Load notes from localStorage when file changes
  useEffect(() => {
    if (fileName) {
      const savedNotes = localStorage.getItem(`notes_${fileName}`);
      if (savedNotes) {
        setNotes(savedNotes);
      } else {
        setNotes("");
      }
    } else {
      setNotes("");
    }
  }, [fileName]);

  // Save notes to localStorage
  const saveNotes = useCallback(
    (value: string) => {
      if (fileName) {
        localStorage.setItem(`notes_${fileName}`, value);
      }
    },
    [fileName]
  );

  // Process math calculations in text
  const processCalculations = useCallback((text: string): string => {
    // Match patterns like "10 x 20 =", "5 + 3 =", "100 / 4 =", etc.
    const mathPattern = /^(.+?)\s*=\s*$/gm;

    return text.replace(mathPattern, (match, expression) => {
      try {
        // Clean up the expression
        const cleanExpr = expression
          .trim()
          .replace(/×/g, "*")
          .replace(/÷/g, "/")
          .replace(/x/gi, "*"); // Support both 'x' and 'X' for multiplication

        // Try to evaluate the expression
        const result = evaluate(cleanExpr);

        // Format the result nicely
        if (typeof result === "number") {
          return `${expression} = ${result}`;
        } else {
          return match; // Keep original if result is not a number
        }
      } catch (error) {
        // If evaluation fails, keep the original text
        return match;
      }
    });
  }, []);

  // Handle text changes from contentEditable
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      // Get the HTML to properly preserve line breaks
      const htmlValue = e.currentTarget.innerHTML;

      // Extract plain text from HTML while preserving line breaks
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlValue;
      // Replace <br> with \n
      tempDiv.querySelectorAll("br").forEach((br) => {
        br.replaceWith("\n");
      });
      const newValue = tempDiv.textContent || "";

      // Check if user just typed "=" for calculations
      if (newValue.includes("=")) {
        const processedText = processCalculations(newValue);
        if (processedText !== newValue) {
          setNotes(processedText);
          saveNotes(processedText);
          return;
        }
      }

      setNotes(newValue);
      saveNotes(newValue);
    },
    [processCalculations, saveNotes]
  );

  // Clear all notes
  const handleClear = useCallback(() => {
    if (confirm("Clear all notes for this file?")) {
      setNotes("");
      if (fileName) {
        localStorage.removeItem(`notes_${fileName}`);
      }
      toast.success("Notes cleared");
    }
  }, [fileName]);

  // Copy notes to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    toast.success("Notes copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [notes]);

  // Handle offset click
  const handleOffsetClick = useCallback(
    (offset: number) => {
      if (onJumpToOffset) {
        onJumpToOffset(offset, 1);
        toast.success(`Jumped to offset 0x${offset.toString(16).toUpperCase()}`);
      }
    },
    [onJumpToOffset]
  );

  // Handle clicks on offset links
  const handleEditorClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("offset-link")) {
        e.preventDefault();
        const offsetStr = target.getAttribute("data-offset");
        if (offsetStr) {
          const offset = parseInt(offsetStr, 10);
          handleOffsetClick(offset);
        }
      }
    },
    [handleOffsetClick]
  );

  // Update editor content when notes change
  useEffect(() => {
    if (editorRef.current && !editorRef.current.contains(document.activeElement)) {
      // Pattern to match hex offsets: 0x followed by hex digits
      const offsetPattern = /(0x[0-9a-fA-F]+)/g;

      // Escape HTML and convert offsets to clickable spans
      const htmlContent = notes
        .split("\n")
        .map((line) => {
          const parts = line.split(offsetPattern);
          const processedLine = parts
            .map((part) => {
              if (part.match(/^0x[0-9a-fA-F]+$/)) {
                const offset = parseInt(part, 16);
                return `<span class="offset-link" data-offset="${offset}" style="background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); padding: 2px 6px; border-radius: 4px; cursor: pointer; font-weight: 600; user-select: none;" title="Click to jump to offset ${offset} (decimal)">${part}</span>`;
              }
              // Escape HTML for regular text
              return part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            })
            .join("");
          return processedLine;
        })
        .join("<br>");

      if (editorRef.current.innerHTML !== htmlContent) {
        editorRef.current.innerHTML = htmlContent;
      }
    }
  }, [notes]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-3 border-b border-panel-border bg-panel-header flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          <p className="text-xs text-muted-foreground">
            Smart notes with auto-calculation (type: 10 x 20 =)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!notes}
            className="h-8"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!notes}
            className="h-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <Card className="h-full min-h-[200px] relative">
          <div
            ref={editorRef}
            contentEditable={!!fileName}
            onInput={handleInput}
            onClick={handleEditorClick}
            className="w-full h-full p-4 bg-transparent border-0 focus:outline-none focus:ring-0 font-mono text-sm overflow-auto"
            style={{ minHeight: "100%" }}
            suppressContentEditableWarning
          />
          {!notes && (
            <div className="absolute top-4 left-4 text-muted-foreground font-mono text-sm pointer-events-none whitespace-pre-wrap select-none">
              {fileName
                ? "Take notes here...\n\nTry:\n• Math: 10 x 20 =\n• Offsets: 0x100, 0xABCD\n• Click offsets to jump!"
                : "Select a file to start taking notes..."}
            </div>
          )}
        </Card>
      </div>

      <div className="p-2 border-t border-panel-border bg-panel-header">
        <p className="text-xs text-muted-foreground text-center">
          Math: +, -, *, /, x, ^, sqrt(), sin(), cos() | Offsets: 0x... (clickable)
        </p>
      </div>
    </div>
  );
};
