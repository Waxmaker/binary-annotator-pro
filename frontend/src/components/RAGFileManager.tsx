import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Trash2, FileText, File as FileIcon, X, Search, Sparkles, MessageSquare } from "lucide-react";
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

interface RAGSearchResult {
  document_id: number;
  chunk_id: number;
  type: string;
  title: string;
  content: string;
  source: string;
  score: number;
  metadata?: string;
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
    return saved ? parseInt(saved) : 512;
  });
  const [overlapTokens, setOverlapTokens] = useState(() => {
    const saved = localStorage.getItem('ragOverlapTokens');
    return saved ? parseInt(saved) : 100;
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [maxResults, setMaxResults] = useState(5);
  const [minScore, setMinScore] = useState(0.3);
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("document");

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setSearching(true);
    try {
      // Call backend API which proxies to RAG service
      const requestBody: any = {
        query: searchQuery,
        max_results: maxResults,
        min_score: minScore,
      };

      // Add document type filter if not "all"
      if (documentTypeFilter && documentTypeFilter !== "all") {
        requestBody.type = [documentTypeFilter];
      }

      const response = await fetch(`${API_BASE}/rag/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Search failed");
      }

      const data = await response.json();
      setSearchResults(data.results || []);

      if (data.results && data.results.length > 0) {
        toast.success(`Found ${data.results.length} result(s)`);
      } else {
        toast.info("No results found");
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast.error(error instanceof Error ? error.message : "Failed to search documents");
    } finally {
      setSearching(false);
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
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>RAG Document Manager</DialogTitle>
          <DialogDescription>
            Upload documents to enhance chat with semantic search. Supported formats: TXT, MD, PDF
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="documents" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Search RAG
            </TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents" className="flex-1 flex flex-col min-h-0 space-y-4 mt-4">
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
                <span className="text-xs text-muted-foreground font-semibold">{chunkTokens}</span>
              </div>
              <input
                id="chunk-tokens"
                type="range"
                min="128"
                max="2000"
                step="64"
                value={chunkTokens}
                onChange={(e) => setChunkTokens(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <p className="text-xs text-muted-foreground">
                128-2000 tokens • Larger = more context, fewer chunks
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="overlap-tokens" className="text-xs font-medium">
                  Overlap (tokens)
                </Label>
                <span className="text-xs text-muted-foreground font-semibold">{overlapTokens}</span>
              </div>
              <input
                id="overlap-tokens"
                type="range"
                min="0"
                max="500"
                step="25"
                value={overlapTokens}
                onChange={(e) => setOverlapTokens(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <p className="text-xs text-muted-foreground">
                0-500 tokens • Higher = better context continuity
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
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="flex-1 flex flex-col min-h-0 space-y-4 mt-4">
            {/* Search Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-query">Search Query</Label>
                <Textarea
                  id="search-query"
                  placeholder="Enter your search query... (e.g., 'HL7 aECG Implementation Guide')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={searching}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Press Ctrl+Enter or Cmd+Enter to search
                </p>
              </div>

              {/* Document Type Filter */}
              <div className="space-y-2">
                <Label htmlFor="doc-type-filter">Document Type</Label>
                <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                  <SelectTrigger id="doc-type-filter" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Documents Only (PDF, TXT, MD)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="chat">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>Chat Sessions</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span>All Types</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Filter results by document type
                </p>
              </div>

              {/* Search Parameters */}
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="max-results" className="text-xs font-medium">
                      Max Results
                    </Label>
                    <span className="text-xs text-muted-foreground">{maxResults}</span>
                  </div>
                  <input
                    id="max-results"
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={maxResults}
                    onChange={(e) => setMaxResults(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of results to return
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="min-score" className="text-xs font-medium">
                      Min Score
                    </Label>
                    <span className="text-xs text-muted-foreground">{minScore.toFixed(2)}</span>
                  </div>
                  <input
                    id="min-score"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={minScore}
                    onChange={(e) => setMinScore(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum relevance score (0-1)
                  </p>
                </div>
              </div>

              {/* Search Button */}
              <Button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
                className="w-full gap-2"
                size="lg"
              >
                <Search className="h-4 w-4" />
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>

            {/* Search Results */}
            <div className="flex-1 min-h-0">
              <div className="flex items-center justify-between mb-2">
                <Label>Search Results</Label>
                {searchResults.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {searchResults.length} result(s) found
                  </span>
                )}
              </div>
              <ScrollArea className="h-[300px] border rounded-md">
                <div className="p-4 space-y-3">
                  {searchResults.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No search results yet</p>
                      <p className="text-xs mt-1">Enter a query and click Search</p>
                    </div>
                  ) : (
                    searchResults.map((result, idx) => (
                      <div
                        key={`${result.document_id}-${result.chunk_id}-${idx}`}
                        className="p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors space-y-2"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate text-sm">{result.title}</h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {result.source}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                              {(result.score * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="text-sm text-foreground/90 bg-background/50 p-3 rounded border">
                          <p className="line-clamp-4">{result.content}</p>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Doc ID: {result.document_id}</span>
                          <span>•</span>
                          <span>Chunk: {result.chunk_id}</span>
                          <span>•</span>
                          <span>Type: {result.type}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
