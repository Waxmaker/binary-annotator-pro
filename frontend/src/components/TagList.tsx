import { Search, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatAddress } from "@/utils/binaryUtils";
import { HighlightRange } from "@/utils/colorUtils";

interface TagListProps {
  highlights: HighlightRange[];
  onTagClick: (offset: number) => void;
  hoveredTag: string | null;
  onTagHover: (name: string | null) => void;
}

export function TagList({
  highlights,
  onTagClick,
  hoveredTag,
  onTagHover,
}: TagListProps) {
  const tagHighlights = highlights.filter((h) => h.type === "tag");
  const searchHighlights = highlights.filter((h) => h.type === "search");

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">Highlights</h2>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Tags Section */}
        {tagHighlights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Tag className="h-3 w-3" />
              TAGS
            </div>
            {tagHighlights.map((highlight, i) => (
              <Card
                key={`tag-${i}`}
                className={`p-3 cursor-pointer transition-all hover:scale-[1.02] ${
                  hoveredTag === highlight.name ? "ring-2 ring-primary" : ""
                }`}
                style={{
                  borderLeft: `4px solid ${highlight.color}`,
                }}
                onClick={() => onTagClick(highlight.start)}
                onMouseEnter={() => onTagHover(highlight.name)}
                onMouseLeave={() => onTagHover(null)}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">
                      {highlight.name}
                    </p>
                    <div
                      className="h-4 w-4 rounded border border-border flex-shrink-0"
                      style={{ backgroundColor: highlight.color }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>Offset:</span>
                      <span className="font-mono text-hex-address">
                        {formatAddress(highlight.start)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-mono">
                        {highlight.end - highlight.start} bytes
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Search Matches Section */}
        {searchHighlights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Search className="h-3 w-3" />
              SEARCH MATCHES ({searchHighlights.length})
            </div>
            <div className="max-h-64 overflow-auto space-y-2">
              {searchHighlights.map((highlight, i) => (
                <Card
                  key={`search-${i}`}
                  className="p-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
                  style={{
                    borderLeft: `3px solid ${highlight.color}`,
                  }}
                  onClick={() => onTagClick(highlight.start)}
                  onMouseEnter={() => onTagHover(highlight.name)}
                  onMouseLeave={() => onTagHover(null)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate">
                        {highlight.name}
                      </p>
                      <div
                        className="h-3 w-3 rounded border border-border flex-shrink-0"
                        style={{ backgroundColor: highlight.color }}
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <div className="flex justify-between">
                        <span>Offset:</span>
                        <span className="font-mono text-hex-address">
                          {formatAddress(highlight.start)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span className="font-mono">
                          {highlight.end - highlight.start} bytes
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {highlights.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No highlights defined</p>
            <p className="text-xs mt-1">Add tags or search rules in YAML</p>
          </div>
        )}
      </div>
    </div>
  );
}
