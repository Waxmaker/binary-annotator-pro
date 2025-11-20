import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Play,
  RefreshCw,
  Trash2,
  FileArchive,
  TrendingUp,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface CompressionResult {
  id: number;
  method: string;
  success: boolean;
  compression_ratio: number;
  confidence: number;
  decompressed_size: number;
  original_size: number;
  entropy_original: number;
  entropy_decompressed: number;
  checksum_valid: boolean;
  validation_msg: string;
  error: string;
  decompressed_file_id?: number;
}

interface CompressionAnalysis {
  id: number;
  file_id: number;
  status: string; // "pending", "running", "completed", "failed"
  total_tests: number;
  success_count: number;
  failed_count: number;
  best_method?: string;
  best_ratio?: number;
  best_confidence?: number;
  error?: string;
  created_at: string;
  results?: CompressionResult[];
}

interface CompressionDetectionProps {
  fileId: number;
  fileName: string;
}

export function CompressionDetection({ fileId, fileName }: CompressionDetectionProps) {
  const [analysis, setAnalysis] = useState<CompressionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  // Load latest analysis on mount
  useEffect(() => {
    if (fileId && fileId > 0) {
      loadLatestAnalysis();
    }
  }, [fileId]);

  // Poll for updates if analysis is running
  useEffect(() => {
    if (analysis?.status === "running" || analysis?.status === "pending") {
      setPolling(true);
      const interval = setInterval(() => {
        loadAnalysis(analysis.id);
      }, 2000); // Poll every 2 seconds

      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    } else {
      setPolling(false);
    }
  }, [analysis?.status, analysis?.id]);

  const loadLatestAnalysis = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/compression/file/${fileId}/latest`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      } else if (response.status === 404) {
        // No analysis yet
        setAnalysis(null);
      }
    } catch (error) {
      console.error("Failed to load analysis:", error);
    }
  };

  const loadAnalysis = async (analysisId: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/compression/${analysisId}`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error("Failed to load analysis:", error);
    }
  };

  const startAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/compression/${fileId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start analysis");
      }

      const data = await response.json();
      toast.success("Compression analysis started");

      // Load the new analysis
      loadAnalysis(data.analysis_id);
    } catch (error) {
      console.error("Failed to start analysis:", error);
      toast.error("Failed to start compression analysis");
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async () => {
    if (!analysis) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/compression/${analysis.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete analysis");
      }

      toast.success("Analysis deleted");
      setAnalysis(null);
    } catch (error) {
      console.error("Failed to delete analysis:", error);
      toast.error("Failed to delete analysis");
    }
  };

  const downloadDecompressed = async (resultId: number, method: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/compression/download/${resultId}`
      );

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.${method.toUpperCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Downloaded ${method.toUpperCase()} decompressed file`);
    } catch (error) {
      console.error("Failed to download:", error);
      toast.error("Failed to download decompressed file");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "running":
        return (
          <Badge className="bg-blue-500">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Show message if no file selected
  if (!fileId || fileId === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <FileArchive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Select a binary file to analyze compression
          </p>
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
              <FileArchive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Compression Detection
              </h2>
              <p className="text-xs text-muted-foreground">
                Automatic detection and decompression of binary data
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {analysis && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadLatestAnalysis}
                  disabled={polling}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${polling ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteAnalysis}
                  disabled={analysis.status === "running" || analysis.status === "pending"}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </>
            )}
            <Button
              onClick={startAnalysis}
              disabled={loading || analysis?.status === "running" || analysis?.status === "pending"}
              size="sm"
            >
              <Play className="h-4 w-4 mr-1" />
              {analysis ? "Run New Analysis" : "Start Analysis"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!analysis ? (
          <Card className="p-12">
            <div className="text-center">
              <FileArchive className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Start compression detection to test {fileName} against all known
                compression methods
              </p>
              <Button onClick={startAnalysis} disabled={loading}>
                <Play className="h-4 w-4 mr-2" />
                Start Compression Analysis
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Status Overview */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">Analysis Status</h3>
                    {getStatusBadge(analysis.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Started: {new Date(analysis.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {analysis.error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        Analysis Failed
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {analysis.error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Tests</p>
                  <p className="text-2xl font-bold">{analysis.total_tests}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-400 mb-1">
                    Successful
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {analysis.success_count}
                  </p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400 mb-1">Failed</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {analysis.failed_count}
                  </p>
                </div>
                {analysis.best_method && (
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">
                      Best Method
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {analysis.best_method.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ratio: {analysis.best_ratio?.toFixed(2)}x
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Results Table */}
            {analysis.results && analysis.results.length > 0 && (
              <Card>
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Detection Results</h3>
                  <p className="text-sm text-muted-foreground">
                    Individual compression method test results
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ratio</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Sizes</TableHead>
                      <TableHead>Entropy</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.results
                      .sort((a, b) => {
                        // Sort by success, then by ratio
                        if (a.success && !b.success) return -1;
                        if (!a.success && b.success) return 1;
                        return (b.compression_ratio || 0) - (a.compression_ratio || 0);
                      })
                      .map((result) => (
                        <TableRow key={result.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileArchive className="h-4 w-4" />
                              {result.method.toUpperCase()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {result.success ? (
                              <Badge className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.success ? (
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-green-600" />
                                <span className="font-semibold">
                                  {result.compression_ratio.toFixed(2)}x
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.success ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full"
                                    style={{
                                      width: `${result.confidence * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-medium">
                                  {(result.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.success ? (
                              <div className="text-xs">
                                <div>
                                  Original: {formatBytes(result.original_size)}
                                </div>
                                <div className="text-muted-foreground">
                                  Decompressed:{" "}
                                  {formatBytes(result.decompressed_size)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.success ? (
                              <div className="text-xs">
                                <div>Orig: {result.entropy_original.toFixed(2)}</div>
                                <div className="text-muted-foreground">
                                  Dec: {result.entropy_decompressed.toFixed(2)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {result.error || "Failed"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.success && result.decompressed_file_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  downloadDecompressed(result.id, result.method)
                                }
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Placeholder for Python integration */}
            {analysis.status === "pending" && (
              <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                      Python Detector Integration Pending
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      The compression detection Python tool is not yet implemented.
                      This analysis will remain in pending state until the detector
                      is integrated.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
