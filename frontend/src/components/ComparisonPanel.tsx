import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BinaryDiffViewer } from "./BinaryDiffViewer";
import { DeltaAnalysis } from "./DeltaAnalysis";
import { PatternCorrelation } from "./PatternCorrelation";
import { GitCompare, BarChart3, TrendingUp } from "lucide-react";

interface FileData {
  id?: number;
  name: string;
  size: number;
  buffer?: ArrayBuffer; // Optional - only loaded for small files
}

interface ComparisonPanelProps {
  files: FileData[];
}

export function ComparisonPanel({ files }: ComparisonPanelProps) {
  const [file1Index, setFile1Index] = useState<number>(0);
  const [file2Index, setFile2Index] = useState<number>(
    files.length > 1 ? 1 : 0,
  );

  const file1 = files[file1Index];
  const file2 = files[file2Index];

  // NOTE: We don't load buffers here anymore!
  // All comparisons are done via backend API to avoid loading huge files in memory.
  // The child components (BinaryDiffViewer, DeltaAnalysis, PatternCorrelation)
  // will handle the API calls directly using file1Id and file2Id.

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-6 border-b border-panel-border bg-panel-header">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <GitCompare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Binary Comparison
            </h2>
            <p className="text-xs text-muted-foreground">
              Compare two binary files side-by-side with diff analysis
            </p>
          </div>
        </div>

        {/* File selectors */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">File 1 (Base)</Label>
              <Select
                value={file1Index.toString()}
                onValueChange={(v) => setFile1Index(parseInt(v))}
                disabled={files.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {files.map((file, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="font-mono text-sm">{file.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {file1 && (
                <p className="text-xs text-muted-foreground">
                  {(file1.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </div>
          </Card>

          <Card className="p-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">File 2 (Compare)</Label>
              <Select
                value={file2Index.toString()}
                onValueChange={(v) => setFile2Index(parseInt(v))}
                disabled={files.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {files.map((file, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="font-mono text-sm">{file.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {file2 && (
                <p className="text-xs text-muted-foreground">
                  {(file2.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {files.length < 2 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <GitCompare className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No files to compare</p>
            <p className="text-xs mt-2">
              Upload at least 2 binary files to enable comparison
            </p>
          </div>
        </div>
      ) : (
        <Tabs
          defaultValue="diff"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-panel-border mx-0">
            <TabsTrigger value="diff" className="gap-2">
              <GitCompare className="h-4 w-4" />
              Diff
            </TabsTrigger>
            <TabsTrigger value="delta" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Delta
            </TabsTrigger>
            <TabsTrigger value="correlation" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Correlation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diff" className="flex-1 m-0 overflow-hidden">
            <BinaryDiffViewer
              buffer1={null}
              buffer2={null}
              fileName1={file1?.name}
              fileName2={file2?.name}
              fileSize1={file1?.size}
              fileSize2={file2?.size}
              file1Id={file1?.id}
              file2Id={file2?.id}
            />
          </TabsContent>

          <TabsContent value="delta" className="flex-1 m-0 overflow-hidden">
            <DeltaAnalysis
              buffer1={null}
              buffer2={null}
              fileName1={file1?.name}
              fileName2={file2?.name}
              fileSize1={file1?.size}
              fileSize2={file2?.size}
              file1Id={file1?.id}
              file2Id={file2?.id}
            />
          </TabsContent>

          <TabsContent
            value="correlation"
            className="flex-1 m-0 overflow-hidden"
          >
            <PatternCorrelation
              buffer1={null}
              buffer2={null}
              fileName1={file1?.name}
              fileName2={file2?.name}
              fileSize1={file1?.size}
              fileSize2={file2?.size}
              file1Id={file1?.id}
              file2Id={file2?.id}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
