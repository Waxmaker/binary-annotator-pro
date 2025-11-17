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
import { PatternFinder } from "@/components/PatternFinder";
import { AdvancedVisualizations } from "@/components/AdvancedVisualizations";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { useHexSelection } from "@/hooks/useHexSelection";
import { useYamlConfig } from "@/hooks/useYamlConfig";
import { Activity, LineChart } from "lucide-react";
import { useEffect } from "react";
import { fetchBinaryList, fetchBinaryFile } from "@/lib/api";

interface FileData {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}

const Index = () => {
  const navigate = useNavigate();
  const [selectTab, setSelectTab] = useState<string>("files");
  const [files, setFiles] = useState<FileData[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [currentConfigName, setCurrentConfigName] = useState<
    string | undefined
  >(undefined);
  const [refreshConfigList, setRefreshConfigList] = useState(0);

  const currentBuffer = currentFile
    ? files.find((f) => f.name === currentFile)?.buffer || null
    : null;

  const {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    selectRange,
  } = useHexSelection(currentBuffer);

  const { yamlText, config, error, highlights, updateYaml } =
    useYamlConfig(currentBuffer);

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
      try {
        // 1. Call backend DELETE
        const res = await fetch(
          `http://localhost:3000/delete/binary/${fileName}`,
          {
            method: "DELETE",
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to delete file on server`);
        }

        // 2. Remove from local state
        setFiles((prev) => prev.filter((f) => f.name !== fileName));

        // 3. Clear current file if needed
        if (currentFile === fileName) {
          setCurrentFile(null);
        }

        toast.success(`Deleted "${fileName}"`);
      } catch (err: any) {
        console.error(err);
        toast.error(`Error deleting file: ${err.message}`);
      }
    },
    [currentFile, setFiles, setCurrentFile],
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
      // Auto-select the tag range
      const highlight = highlights.find(
        (h) => h.start === offset && h.type === "tag",
      );
      if (highlight) {
        selectRange(highlight.start, highlight.end - 1);
      }
    },
    [highlights, selectRange],
  );

  const handleJumpToOffset = useCallback((offset: number) => {
    setScrollToOffset(offset);
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
      try {
        const list = await fetchBinaryList();

        const loaded: FileData[] = [];

        for (const item of list) {
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
      } catch (err) {
        console.error("Failed loading binary list:", err);
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/ecg-viewer")}
          className="gap-2"
        >
          <LineChart className="h-4 w-4" />
          Sample Viewer
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel */}
          <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
            <Tabs defaultValue="files" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4 rounded-none border-b border-panel-border">
                <TabsTrigger
                  onClick={() => setSelectTab("files")}
                  value="files"
                >
                  Files
                </TabsTrigger>
                <TabsTrigger onClick={() => setSelectTab("yaml")} value="yaml">
                  Config
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("analysis")}
                  value="analysis"
                >
                  Analysis
                </TabsTrigger>
                <TabsTrigger
                  onClick={() => setSelectTab("compare")}
                  value="compare"
                >
                  Compare
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
                <div className="flex-1 overflow-auto">
                  <FilePanel
                    files={files}
                    currentFile={currentFile}
                    onFileSelect={setCurrentFile}
                    onFileAdd={handleFileAdd}
                    onFileRemove={handleFileRemove}
                  />
                </div>
                <div className="p-4 border-t border-panel-border space-y-3">
                  <PatternFinder
                    buffer={currentBuffer}
                    onJumpToOffset={handleJumpToOffset}
                  />
                </div>
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
                      error={error}
                      currentConfigName={currentConfigName}
                      onConfigSaved={handleConfigSaved}
                    />
                  </ResizablePanel>
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
            </Tabs>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel - Hex Viewer */}
          <ResizablePanel defaultSize={48} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-panel-border bg-panel-header">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    {currentFile || "Hex Viewer"}
                  </h2>
                  {currentBuffer && (
                    <span className="text-xs text-muted-foreground">
                      {(currentBuffer.byteLength / 1024).toFixed(1)} KB
                    </span>
                  )}
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
