import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Trash2, FileText, File as FileIcon, X } from "lucide-react";
import { toast } from "sonner";
import { getUserID } from "@/hooks/useUserID";

interface RAGDocument {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  status: string;
  created_at: string;
  error_msg?: string;
}

interface RAGStats {
  total_documents: number;
  total_chunks: number;
  total_size: number;
}

interface RAGFileManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const API_BASE = "http://localhost:3000";

export function RAGFileManager({ open, onOpenChange }: RAGFileManagerProps) {
  const userID = getUserID();
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Chunking configuration with defaults
  const [chunkTokens, setChunkTokens] = useState(() => {
    const saved = localStorage.getItem('ragChunkTokens');
    return saved ? parseInt(saved) : 256;
  });
  const [overlapTokens, setOverlapTokens] = useState(() => {
    const saved = localStorage.getItem('ragOverlapTokens');
    return saved ? parseInt(saved) : 50;
  });

  useEffect(() => {
    if (open) {
      loadDocuments();
      loadStats();
    }
  }, [open]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/rag/documents?user_id=${userID}`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      const data = await response.json();
      setDocuments(data || []);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents");
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/rag/stats?user_id=${userID}`);
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const ext = file.name.toLowerCase().split('.').pop();
      if (!['txt', 'md', 'pdf'].includes(ext || '')) {
        toast.error("Unsupported file type. Please use .txt, .md, or .pdf files");
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large. Maximum size is 10MB");
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    // Save chunking settings to localStorage
    localStorage.setItem('ragChunkTokens', chunkTokens.toString());
    localStorage.setItem('ragOverlapTokens', overlapTokens.toString());

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(
        `${API_BASE}/rag/upload?user_id=${userID}&chunk_tokens=${chunkTokens}&overlap_tokens=${overlapTokens}`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      toast.success(`File uploaded successfully! (${result.chunk_count} chunks created)`);
      setSelectedFile(null);
      loadDocuments();
      loadStats();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/rag/documents/${docId}?user_id=${userID}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      toast.success("Document deleted successfully");
      loadDocuments();
      loadStats();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === ".txt" || fileType === ".md") {
      return <FileText className="h-4 w-4" />;
    }
    return <FileIcon className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>RAG Document Manager</DialogTitle>
          <DialogDescription>
            Upload documents to enhance chat with semantic search. Supported formats: TXT, MD, PDF
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground">Documents</div>
              <div className="text-2xl font-bold">{stats.total_documents}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Chunks</div>
              <div className="text-2xl font-bold">{stats.total_chunks}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Size</div>
              <div className="text-2xl font-bold">{formatFileSize(stats.total_size)}</div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="space-y-2">
          <Label>Upload Document</Label>
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="flex-1"
            />
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileIcon className="h-4 w-4" />
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Chunking Configuration */}
          <div className="grid grid-cols-2 gap-4 mt-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="chunk-tokens" className="text-xs font-medium">
                  Chunk Size (tokens)
                </Label>
                <span className="text-xs text-muted-foreground">{chunkTokens}</span>
              </div>
              <input
                id="chunk-tokens"
                type="range"
                min="64"
                max="512"
                step="32"
                value={chunkTokens}
                onChange={(e) => setChunkTokens(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <p className="text-xs text-muted-foreground">
                Larger chunks = more context, fewer chunks
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="overlap-tokens" className="text-xs font-medium">
                  Overlap (tokens)
                </Label>
                <span className="text-xs text-muted-foreground">{overlapTokens}</span>
              </div>
              <input
                id="overlap-tokens"
                type="range"
                min="0"
                max="128"
                step="10"
                value={overlapTokens}
                onChange={(e) => setOverlapTokens(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <p className="text-xs text-muted-foreground">
                Higher overlap = better context continuity
              </p>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="flex-1 min-h-0">
          <Label>Uploaded Documents</Label>
          <ScrollArea className="h-[300px] mt-2 border rounded-md">
            <div className="p-4 space-y-2">
              {documents.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No documents uploaded yet
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(doc.file_type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{doc.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {doc.chunk_count} chunks
                          {doc.status === "error" && (
                            <span className="text-destructive ml-2">Error: {doc.error_msg}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
