import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ByteHistogram } from "./ByteHistogram";
import { EntropyGraph } from "./EntropyGraph";
import { BitmapView } from "./BitmapView";
import { DigramAnalysis } from "./DigramAnalysis";
import { HighlightRange } from "@/utils/colorUtils";
import {
  BarChart3,
  TrendingUp,
  Image,
  Grid2x2,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdvancedVisualizationsProps {
  buffer: ArrayBuffer | null;
  highlights: HighlightRange[];
}

type VisualizationType = "histogram" | "entropy" | "bitmap" | "digrams";

interface VisualizationCard {
  id: VisualizationType;
  title: string;
  icon: React.ReactNode;
  description: string;
  whatIsIt: string;
  whyUseful: string;
  component: React.ReactNode;
  defaultExpanded?: boolean;
}

export function AdvancedVisualizations({
  buffer,
  highlights,
}: AdvancedVisualizationsProps) {
  const [expandedCards, setExpandedCards] = useState<Set<VisualizationType>>(
    new Set(["histogram"])
  );

  const toggleCard = (id: VisualizationType) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCards(new Set(["histogram", "entropy", "bitmap", "digrams"]));
  };

  const collapseAll = () => {
    setExpandedCards(new Set());
  };

  const visualizations: VisualizationCard[] = [
    {
      id: "histogram",
      title: "Byte Frequency Distribution",
      icon: <BarChart3 className="h-5 w-5" />,
      description: "Distribution of byte values (0x00 to 0xFF) throughout the file",
      whatIsIt: "Shows how often each byte value appears in your file",
      whyUseful: "Helps identify common patterns, file types, and encoding methods. ASCII text shows peaks in printable ranges (0x20-0x7E), while compressed/encrypted data appears more uniform.",
      component: <ByteHistogram buffer={buffer} />,
    },
    {
      id: "entropy",
      title: "Entropy Analysis",
      icon: <TrendingUp className="h-5 w-5" />,
      description: "Measures randomness and data complexity across the file",
      whatIsIt: "Shannon entropy calculates how 'random' or 'ordered' your data is (0 = very structured, 8 = completely random)",
      whyUseful: "Low entropy indicates structured data (headers, text, repeated patterns). High entropy suggests compression, encryption, or actual random data. Perfect for finding compressed sections in mixed files.",
      component: <EntropyGraph buffer={buffer} />,
    },
    {
      id: "bitmap",
      title: "2D Bitmap Visualization",
      icon: <Image className="h-5 w-5" />,
      description: "Visual representation of binary data with color modes and tag overlay",
      whatIsIt: "Each byte becomes a pixel with multiple color interpretations - see your data visually with highlighted annotations",
      whyUseful: "Hidden patterns, structures, and boundaries become visible to the human eye. Tag overlays show exactly where your annotations are. Great for spotting file headers, padding, embedded images, or corrupted sections.",
      component: <BitmapView buffer={buffer} highlights={highlights} />,
    },
    {
      id: "digrams",
      title: "Digram Analysis",
      icon: <Grid2x2 className="h-5 w-5" />,
      description: "Frequency analysis of consecutive byte pairs",
      whatIsIt: "Tracks which two-byte combinations appear most often (like 'th' in English text)",
      whyUseful: "Reveals compression patterns, repeated structures, and file format signatures. High-frequency pairs might indicate protocol headers or data encoding schemes.",
      component: <DigramAnalysis buffer={buffer} />,
    },
  ];

  if (!buffer) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-panel-border bg-panel-header">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Advanced Binary Analysis
              </h2>
              <p className="text-xs text-muted-foreground">
                Statistical visualizations and pattern detection
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No file loaded</p>
            <p className="text-xs mt-2">Select a binary file to view analysis</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-6 border-b border-panel-border bg-panel-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Advanced Binary Analysis
              </h2>
              <p className="text-xs text-muted-foreground">
                Statistical visualizations to understand file structure and patterns
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="text-xs"
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="text-xs"
            >
              Collapse All
            </Button>
          </div>
        </div>
      </div>

      {/* Visualization Cards */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {visualizations.map((viz) => {
          const isExpanded = expandedCards.has(viz.id);

          return (
            <Card key={viz.id} className="overflow-hidden border-2 transition-colors hover:border-primary/50">
              {/* Card Header */}
              <div
                className="p-4 bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => toggleCard(viz.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary">
                      {viz.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{viz.title}</h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs" side="right">
                              <div className="space-y-2 text-xs">
                                <div>
                                  <p className="font-semibold mb-1">What is it?</p>
                                  <p className="text-muted-foreground">{viz.whatIsIt}</p>
                                </div>
                                <div>
                                  <p className="font-semibold mb-1">Why useful?</p>
                                  <p className="text-muted-foreground">{viz.whyUseful}</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {viz.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Card Content */}
              {isExpanded && (
                <div className="border-t">
                  {viz.component}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
