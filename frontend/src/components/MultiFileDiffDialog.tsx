import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileCode, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  compareMultipleFiles,
  generateMultiFileDiffYaml,
  type MultiFileCompareResponse,
} from "@/services/comparisonApi";
import { fetchBinaryList, type BinaryFile } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MultiFileDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onYamlGenerated?: (yaml: string) => void;
}

export function MultiFileDiffDialog({
  open,
  onOpenChange,
  onYamlGenerated,
}: MultiFileDiffDialogProps) {
  const [files, setFiles] = useState<BinaryFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [minRegionSize, setMinRegionSize] = useState(4);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [generatingYaml, setGeneratingYaml] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<MultiFileCompareResponse | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadFiles();
      setSelectedFileIds([]);
      setComparisonResult(null);
    }
  }, [open]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const fetchedFiles = await fetchBinaryList();
      setFiles(fetchedFiles);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to load files: ${error}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFileSelection = (fileId: number) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleCompare = async () => {
    if (selectedFileIds.length < 2) {
      toast({
        title: "Error",
        description: "Please select at least 2 files to compare",
        variant: "destructive",
      });
      return;
    }

    if (selectedFileIds.length > 10) {
      toast({
        title: "Warning",
        description: "Comparing more than 10 files may impact performance",
      });
    }

    setComparing(true);
    try {
      const result = await compareMultipleFiles(
        selectedFileIds,
        minRegionSize,
        1000
      );
      setComparisonResult(result);

      if (result.total_regions === 0) {
        toast({
          title: "No Common Regions Found",
          description: `No common byte regions found across all ${selectedFileIds.length} files. Try reducing the minimum region size.`,
        });
      } else {
        toast({
          title: "Comparison Complete",
          description: `Found ${result.total_regions} common region${result.total_regions > 1 ? 's' : ''} across ${selectedFileIds.length} files`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Comparison failed: ${error}`,
        variant: "destructive",
      });
    } finally {
      setComparing(false);
    }
  };

  const handleGenerateYaml = async () => {
    if (!comparisonResult) return;

    setGeneratingYaml(true);
    try {
      const yaml = await generateMultiFileDiffYaml(
        selectedFileIds,
        comparisonResult.common_regions,
        comparisonResult.file_names
      );

      toast({
        title: "YAML Generated",
        description: "Opening YAML editor with generated configuration",
      });

      if (onYamlGenerated) {
        onYamlGenerated(yaml);
      }

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to generate YAML: ${error}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingYaml(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Multi-File Binary Diff</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Selection Section */}
          <div className="space-y-2">
            <Label>Select Files to Compare (minimum 2)</Label>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No files available
                        </TableCell>
                      </TableRow>
                    ) : (
                      files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedFileIds.includes(file.id)}
                              onCheckedChange={() => toggleFileSelection(file.id)}
                            />
                          </TableCell>
                          <TableCell>{file.name}</TableCell>
                          <TableCell>{formatBytes(file.size)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              {selectedFileIds.length} file{selectedFileIds.length !== 1 ? 's' : ''} selected
            </div>
          </div>

          {/* Parameters Section */}
          <div className="space-y-2">
            <Label htmlFor="minRegionSize">Minimum Region Size (bytes)</Label>
            <Input
              id="minRegionSize"
              type="number"
              min={1}
              value={minRegionSize}
              onChange={(e) => setMinRegionSize(parseInt(e.target.value) || 4)}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Only regions with at least this many identical bytes will be included
            </p>
          </div>

          {/* Comparison Results Section */}
          {comparisonResult && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg">Comparison Results</h3>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-md p-3">
                  <div className="text-sm text-muted-foreground">Total Files</div>
                  <div className="text-2xl font-bold">{comparisonResult.stats.total_files}</div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-sm text-muted-foreground">Common Regions</div>
                  <div className="text-2xl font-bold">{comparisonResult.total_regions}</div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-sm text-muted-foreground">Common Bytes</div>
                  <div className="text-2xl font-bold">{formatBytes(comparisonResult.stats.common_bytes)}</div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-sm text-muted-foreground">% Common</div>
                  <div className="text-2xl font-bold">{comparisonResult.stats.percent_common.toFixed(1)}%</div>
                </div>
              </div>

              {/* File Size Info */}
              {comparisonResult.stats.min_file_size !== comparisonResult.stats.max_file_size && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Files have different sizes. Comparison limited to {formatBytes(comparisonResult.stats.min_file_size)} (smallest file).
                  </AlertDescription>
                </Alert>
              )}

              {/* Truncation Warning */}
              {comparisonResult.truncated && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Results truncated to 1000 regions. Consider increasing minimum region size to see more meaningful patterns.
                  </AlertDescription>
                </Alert>
              )}

              {/* Common Regions Table */}
              {comparisonResult.total_regions > 0 && (
                <div className="space-y-2">
                  <Label>Common Regions Preview (first 10)</Label>
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Region</TableHead>
                          <TableHead>Offset</TableHead>
                          <TableHead>Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonResult.common_regions.slice(0, 10).map((region, idx) => (
                          <TableRow key={idx}>
                            <TableCell>common_region_{idx}</TableCell>
                            <TableCell>0x{region.offsets[0].toString(16).toUpperCase().padStart(4, '0')}</TableCell>
                            <TableCell>{region.sizes[0]} bytes</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {comparisonResult.total_regions > 10 && (
                    <p className="text-sm text-muted-foreground">
                      ... and {comparisonResult.total_regions - 10} more regions
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCompare}
            disabled={selectedFileIds.length < 2 || comparing}
          >
            {comparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Find Common Regions
          </Button>
          {comparisonResult && comparisonResult.total_regions > 0 && (
            <Button
              onClick={handleGenerateYaml}
              disabled={generatingYaml}
            >
              {generatingYaml && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileCode className="mr-2 h-4 w-4" />
              Generate YAML Config
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
