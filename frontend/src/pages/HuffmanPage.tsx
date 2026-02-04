import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Home, Play, RotateCcw, Binary, Table2, FileOutput, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchBinaryList } from "@/lib/api";
import {
  listHuffmanTables,
  getHuffmanTable,
  decodeHuffmanSelection,
  type HuffmanTable,
  type HuffmanTableEntry,
} from "@/services/huffmanApi";
import { HuffmanTreeVisualizer } from "@/components/HuffmanTreeVisualizer";
import { HuffmanCodeTable } from "@/components/HuffmanCodeTable";
import { HuffmanBinaryView } from "@/components/HuffmanBinaryView";
import { HuffmanDecodedView } from "@/components/HuffmanDecodedView";
import { HuffmanEditor } from "@/components/HuffmanEditor";
import { HuffmanStats } from "@/components/HuffmanStats";

interface FileData {
  id: number;
  name: string;
  size: number;
}

interface DecodedResult {
  symbols: number[];
  bits: string[];
  symbolMap: Map<number, string>;
}

const STORAGE_KEY = "huffman-page-state";

const HuffmanPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // File selection state
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [fileData, setFileData] = useState<Uint8Array | null>(null);

  // Offset state
  const [startOffset, setStartOffset] = useState<number>(0);
  const [endOffset, setEndOffset] = useState<number>(0);

  // Huffman tables state
  const [tables, setTables] = useState<HuffmanTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<HuffmanTable | null>(null);

  // Decoding state
  const [decodedResult, setDecodedResult] = useState<DecodedResult | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<string>("tree");

  // Load initial state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.startOffset !== undefined) setStartOffset(state.startOffset);
        if (state.endOffset !== undefined) setEndOffset(state.endOffset);
        if (state.selectedTableId) setSelectedTableId(state.selectedTableId);
        if (state.activeTab) setActiveTab(state.activeTab);
      } catch (e) {
        console.error("Failed to load saved state:", e);
      }
    }
  }, []);

  // Save state
  useEffect(() => {
    const state = {
      startOffset,
      endOffset,
      selectedTableId,
      activeTab,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [startOffset, endOffset, selectedTableId, activeTab]);

  // Load files
  useEffect(() => {
    loadFiles();
    loadTables();
  }, []);

  const loadFiles = async () => {
    try {
      const list = await fetchBinaryList();
      setFiles(list.map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
      })));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive",
      });
    }
  };

  const loadTables = async () => {
    try {
      const list = await listHuffmanTables();
      setTables(list);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load Huffman tables",
        variant: "destructive",
      });
    }
  };

  // Load file data when selected
  useEffect(() => {
    if (selectedFileId) {
      loadFileData(selectedFileId);
    }
  }, [selectedFileId]);

  const loadFileData = async (fileId: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/get/binary-by-id/${fileId}`);
      if (!response.ok) throw new Error("Failed to load file");
      const buffer = await response.arrayBuffer();
      setFileData(new Uint8Array(buffer));
      
      // Auto-set end offset to file size
      const file = files.find(f => f.id === fileId);
      if (file) {
        setEndOffset(Math.min(1024, file.size)); // Default to first 1KB
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load file data",
        variant: "destructive",
      });
    }
  };

  // Load table details when selected
  useEffect(() => {
    if (selectedTableId) {
      loadTableDetails(selectedTableId);
    }
  }, [selectedTableId]);

  const loadTableDetails = async (tableId: number) => {
    try {
      const table = await getHuffmanTable(tableId);
      setSelectedTable(table);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load table details",
        variant: "destructive",
      });
    }
  };

  const handleDecode = async () => {
    if (!selectedFileId || !selectedTableId) {
      toast({
        title: "Error",
        description: "Please select a file and a Huffman table",
        variant: "destructive",
      });
      return;
    }

    if (startOffset >= endOffset) {
      toast({
        title: "Error",
        description: "Start offset must be less than end offset",
        variant: "destructive",
      });
      return;
    }

    setIsDecoding(true);
    try {
      const result = await decodeHuffmanSelection({
        table_id: selectedTableId,
        file_id: selectedFileId,
        offset: startOffset,
        length: endOffset - startOffset,
        bit_offset: 0,
      });

      // Build symbol to code map for visualization
      const symbolMap = new Map<number, string>();
      selectedTable?.entries?.forEach((entry: HuffmanTableEntry) => {
        symbolMap.set(entry.symbol, entry.code);
      });

      // Convert decoded symbols to bits for visualization
      const bits: string[] = [];
      result.decoded.forEach((symbol: number) => {
        const code = symbolMap.get(symbol);
        if (code) {
          bits.push(...code.split(""));
        }
      });

      setDecodedResult({
        symbols: result.decoded,
        bits,
        symbolMap,
      });

      toast({
        title: "Success",
        description: `Decoded ${result.count} symbols`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Decoding failed: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsDecoding(false);
    }
  };

  const handleReset = () => {
    setDecodedResult(null);
    setStartOffset(0);
    setEndOffset(0);
    setSelectedTableId(null);
    setSelectedTable(null);
  };

  const handleTableCreated = useCallback((table: HuffmanTable) => {
    loadTables();
    setSelectedTableId(table.id);
    toast({
      title: "Success",
      description: `Table "${table.name}" created`,
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Huffman Table Explorer
            </h1>
            <p className="text-xs text-muted-foreground">
              Educational tool for reverse engineering Huffman coding
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Binary Workbench
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - File Selection & Controls */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
              {/* File Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Select File</Label>
                <Select
                  value={selectedFileId?.toString() || ""}
                  onValueChange={(value) => {
                    const id = parseInt(value);
                    setSelectedFileId(id);
                    const file = files.find(f => f.id === id);
                    if (file) setSelectedFileName(file.name);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a binary file..." />
                  </SelectTrigger>
                  <SelectContent>
                    {files.map((file) => (
                      <SelectItem key={file.id} value={file.id.toString()}>
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-mono text-xs">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Offset Controls */}
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <Label className="text-sm font-semibold">Section Selection</Label>
                
                <div className="space-y-2">
                  <Label className="text-xs">Start Offset (hex)</Label>
                  <Input
                    type="text"
                    value={`0x${startOffset.toString(16).toUpperCase()}`}
                    onChange={(e) => {
                      const value = parseInt(e.target.value.replace(/^0x/i, ""), 16);
                      if (!isNaN(value)) setStartOffset(value);
                    }}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">End Offset (hex)</Label>
                  <Input
                    type="text"
                    value={`0x${endOffset.toString(16).toUpperCase()}`}
                    onChange={(e) => {
                      const value = parseInt(e.target.value.replace(/^0x/i, ""), 16);
                      if (!isNaN(value)) setEndOffset(value);
                    }}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  Size: {(endOffset - startOffset).toLocaleString()} bytes
                </div>
              </div>

              {/* Table Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Huffman Table</Label>
                <Select
                  value={selectedTableId?.toString() || ""}
                  onValueChange={(value) => setSelectedTableId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={table.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{table.name}</span>
                          {table.description && (
                            <span className="text-xs text-muted-foreground truncate">
                              {table.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleDecode}
                  disabled={!selectedFileId || !selectedTableId || isDecoding}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isDecoding ? "Decoding..." : "Decode"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={!decodedResult}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* Stats */}
              {decodedResult && selectedTable && (
                <HuffmanStats
                  decodedResult={decodedResult}
                  table={selectedTable}
                  fileSize={endOffset - startOffset}
                />
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel - Visualizations */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="mx-4 mt-2">
                <TabsTrigger value="tree" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  Tree View
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-2">
                  <Table2 className="h-4 w-4" />
                  Code Table
                </TabsTrigger>
                <TabsTrigger value="binary" className="gap-2">
                  <Binary className="h-4 w-4" />
                  Binary View
                </TabsTrigger>
                <TabsTrigger value="decoded" className="gap-2">
                  <FileOutput className="h-4 w-4" />
                  Decoded
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tree" className="flex-1 m-0 p-4">
                <HuffmanTreeVisualizer
                  table={selectedTable}
                  decodedResult={decodedResult}
                />
              </TabsContent>

              <TabsContent value="table" className="flex-1 m-0 p-4">
                <HuffmanCodeTable
                  table={selectedTable}
                  decodedResult={decodedResult}
                />
              </TabsContent>

              <TabsContent value="binary" className="flex-1 m-0 p-4">
                <HuffmanBinaryView
                  fileData={fileData}
                  startOffset={startOffset}
                  endOffset={endOffset}
                  decodedResult={decodedResult}
                  table={selectedTable}
                />
              </TabsContent>

              <TabsContent value="decoded" className="flex-1 m-0 p-4">
                <HuffmanDecodedView
                  decodedResult={decodedResult}
                  table={selectedTable}
                  fileName={selectedFileName}
                />
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - Editor */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <HuffmanEditor
              tables={tables}
              selectedTableId={selectedTableId}
              onTableSelect={setSelectedTableId}
              onTableCreated={handleTableCreated}
              onTablesChanged={loadTables}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default HuffmanPage;
