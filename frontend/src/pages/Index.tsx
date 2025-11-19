import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
} from "lucide-react";
import { useEffect } from "react";
import { fetchBinaryList, fetchBinaryFile } from "@/lib/api";
import { ByteStatistics } from "@/components/ByteStatistics";
import { FileInfo } from "@/components/FileInfo";
import { BookmarkPanel } from "@/components/BookmarkPanel";
import { CopyAsMenu } from "@/components/CopyAsMenu";
import { useBookmarks } from "@/hooks/useBookmarks";
import { PatternSearch } from "@/components/PatternSearch";
import { PatternClustering } from "@/components/PatternClustering";
import { SettingsDialog } from "@/components/SettingsDialog";
import { HighlightRange } from "@/utils/colorUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileData {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}

const Index = () => {
  const navigate = useNavigate();
  const [selectTab, setSelectTab] = useState<string>("files");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
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

  const currentBuffer = currentFile
    ? files.find((f) => f.name === currentFile)?.buffer || null
    : null;

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
    config,
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

  const handleFileRemove = useCallback(
    async (fileName: string) => {
      if (!confirm(`Delete "${fileName}"?`)) return;

      setIsDeletingFile(true);
      const loadingToast = toast.loading(`Deleting ${fileName}...`);

      try {
        const API_BASE_URL =
          import.meta.env.VITE_API_URL || "http://localhost:3000";

        // 1. Call backend DELETE
        const res = await fetch(`${API_BASE_URL}/delete/binary/${fileName}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          throw new Error(`Failed to delete file on server`);
        }

        // 2. Remove from local state
        setFiles((prev) => prev.filter((f) => f.name !== fileName));

        // 3. Clear current file if needed
        if (currentFile === fileName) {
          setCurrentFile(null);
        }

        toast.success(`Deleted "${fileName}"`, { id: loadingToast });
      } catch (err: any) {
        console.error(err);
        toast.error(`Error deleting file: ${err.message}`, { id: loadingToast });
      } finally {
        setIsDeletingFile(false);
      }
    },
    [currentFile, setFiles, setCurrentFile],
  );

  const handleFileRename = useCallback(
    (oldName: string, newName: string) => {
      // Update files array
      setFiles((prev) =>
        prev.map((f) => (f.name === oldName ? { ...f, name: newName } : f))
      );

      // Update current file if needed
      if (currentFile === oldName) {
        setCurrentFile(newName);
      }
    },
    [currentFile]
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

  useEffect(() => {
    const loadFilesFromBackend = async () => {
      setIsLoadingFiles(true);
      const loadingToast = toast.loading("Loading binary files...");

      try {
        const list = await fetchBinaryList();

        if (list.length === 0) {
          toast.info("No files found. Upload a binary file to get started.", { id: loadingToast });
          setIsLoadingFiles(false);
          return;
        }

        const loaded: FileData[] = [];

        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          toast.loading(`Loading files... (${i + 1}/${list.length})`, { id: loadingToast });

          const buffer = await fetchBinaryFile(item.name);

          loaded.push({
            name: item.name,
            size: buffer.byteLength,
            buffer,
          });
        }

        setFiles(loaded);

        if (loaded.length > 0) {
          setCurrentFile(loaded[0].name);
        }

        toast.success(`Loaded ${loaded.length} file(s)`, { id: loadingToast });
      } catch (err) {
        console.error("Failed loading binary list:", err);
        toast.error("Failed to load files from server", { id: loadingToast });
      } finally {
        setIsLoadingFiles(false);
      }
    };

    loadFilesFromBackend();
  }, []);

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
          <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
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
              </TabsList>
              <TabsContent
                value="files"
                className={
                  selectTab === "files"
                    ? "flex-1 m-0 flex flex-col overflow-hidden bg-background"
                    : "hidden"
                }
              >
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
                <AdvancedVisualizations buffer={currentBuffer} />
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
            </Tabs>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel - Hex Viewer */}
          <ResizablePanel defaultSize={48} minSize={30}>
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
              <div className="flex-1 overflow-hidden">
                <HexViewer
                  buffer={currentBuffer}
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
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={40} minSize={25}>
                <TagList
                  highlights={highlights}
                  onTagClick={handleTagClick}
                  hoveredTag={hoveredTag}
                  onTagHover={setHoveredTag}
                />
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={60} minSize={30}>
                <ECGInspector selection={selection} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Index;
