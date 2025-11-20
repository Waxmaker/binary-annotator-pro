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
import { GitCompare, BarChart3, TrendingUp, Loader2 } from "lucide-react";
import { fetchBinaryFile } from "@/lib/api";
import { toast } from "sonner";

interface FileData {
  name: string;
  size: number;
  buffer?: ArrayBuffer; // Optional - only loaded for small files
}

interface ComparisonPanelProps {
  files: FileData[];
}

const CHUNK_THRESHOLD = 50 * 1024 * 1024; // 50MB

export function ComparisonPanel({ files }: ComparisonPanelProps) {
  const [file1Index, setFile1Index] = useState<number>(0);
  const [file2Index, setFile2Index] = useState<number>(
    files.length > 1 ? 1 : 0,
  );
  const [file1Buffer, setFile1Buffer] = useState<ArrayBuffer | null>(null);
  const [file2Buffer, setFile2Buffer] = useState<ArrayBuffer | null>(null);
  const [isLoadingFile1, setIsLoadingFile1] = useState(false);
  const [isLoadingFile2, setIsLoadingFile2] = useState(false);

  const file1 = files[file1Index];
  const file2 = files[file2Index];

  // Load file1 buffer
  useEffect(() => {
    if (!file1) {
      setFile1Buffer(null);
      return;
    }

    // If buffer already exists, use it
    if (file1.buffer) {
      setFile1Buffer(file1.buffer);
      return;
    }

    // For large files, don't load buffer (will use chunk-based comparison)
    if (file1.size > CHUNK_THRESHOLD) {
      console.log(
        `File1 ${file1.name} is large (${(file1.size / (1024 * 1024)).toFixed(1)} MB) - using chunk-based comparison`,
      );
      setFile1Buffer(null);
      return;
    }

    // Load small file buffer
    const loadBuffer = async () => {
      setIsLoadingFile1(true);
      try {
        const buffer = await fetchBinaryFile(file1.name);
        setFile1Buffer(buffer);
        // Cache in file object
        file1.buffer = buffer;
      } catch (err) {
        console.error("Failed to load file1:", err);
        toast.error(`Failed to load ${file1.name}`);
        setFile1Buffer(null);
      } finally {
        setIsLoadingFile1(false);
      }
    };

    loadBuffer();
  }, [file1]);

  // Load file2 buffer
  useEffect(() => {
    if (!file2) {
      setFile2Buffer(null);
      return;
    }

    // If buffer already exists, use it
    if (file2.buffer) {
      setFile2Buffer(file2.buffer);
      return;
    }

    // For large files, don't load buffer (will use chunk-based comparison)
    if (file2.size > CHUNK_THRESHOLD) {
      console.log(
        `File2 ${file2.name} is large (${(file2.size / (1024 * 1024)).toFixed(1)} MB) - using chunk-based comparison`,
      );
      setFile2Buffer(null);
      return;
    }

    // Load small file buffer
    const loadBuffer = async () => {
      setIsLoadingFile2(true);
      try {
        const buffer = await fetchBinaryFile(file2.name);
        setFile2Buffer(buffer);
        // Cache in file object
        file2.buffer = buffer;
      } catch (err) {
        console.error("Failed to load file2:", err);
        toast.error(`Failed to load ${file2.name}`);
        setFile2Buffer(null);
      } finally {
        setIsLoadingFile2(false);
      }
    };

    loadBuffer();
  }, [file2]);

  const isLoading = isLoadingFile1 || isLoadingFile2;

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
                  {file1.size > CHUNK_THRESHOLD && " • Chunk mode"}
                  {isLoadingFile1 && " • Loading..."}
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
                  {file2.size > CHUNK_THRESHOLD && " • Chunk mode"}
                  {isLoadingFile2 && " • Loading..."}
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
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Loading files for comparison...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {isLoadingFile1 && `Loading ${file1?.name}...`}
              {isLoadingFile2 && `Loading ${file2?.name}...`}
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
              buffer1={file1Buffer}
              buffer2={file2Buffer}
              fileName1={file1?.name}
              fileName2={file2?.name}
              fileSize1={file1?.size}
              fileSize2={file2?.size}
            />
          </TabsContent>

          <TabsContent value="delta" className="flex-1 m-0 overflow-hidden">
            <DeltaAnalysis
              buffer1={file1Buffer}
              buffer2={file2Buffer}
              fileName1={file1?.name}
              fileName2={file2?.name}
              fileSize1={file1?.size}
              fileSize2={file2?.size}
            />
          </TabsContent>

          <TabsContent
            value="correlation"
            className="flex-1 m-0 overflow-hidden"
          >
            <PatternCorrelation
              buffer1={file1Buffer}
              buffer2={file2Buffer}
              fileName1={file1?.name}
              fileName2={file2?.name}
              fileSize1={file1?.size}
              fileSize2={file2?.size}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
