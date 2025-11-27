import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createSampledBuffer, SamplingInfo } from "@/utils/fileSampling";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilePanel } from "@/components/FilePanel";
import { YamlEditor } from "@/components/YamlEditor";
import { YamlConfigList } from "@/components/YamlConfigList";
import { HexViewer } from "@/components/HexViewer";
import { TagList } from "@/components/TagList";
import { ECGInspector } from "@/components/ECGInspector";
import { AdvancedVisualizations } from "@/components/AdvancedVisualizations";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { CompressionDetection } from "@/components/CompressionDetection";
import { useHexSelection } from "@/hooks/useHexSelection";
import { useYamlConfig } from "@/hooks/useYamlConfig";
import {
  Activity,
  LineChart,
  FolderOpen,
  FileCode,
  GitBranch,
  BarChart3,
  GitCompare,
  Info,
  Settings,
  MessageSquare,
  BookOpen,
  FileArchive,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { fetchBinaryList, fetchBinaryFile } from "@/lib/api";
import { ByteStatistics } from "@/components/ByteStatistics";
import { FileInfo } from "@/components/FileInfo";
import { BookmarkPanel } from "@/components/BookmarkPanel";
import { CopyAsMenu } from "@/components/CopyAsMenu";
import { useBookmarks } from "@/hooks/useBookmarks";
import { PatternSearch } from "@/components/PatternSearch";
import { SettingsDialog } from "@/components/SettingsDialog";
import { HighlightRange } from "@/utils/colorUtils";
import { NotesPanel } from "@/components/NotesPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface FileData {
  id?: number; // File ID from database
  name: string;
  size: number;
  buffer?: ArrayBuffer; // Optional - only used for small files or legacy mode
}

const Index = () => {
  const navigate = useNavigate();
  const [selectTab, setSelectTab] = useState<string>("files");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(() => {
    // Load from localStorage on mount
    return localStorage.getItem("selectedBinaryFile");
  });
  const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [currentConfigName, setCurrentConfigName] = useState<
    string | undefined
  >(undefined);
  const [refreshConfigList, setRefreshConfigList] = useState(0);
  const [searchHighlights, setSearchHighlights] = useState<HighlightRange[]>(
    [],
  );
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const [currentBuffer, setCurrentBuffer] = useState<ArrayBuffer | null>(null);
  const [isLoadingBuffer, setIsLoadingBuffer] = useState(false);
  const [samplingInfo, setSamplingInfo] = useState<SamplingInfo | null>(null);

  // Save current file to localStorage whenever it changes
  useEffect(() => {
    if (currentFile) {
      localStorage.setItem("selectedBinaryFile", currentFile);
    } else {
      localStorage.removeItem("selectedBinaryFile");
    }
  }, [currentFile]);

  // Load buffer only when file is selected
  // For large files (>50MB), use intelligent sampling for analysis
  useEffect(() => {
    if (!currentFile) {
      setCurrentBuffer(null);
      setSamplingInfo(null);
      return;
    }

    const file = files.find((f) => f.name === currentFile);
    if (!file) return;

    // Threshold for chunk-based loading: 50MB
    const CHUNK_THRESHOLD = 50 * 1024 * 1024;

    // If buffer already loaded, use it
    if (file.buffer) {
      setCurrentBuffer(file.buffer);
      setSamplingInfo({
        isSampled: false,
        originalSize: file.size,
        sampleSize: file.buffer.byteLength,
        strategy: "full",
      });
      return;
    }

    // Load buffer (with sampling for large files)
    const loadBuffer = async () => {
      setIsLoadingBuffer(true);

      const isLargeFile = file.size > CHUNK_THRESHOLD;
      const loadingMessage = isLargeFile
        ? `Sampling ${file.name} for analysis...`
        : `Loading ${file.name}...`;
      const loadingToast = toast.loading(loadingMessage);

      try {
        let buffer: ArrayBuffer;
        let info: SamplingInfo;

        if (isLargeFile) {
          // For large files, create intelligent sample
          console.log(
            `File ${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB - using sampled analysis`,
          );

          // Fetch the file blob first
          const response = await fetch(
            `${API_BASE_URL}/get/binary/${encodeURIComponent(file.name)}`,
          );
          if (!response.ok)
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          const blob = await response.blob();

          // Create sampled buffer
          const sampledData = await createSampledBuffer(
            new File([blob], file.name),
          );
          buffer = sampledData.buffer;
          info = sampledData.info;
        } else {
          // For small files, load normally
          buffer = await fetchBinaryFile(file.name);
          info = {
            isSampled: false,
            originalSize: file.size,
            sampleSize: buffer.byteLength,
            strategy: "full",
          };
        }

        // Store in file object for caching
        file.buffer = buffer;
        setCurrentBuffer(buffer);
        setSamplingInfo(info);

        const successMessage = info.isSampled
          ? `Sampled ${(info.sampleSize / (1024 * 1024)).toFixed(1)} MB from ${(info.originalSize / (1024 * 1024)).toFixed(1)} MB file`
          : `Loaded ${file.name} (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB)`;

        toast.success(successMessage, { id: loadingToast });
      } catch (err) {
        console.error("Failed to load file:", err);
        toast.error(`Failed to load ${file.name}`, { id: loadingToast });
        setCurrentBuffer(null);
        setSamplingInfo(null);
      } finally {
        setIsLoadingBuffer(false);
      }
    };

    loadBuffer();
  }, [currentFile, files]);

  const {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    selectRange,
  } = useHexSelection(currentBuffer);

  const {
    yamlText,
    highlights: yamlHighlights,
    updateYaml,
  } = useYamlConfig(currentBuffer, currentFile);

  // Combine YAML highlights with search highlights
  const highlights = [...yamlHighlights, ...searchHighlights];

  const {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    getBookmarkAtOffset,
  } = useBookmarks(currentFile);

  const handleFileAdd = useCallback((file: File, buffer: ArrayBuffer) => {
    const newFile: FileData = {
      name: file.name,
      size: buffer.byteLength,
      buffer,
    };
    setFiles((prev) => [...prev, newFile]);
    setCurrentFile(file.name);
  }, []);

  const handleFileRemove = useCallback((fileName: string) => {
    setFileToDelete(fileName);
    setDeleteDialogOpen(true);
  }, []);

  const confirmFileDelete = useCallback(async () => {
    if (!fileToDelete) return;

    setIsDeletingFile(true);
    const loadingToast = toast.loading(`Deleting ${fileToDelete}...`);

    try {
      const API_BASE_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000";

      // 1. Call backend DELETE
      const res = await fetch(`${API_BASE_URL}/delete/binary/${fileToDelete}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete file on server`);
      }

      // 2. Remove from local state
      setFiles((prev) => prev.filter((f) => f.name !== fileToDelete));

      // 3. Clear current file if needed
      if (currentFile === fileToDelete) {
        setCurrentFile(null);
      }

      toast.success(`Deleted "${fileToDelete}"`, { id: loadingToast });
    } catch (err: any) {
      console.error(err);
      toast.error(`Error deleting file: ${err.message}`, {
        id: loadingToast,
      });
    } finally {
      setIsDeletingFile(false);
      setFileToDelete(null);
    }
  }, [fileToDelete, currentFile, setFiles, setCurrentFile]);

  const handleFileRename = useCallback(
    (oldName: string, newName: string) => {
      // Update files array
      setFiles((prev) =>
        prev.map((f) => (f.name === oldName ? { ...f, name: newName } : f)),
      );

      // Update current file if needed
      if (currentFile === oldName) {
        setCurrentFile(newName);
      }
    },
    [currentFile],
  );

  const handleDecompressedFileSelect = useCallback(
    async (fileId: number, fileName: string) => {
      const loadingToast = toast.loading(`Loading ${fileName}...`);
      setIsLoadingBuffer(true);

      try {
        // Fetch decompressed file data
        const response = await fetch(
          `${API_BASE_URL}/decompressed/${fileId}/data`,
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch decompressed file: ${response.statusText}`,
          );
        }

        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();

        // Update state to display in hex viewer
        setCurrentFile(fileName);
        setCurrentBuffer(buffer);
        setSamplingInfo({
          isSampled: false,
          originalSize: buffer.byteLength,
          sampleSize: buffer.byteLength,
          strategy: "full",
        });

        toast.success(
          `Loaded ${fileName} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
          {
            id: loadingToast,
          },
        );
      } catch (err) {
        console.error("Failed to load decompressed file:", err);
        toast.error(`Failed to load ${fileName}`, { id: loadingToast });
      } finally {
        setIsLoadingBuffer(false);
      }
    },
    [],
  );

  const handleByteClick = useCallback(
    (offset: number) => {
      if (isSelecting) {
        updateSelection(offset);
        endSelection();
      } else {
        startSelection(offset);
      }
    },
    [isSelecting, startSelection, updateSelection, endSelection],
  );

  const handleByteMouseEnter = useCallback(
    (offset: number) => {
      if (isSelecting) {
        updateSelection(offset);
      }
    },
    [isSelecting, updateSelection],
  );

  const handleTagClick = useCallback(
    (offset: number) => {
      setScrollToOffset(offset);
      // Auto-select the highlight range (works for both tags and search matches)
      const highlight = highlights.find((h) => h.start === offset);
      if (highlight) {
        selectRange(highlight.start, highlight.end - 1);
      }
    },
    [highlights, selectRange],
  );

  const handleJumpToOffset = useCallback(
    (offset: number, length: number = 1) => {
      setScrollToOffset(offset);
      // Auto-select the byte(s) at this offset for visual feedback
      selectRange(offset, offset + length - 1);
    },
    [selectRange],
  );

  const handleSearchResults = useCallback(
    (results: Array<{ offset: number; length?: number; type: string }>) => {
      // Convert search results to highlights
      const newHighlights = results.map((result, index) => ({
        start: result.offset,
        end: result.offset + (result.length || 1),
        color: "#fbbf24",
        type: "search",
        name: `${result.type} #${index + 1}`,
        label: `Match: ${result.type}`,
      }));
      setSearchHighlights(newHighlights);
    },
    [],
  );

  const handleClearSearchHighlights = useCallback(() => {
    setSearchHighlights([]);
  }, []);

  const handleLoadConfig = useCallback(
    (name: string, yaml: string) => {
      setCurrentConfigName(name);
      updateYaml(yaml);
    },
    [updateYaml],
  );

  const handleConfigSaved = useCallback(() => {
    setRefreshConfigList((prev) => prev + 1);
  }, []);

  const loadFilesFromBackend = useCallback(async () => {
    setIsLoadingFiles(true);
    const loadingToast = toast.loading("Loading file metadata...");

    try {
      const list = await fetchBinaryList();

      if (list.length === 0) {
        toast.info("No files found. Upload a binary file to get started.", {
          id: loadingToast,
        });
        setIsLoadingFiles(false);
        return;
      }

      // Only load metadata (id, name, size) - NOT the actual file data!
      // File data will be loaded on-demand in chunks
      const loaded: FileData[] = list.map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        // No buffer - files are loaded via chunk manager on demand
      }));

      setFiles(loaded);

      if (loaded.length > 0) {
        // Check if the previously selected file still exists
        const savedFile = localStorage.getItem("selectedBinaryFile");
        const fileExists =
          savedFile && loaded.some((f) => f.name === savedFile);

        if (fileExists) {
          setCurrentFile(savedFile);
        } else {
          // If saved file doesn't exist, select the first one
          setCurrentFile(loaded[0].name);
        }
      }

      toast.success(
        `Loaded ${loaded.length} file(s) (${(loaded.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(1)} MB total)`,
        { id: loadingToast },
      );
    } catch (err) {
      console.error("Failed loading binary list:", err);
      toast.error("Failed to load files from server", { id: loadingToast });
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    loadFilesFromBackend();
  }, [loadFilesFromBackend]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">
              ECG Analysis Workbench
            </h1>
            <p className="text-xs text-muted-foreground">
              Binary format reverse engineering for medical devices
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/chat")}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            AI Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            AI Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/ecg-viewer")}
            className="gap-2"
          >
            <LineChart className="h-4 w-4" />
            Sample Viewer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/huffman-analysis")}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Huffman
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/documentation")}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </Button>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel */}
          <ResizablePanel
            defaultSize={selectTab === "compression" ? 40 : 22}
            minSize={15}
            maxSize={selectTab === "compression" ? 60 : 35}
          >
            <Tabs defaultValue="files" className="h-full flex flex-col">
              <TabsList className="grid w-full h-auto grid-cols-3 rounded-none border-b border-panel-border">
                <TabsTrigger
                  onClick={() => setSelectTab("files")}
                  value="files"
                  className="gap-1.5"
                >
                  <FolderOpen className="h-4 w-4" />
                  Files
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("yaml")}
                  value="yaml"
                  className="gap-1.5"
                >
                  <FileCode className="h-4 w-4" />
                  Config
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("patterns")}
                  value="patterns"
                  className="gap-1.5"
                >
                  <GitBranch className="h-4 w-4" />
                  Patterns
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("analysis")}
                  value="analysis"
                  className="gap-1.5"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("compare")}
                  value="compare"
                  className="gap-1.5"
                >
                  <GitCompare className="h-4 w-4" />
                  Compare
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("info")}
                  value="info"
                  className="gap-1.5"
                >
                  <Info className="h-4 w-4" />
                  Info
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("compression")}
                  value="compression"
                  className="gap-1.5"
                >
                  <FileArchive className="h-4 w-4" />
                  Compression
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="files"
                className={
                  selectTab === "files"
                    ? "flex-1 m-0 flex flex-col overflow-hidden bg-background"
                    : "hidden"
                }
              >
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize={60} minSize={30}>
                    <FilePanel
                      files={files}
                      currentFile={currentFile}
                      onFileSelect={setCurrentFile}
                      onFileAdd={handleFileAdd}
                      onFileRemove={handleFileRemove}
                      onFileRename={handleFileRename}
                      isLoading={isLoadingFiles}
                      isDeleting={isDeletingFile}
                    />
                  </ResizablePanel>
                  <ResizableHandle />
                </ResizablePanelGroup>
              </TabsContent>
              <TabsContent
                value="yaml"
                className={
                  selectTab === "yaml"
                    ? "flex-1 m-0 flex flex-col overflow-hidden bg-background"
                    : "hidden"
                }
              >
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
                    <YamlConfigList
                      onLoadConfig={handleLoadConfig}
                      onRefresh={handleConfigSaved}
                      key={refreshConfigList}
                    />
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={65} minSize={40}>
                    <YamlEditor
                      value={yamlText}
                      onChange={updateYaml}
                      currentConfigName={currentConfigName}
                      onConfigSaved={handleConfigSaved}
                      buffer={currentBuffer}
                      fileName={currentFile}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </TabsContent>
              <TabsContent
                value="patterns"
                className={
                  selectTab === "patterns"
                    ? "flex-1 m-0 flex flex-col overflow-hidden bg-background"
                    : "hidden"
                }
              >
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize={50} minSize={30}>
                    <PatternSearch
                      buffer={currentBuffer}
                      onJumpToOffset={handleJumpToOffset}
                      onSearchResults={handleSearchResults}
                      onClearHighlights={handleClearSearchHighlights}
                    />
                  </ResizablePanel>
                  <ResizableHandle />
                </ResizablePanelGroup>
              </TabsContent>
              <TabsContent
                value="analysis"
                className={
                  selectTab === "analysis"
                    ? "flex-1 m-0 overflow-hidden bg-background"
                    : "hidden"
                }
              >
                <AdvancedVisualizations
                  buffer={currentBuffer}
                  highlights={highlights}
                  samplingInfo={samplingInfo}
                  fileName={currentFile}
                />
              </TabsContent>
              <TabsContent
                value="compare"
                className={
                  selectTab === "compare"
                    ? "flex-1 m-0 overflow-hidden bg-background"
                    : "hidden"
                }
              >
                <ComparisonPanel files={files} />
              </TabsContent>
              <TabsContent
                value="info"
                className={
                  selectTab === "info"
                    ? "flex-1 m-0 overflow-hidden bg-background"
                    : "hidden"
                }
              >
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                    <FileInfo fileName={currentFile} buffer={currentBuffer} />
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                    <ByteStatistics buffer={currentBuffer} />
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={40} minSize={30}>
                    <BookmarkPanel
                      bookmarks={bookmarks}
                      selection={selection}
                      onAddBookmark={addBookmark}
                      onRemoveBookmark={removeBookmark}
                      onUpdateBookmark={updateBookmark}
                      onJumpToOffset={handleJumpToOffset}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </TabsContent>
              <TabsContent
                value="compression"
                className={
                  selectTab === "compression"
                    ? "flex-1 m-0 overflow-hidden bg-background"
                    : "hidden"
                }
              >
                <CompressionDetection
                  fileId={files.find((f) => f.name === currentFile)?.id || 0}
                  fileName={currentFile || ""}
                  selection={selection}
                  currentBuffer={currentBuffer}
                  onFilesRefresh={loadFilesFromBackend}
                />
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel - Hex Viewer */}
          <ResizablePanel
            defaultSize={selectTab === "compression" ? 30 : 48}
            minSize={selectTab === "compression" ? 20 : 40}
          >
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-panel-border bg-panel-header">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {files.length > 0 ? (
                      <Select
                        value={currentFile || ""}
                        onValueChange={setCurrentFile}
                      >
                        <SelectTrigger className="w-[250px] h-8 text-sm">
                          <SelectValue placeholder="Select a file..." />
                        </SelectTrigger>
                        <SelectContent>
                          {files.map((file) => (
                            <SelectItem
                              key={file.name}
                              value={file.name}
                              className="text-sm"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-mono">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {(file.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <h2 className="text-sm font-semibold text-foreground">
                        Hex Viewer
                      </h2>
                    )}
                    {currentBuffer && (
                      <span className="text-xs text-muted-foreground">
                        {(currentBuffer.byteLength / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                  <CopyAsMenu selection={selection} />
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                {isLoadingBuffer && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      <p className="text-sm text-muted-foreground">
                        Loading file...
                      </p>
                    </div>
                  </div>
                )}
                <HexViewer
                  buffer={currentBuffer}
                  fileName={currentFile || undefined}
                  fileSize={
                    currentFile
                      ? files.find((f) => f.name === currentFile)?.size
                      : undefined
                  }
                  highlights={highlights}
                  selection={selection}
                  onByteClick={handleByteClick}
                  onByteMouseEnter={handleByteMouseEnter}
                  scrollToOffset={scrollToOffset}
                  onClearSelection={clearSelection}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel */}
          <ResizablePanel
            defaultSize={selectTab === "compression" ? 30 : 30}
            minSize={20}
            maxSize={40}
          >
            <ResizablePanelGroup direction="vertical">
              {/* Top Panel - Tabs for Highlights/Notes */}
              <ResizablePanel defaultSize={40} minSize={10}>
                <Tabs defaultValue="highlights" className="h-full flex flex-col">
                  <TabsList className="grid w-full h-auto grid-cols-2 rounded-none border-b border-panel-border">
                    <TabsTrigger value="highlights" className="gap-1.5">
                      Highlights
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="gap-1.5">
                      Notes
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="highlights"
                    className="flex-1 m-0 overflow-hidden"
                  >
                    <TagList
                      highlights={highlights}
                      onTagClick={handleTagClick}
                      hoveredTag={hoveredTag}
                      onTagHover={setHoveredTag}
                    />
                  </TabsContent>

                  <TabsContent
                    value="notes"
                    className="flex-1 m-0 overflow-hidden"
                  >
                    <NotesPanel
                      fileName={currentFile}
                      onJumpToOffset={handleJumpToOffset}
                    />
                  </TabsContent>
                </Tabs>
              </ResizablePanel>

              <ResizableHandle />

              {/* Bottom Panel - ECG Inspector (always visible) */}
              <ResizablePanel defaultSize={60} minSize={30}>
                <ECGInspector selection={selection} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmFileDelete}
        title="Delete Binary File?"
        description={
          fileToDelete
            ? `Are you sure you want to delete "${fileToDelete}"? This action cannot be undone.`
            : "Are you sure you want to delete this file? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};

export default Index;
