import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileArchive, Download, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface DecompressedFile {
  id: number;
  original_file_id: number;
  result_id: number;
  method: string;
  file_name: string;
  size: number;
  created_at: string;
}

interface DecompressedFilesPanelProps {
  onFileSelect: (fileId: number, fileName: string) => void;
}

export function DecompressedFilesPanel({ onFileSelect }: DecompressedFilesPanelProps) {
  const [files, setFiles] = useState<DecompressedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/decompressed/list`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data || []);
      } else {
        toast.error("Failed to load decompressed files");
      }
    } catch (error) {
      toast.error("Error loading decompressed files");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleSelectFile = (file: DecompressedFile) => {
    setSelectedId(file.id);
    onFileSelect(file.id, file.file_name);
  };

  const handleDownload = async (file: DecompressedFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${API_BASE_URL}/decompressed/${file.id}/data`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Downloaded ${file.file_name}`);
      } else {
        toast.error("Failed to download file");
      }
    } catch (error) {
      toast.error("Error downloading file");
      console.error("Error:", error);
    }
  };

  const handleAddToFiles = async (file: DecompressedFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/compression/result/${file.result_id}/add-to-files`,
        { method: "POST" }
      );
      if (response.ok) {
        toast.success(`Added ${file.file_name} to files`);
      } else {
        toast.error("Failed to add file");
      }
    } catch (error) {
      toast.error("Error adding file");
      console.error("Error:", error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-panel-border bg-panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileArchive className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Decompressed Files</h3>
          <Badge variant="secondary">{files.length}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadFiles}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
            <FileArchive className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">No decompressed files yet</p>
            <p className="text-xs mt-1">
              Run compression detection to generate decompressed files
            </p>
          </div>
        ) : (
          <div className="divide-y divide-panel-border">
            {files.map((file) => (
              <div
                key={file.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedId === file.id ? "bg-accent" : ""
                }`}
                onClick={() => handleSelectFile(file)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileArchive className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {file.file_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {file.method}
                      </Badge>
                      <span>{formatSize(file.size)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {file.created_at}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => handleDownload(file, e)}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => handleAddToFiles(file, e)}
                      title="Add to Files"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
