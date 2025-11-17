import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BinaryDiffViewer } from "./BinaryDiffViewer";
import { DeltaAnalysis } from "./DeltaAnalysis";
import { PatternCorrelation } from "./PatternCorrelation";
import { GitCompare, BarChart3, TrendingUp } from "lucide-react";

interface FileData {
  name: string;
  buffer: ArrayBuffer;
}

interface ComparisonPanelProps {
  files: FileData[];
}

export function ComparisonPanel({ files }: ComparisonPanelProps) {
  const [file1Index, setFile1Index] = useState<number>(0);
  const [file2Index, setFile2Index] = useState<number>(files.length > 1 ? 1 : 0);

  const file1 = files[file1Index];
  const file2 = files[file2Index];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Binary Comparison
        </h2>

        {/* File selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">File 1</Label>
            <Select
              value={file1Index.toString()}
              onValueChange={(v) => setFile1Index(parseInt(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {files.map((file, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {file.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">File 2</Label>
            <Select
              value={file2Index.toString()}
              onValueChange={(v) => setFile2Index(parseInt(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {files.map((file, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {file.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {files.length < 2 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Load at least 2 files to compare
        </div>
      ) : (
        <Tabs defaultValue="diff" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-panel-border">
            <TabsTrigger value="diff" className="gap-2">
              <GitCompare className="h-4 w-4" />
              Binary Diff
            </TabsTrigger>
            <TabsTrigger value="delta" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Delta Analysis
            </TabsTrigger>
            <TabsTrigger value="correlation" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Correlation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diff" className="flex-1 m-0 overflow-hidden">
            <BinaryDiffViewer
              buffer1={file1?.buffer || null}
              buffer2={file2?.buffer || null}
              fileName1={file1?.name}
              fileName2={file2?.name}
            />
          </TabsContent>

          <TabsContent value="delta" className="flex-1 m-0 overflow-hidden">
            <DeltaAnalysis
              buffer1={file1?.buffer || null}
              buffer2={file2?.buffer || null}
              fileName1={file1?.name}
              fileName2={file2?.name}
            />
          </TabsContent>

          <TabsContent value="correlation" className="flex-1 m-0 overflow-hidden">
            <PatternCorrelation
              buffer1={file1?.buffer || null}
              buffer2={file2?.buffer || null}
              fileName1={file1?.name}
              fileName2={file2?.name}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
