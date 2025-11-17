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
import { SelectionInspector } from '@/components/SelectionInspector';
import { useHexSelection } from '@/hooks/useHexSelection';
import { useYamlConfig } from '@/hooks/useYamlConfig';
import { Binary } from 'lucide-react';

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

  const { yamlText, error, highlights, updateYaml } = useYamlConfig(currentBuffer);

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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center px-6">
        <div className="flex items-center gap-3">
          <Binary className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Binary Viewer</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <Tabs defaultValue="files" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-panel-border">
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
              </TabsList>
              <TabsContent value="files" className="flex-1 m-0">
                <FilePanel
                  files={files}
                  currentFile={currentFile}
                  onFileSelect={setCurrentFile}
                  onFileAdd={handleFileAdd}
                  onFileRemove={handleFileRemove}
                />
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
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-panel-border bg-panel-header">
                <h2 className="text-sm font-semibold text-foreground">
                  {currentFile || 'Hex Viewer'}
                </h2>
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
              <ResizablePanel defaultSize={50} minSize={30}>
                <TagList
                  highlights={highlights}
                  onTagClick={handleTagClick}
                  hoveredTag={hoveredTag}
                  onTagHover={setHoveredTag}
                />
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={50} minSize={30}>
                <SelectionInspector selection={selection} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Index;
