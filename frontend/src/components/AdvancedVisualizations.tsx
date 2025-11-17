import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ByteHistogram } from "./ByteHistogram";
import { EntropyGraph } from "./EntropyGraph";
import { BitmapView } from "./BitmapView";
import { DigramAnalysis } from "./DigramAnalysis";
import { BarChart3, TrendingUp, Image, Grid2x2 } from "lucide-react";

interface AdvancedVisualizationsProps {
  buffer: ArrayBuffer | null;
}

export function AdvancedVisualizations({
  buffer,
}: AdvancedVisualizationsProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">
          Advanced Analysis
        </h2>
      </div>

      <Tabs defaultValue="histogram" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b border-panel-border">
          <TabsTrigger value="histogram" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Histogram
          </TabsTrigger>
          <TabsTrigger value="entropy" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Entropy
          </TabsTrigger>
          <TabsTrigger value="bitmap" className="gap-2">
            <Image className="h-4 w-4" />
            Bitmap
          </TabsTrigger>
          <TabsTrigger value="digrams" className="gap-2">
            <Grid2x2 className="h-4 w-4" />
            Digrams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="histogram" className="flex-1 m-0 overflow-hidden">
          <ByteHistogram buffer={buffer} />
        </TabsContent>

        <TabsContent value="entropy" className="flex-1 m-0 overflow-hidden">
          <EntropyGraph buffer={buffer} />
        </TabsContent>

        <TabsContent value="bitmap" className="flex-1 m-0 overflow-hidden">
          <BitmapView buffer={buffer} />
        </TabsContent>

        <TabsContent value="digrams" className="flex-1 m-0 overflow-hidden">
          <DigramAnalysis buffer={buffer} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
