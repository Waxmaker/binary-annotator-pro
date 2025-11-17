import { useState, useCallback } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilePanel } from '@/components/FilePanel';
import { YamlEditor } from '@/components/YamlEditor';
import { HexViewer } from '@/components/HexViewer';
import { TagList } from '@/components/TagList';
import { ECGInspector } from '@/components/ECGInspector';
import { PatternFinder } from '@/components/PatternFinder';
import { KaitaiGenerator } from '@/components/KaitaiGenerator';
import { useHexSelection } from '@/hooks/useHexSelection';
import { useYamlConfig } from '@/hooks/useYamlConfig';
import { Activity, FileCode } from 'lucide-react';

interface FileData {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}

const Index = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

  const currentBuffer =
    currentFile ? files.find((f) => f.name === currentFile)?.buffer || null : null;

  const {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    selectRange,
  } = useHexSelection(currentBuffer);

  const { yamlText, config, error, highlights, updateYaml } = useYamlConfig(currentBuffer);

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
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    if (currentFile === fileName) {
      setCurrentFile(null);
    }
  }, [currentFile]);

  const handleByteClick = useCallback(
    (offset: number) => {
      if (isSelecting) {
        updateSelection(offset);
        endSelection();
      } else {
        startSelection(offset);
      }
    },
    [isSelecting, startSelection, updateSelection, endSelection]
  );

  const handleByteMouseEnter = useCallback(
    (offset: number) => {
      if (isSelecting) {
        updateSelection(offset);
      }
    },
    [isSelecting, updateSelection]
  );

  const handleTagClick = useCallback(
    (offset: number) => {
      setScrollToOffset(offset);
      // Auto-select the tag range
      const highlight = highlights.find(
        (h) => h.start === offset && h.type === 'tag'
      );
      if (highlight) {
        selectRange(highlight.start, highlight.end - 1);
      }
    },
    [highlights, selectRange]
  );

  const handleJumpToOffset = useCallback((offset: number) => {
    setScrollToOffset(offset);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center px-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">ECG Analysis Workbench</h1>
            <p className="text-xs text-muted-foreground">Binary format reverse engineering for medical devices</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel */}
          <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
            <Tabs defaultValue="files" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-panel-border">
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="yaml">YAML Config</TabsTrigger>
              </TabsList>
              <TabsContent value="files" className="flex-1 m-0 flex flex-col overflow-hidden">
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
                  <KaitaiGenerator
                    config={config}
                    fileName={currentFile}
                  />
                </div>
              </TabsContent>
              <TabsContent value="yaml" className="flex-1 m-0">
                <YamlEditor
                  value={yamlText}
                  onChange={updateYaml}
                  error={error}
                />
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
                    {currentFile || 'Hex Viewer'}
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
