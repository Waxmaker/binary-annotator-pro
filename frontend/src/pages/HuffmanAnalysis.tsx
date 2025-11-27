import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Home,
  FileText,
  GitBranch,
  Code,
  Play,
  Download,
  Upload,
  Info,
  Zap,
  GripVertical,
  X,
  Plus,
} from "lucide-react";
import { fetchBinaryList, fetchBinaryFile } from "@/lib/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface HuffmanNode {
  symbol: string;
  frequency: number;
  code?: string;
  left?: HuffmanNode;
  right?: HuffmanNode;
}

interface HuffmanTreeNode {
  node: string;
  left: string;
  right: string;
}

interface HuffmanTable {
  [symbol: string]: {
    frequency: number;
    code: string;
    bits: number;
  };
}

interface BinaryFile {
  name: string;
  size: number;
}

const HuffmanAnalysis = () => {
  const navigate = useNavigate();
  const [binaryFiles, setBinaryFiles] = useState<BinaryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [currentBuffer, setCurrentBuffer] = useState<ArrayBuffer | null>(null);
  const [isLoadingBuffer, setIsLoadingBuffer] = useState(false);

  // Huffman analysis state
  const [huffmanTable, setHuffmanTable] = useState<HuffmanTable>({});
  const [huffmanTree, setHuffmanTree] = useState<HuffmanNode | null>(null);
  const [csvData, setCsvData] = useState<string>(`node,left,right
0,15,152
1,67,186
2,173,46
3,181,105
4,50,206
5,93,99
6,180,210
7,174,203
8,75,92
9,203,92
10,213,43
11,173,41`);
  const [treeNodes, setTreeNodes] = useState<HuffmanTreeNode[]>([]);
  const [encodedData, setEncodedData] = useState<string>("");
  const [decodedData, setDecodedData] = useState<string>("");
  const [analysisResults, setAnalysisResults] = useState<{
    totalNodes: number;
    maxDepth: number;
    compressionRatio: number;
    avgPathLength: number;
  } | null>(null);

  // Load binary files on mount
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const list = await fetchBinaryList();
        setBinaryFiles(list);
        if (list.length > 0) {
          setSelectedFile(list[0].name);
        }
      } catch (err) {
        console.error("Failed to load binary files:", err);
        toast.error("Failed to load binary files");
      }
    };
    loadFiles();
  }, []);

  // Load binary buffer when file is selected
  useEffect(() => {
    if (!selectedFile) {
      setCurrentBuffer(null);
      return;
    }

    const loadBinaryBuffer = async () => {
      setIsLoadingBuffer(true);
      try {
        const buffer = await fetchBinaryFile(selectedFile);
        setCurrentBuffer(buffer);
        toast.success(`Loaded ${selectedFile} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.error("Failed to load binary buffer:", err);
        toast.error(`Failed to load ${selectedFile}`);
        setCurrentBuffer(null);
      } finally {
        setIsLoadingBuffer(false);
      }
    };

    loadBinaryBuffer();
  }, [selectedFile]);

  // Parse CSV data using backend for large files
  const parseCSV = useCallback(async () => {
    try {
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        toast.error("CSV data must have header and at least one row");
        return;
      }

      // For large files (>1000 lines), use backend processing
      if (lines.length > 1000) {
        toast.loading("Processing large CSV on server...", { id: 'csv-processing' });
        
        try {
          const response = await fetch(`${API_BASE_URL}/huffman/parse-csv`, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain',
            },
            body: csvData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Server processing failed");
          }

          const result = await response.json();
          
          if (result.success && result.nodes) {
            setTreeNodes(result.nodes);
            toast.success(`Parsed ${result.nodes.length} tree nodes on server`, { id: 'csv-processing' });
          } else {
            throw new Error("Invalid server response");
          }
        } catch (err) {
          toast.error("Server processing failed, trying local...", { id: 'csv-processing' });
          
          // Fallback to local processing for smaller files
          if (lines.length <= 2000) {
            parseLocalCSV();
          } else {
            toast.error("File too large for local processing");
            return;
          }
        }
      } else {
        // For small files, process locally
        parseLocalCSV();
      }
    } catch (err) {
      console.error("Failed to parse CSV:", err);
      toast.error("Failed to parse CSV data");
    }
  }, [csvData]);

  // Local CSV parsing (fallback for small files)
  const parseLocalCSV = useCallback(() => {
    try {
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        toast.error("CSV data must have header and at least one row");
        return;
      }

      const header = lines[0].split(',').map(h => h.trim());
      if (header.length !== 3 || header[0] !== 'node' || header[1] !== 'left' || header[2] !== 'right') {
        toast.error("CSV must have format: node,left,right");
        return;
      }

      const nodes: HuffmanTreeNode[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === 3) {
          nodes.push({
            node: values[0],
            left: values[1],
            right: values[2],
          });
        }
      }

      setTreeNodes(nodes);
      toast.success(`Parsed ${nodes.length} tree nodes locally`);
    } catch (err) {
      console.error("Failed to parse CSV locally:", err);
      toast.error("Failed to parse CSV data");
    }
  }, [csvData]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvData(content);
      toast.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  }, []);

  // Build Huffman tree from CSV data using backend for large files
  const buildHuffmanTree = useCallback(async () => {
    try {
      if (treeNodes.length === 0) {
        toast.error("No tree nodes available. Parse CSV first.");
        return;
      }

      // For large files (>500 nodes), use backend to avoid stack overflow
      if (treeNodes.length > 500) {
        toast.loading("Processing large tree on server...", { id: 'processing' });
        
        try {
          const response = await fetch(`${API_BASE_URL}/huffman/build-tree`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nodes: treeNodes }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Server error: ${response.statusText}`);
          }

          const result = await response.json();
          
          if (result.success) {
            setHuffmanTree(result.tree);
            setHuffmanTable(result.table);
            setAnalysisResults(result.statistics);
            toast.success(`Huffman tree built successfully on server (${treeNodes.length} nodes)`, { id: 'processing' });
          } else {
            throw new Error(result.error || "Server processing failed");
          }
        } catch (err) {
          toast.error("Server processing failed, trying local...", { id: 'processing' });
          // Fallback to local processing for smaller files
          if (treeNodes.length <= 1000) {
            buildLocalTree();
          } else {
            toast.error("File too large for local processing");
            return;
          }
        }
      } else {
        // For small files, process locally
        buildLocalTree();
      }
    } catch (err) {
      console.error("Failed to build Huffman tree:", err);
      toast.error("Failed to build Huffman tree");
    }
  }, [treeNodes]);

  // Local tree building (for small files only)
  const buildLocalTree = useCallback(() => {
    try {
      // Create tree structure from CSV nodes
      const nodeMap = new Map<string, HuffmanNode>();
      
      // Create all nodes first
      treeNodes.forEach(csvNode => {
        nodeMap.set(csvNode.node, {
          symbol: csvNode.node,
          frequency: parseInt(csvNode.node) || 0,
        });
      });

      // Build tree structure
      const root = nodeMap.get('0'); // Assuming node 0 is root
      if (!root) {
        toast.error("Root node (0) not found");
        return;
      }

      treeNodes.forEach(csvNode => {
        const node = nodeMap.get(csvNode.node);
        if (node) {
          const leftNode = nodeMap.get(csvNode.left);
          const rightNode = nodeMap.get(csvNode.right);
          
          if (leftNode) node.left = leftNode;
          if (rightNode) node.right = rightNode;
        }
      });

      setHuffmanTree(root);

      // Generate Huffman codes from tree with stack to avoid recursion
      const table: HuffmanTable = {};
      const stack: { node: HuffmanNode; code: string }[] = [{ node: root, code: '' }];
      
      while (stack.length > 0) {
        const { node, code } = stack.pop()!;
        
        if (!node.left && !node.right) {
          table[node.symbol] = {
            frequency: node.frequency,
            code: code || '0',
            bits: code.length || 1,
          };
        }
        
        if (node.right) stack.push({ node: node.right, code: code + '1' });
        if (node.left) stack.push({ node: node.left, code: code + '0' });
      }

      setHuffmanTable(table);

      // Calculate statistics
      const totalNodes = treeNodes.length;
      const maxDepth = Math.max(...Object.values(table).map(item => item.bits));
      const avgPathLength = Object.values(table).reduce(
        (sum, item) => sum + item.bits, 0
      ) / Object.keys(table).length;
      const compressionRatio = maxDepth > 0 ? totalNodes / maxDepth : 1;

      setAnalysisResults({
        totalNodes,
        maxDepth,
        compressionRatio,
        avgPathLength,
      });

      toast.success(`Huffman tree built successfully locally (${treeNodes.length} nodes)`);
    } catch (err) {
      console.error("Failed to build Huffman tree locally:", err);
      toast.error("Failed to build Huffman tree");
    }
  }, [treeNodes]);

  // Encode sample data
  const encodeSampleData = useCallback(() => {
    if (Object.keys(huffmanTable).length === 0) {
      toast.error("Please parse Huffman table first");
      return;
    }

    // Sample data for demonstration
    const sampleData = "HEADER_MAGIC VERSION PATIENT_ID SAMPLE_NORMAL SAMPLE_NORMAL SAMPLE_ABNORMAL COMPRESSED_START SAMPLE_NORMAL COMPRESSED_END";
    const symbols = sampleData.split(' ');
    
    let encoded = '';
    symbols.forEach(symbol => {
      if (huffmanTable[symbol]) {
        encoded += huffmanTable[symbol].code + ' ';
      } else {
        encoded += '? ';
      }
    });

    setEncodedData(encoded.trim());
    toast.success("Sample data encoded");
  }, [huffmanTable]);

  // Decode sample data
  const decodeSampleData = useCallback(() => {
    if (!huffmanTree) {
      toast.error("Please parse Huffman table first");
      return;
    }

    if (!encodedData) {
      toast.error("Please encode data first");
      return;
    }

    const bits = encodedData.replace(/\s/g, '');
    let decoded = '';
    let current = huffmanTree;

    for (const bit of bits) {
      if (bit === '0' && current.left) {
        current = current.left;
      } else if (bit === '1' && current.right) {
        current = current.right;
      }

      if (!current.left && !current.right) {
        decoded += current.symbol + ' ';
        current = huffmanTree;
      }
    }

    setDecodedData(decoded.trim());
    toast.success("Data decoded");
  }, [huffmanTree, encodedData]);

  // Export Huffman table
  const exportTable = useCallback(() => {
    const data = {
      table: huffmanTable,
      tree: huffmanTree,
      analysis: analysisResults,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'huffman-table.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Huffman table exported");
  }, [huffmanTable, huffmanTree, analysisResults]);

  // Render Huffman tree (simplified text representation)
  const renderTree = (node: HuffmanNode | null, indent: string = ''): string => {
    if (!node) return '';
    if (!node.left && !node.right) {
      return `${indent}├─ ${node.symbol} (${node.frequency}) [${huffmanTable[node.symbol]?.code || 'N/A'}]\n`;
    }
    let result = `${indent}├─ ${node.symbol} (${node.frequency})\n`;
    if (node.left) result += renderTree(node.left, indent + '│  ');
    if (node.right) result += renderTree(node.right, indent + '│  ');
    return result;
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Huffman Analysis
            </h1>
            <p className="text-xs text-muted-foreground">
              Huffman coding analysis for ECG binary format reverse engineering
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Binary Workbench
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - File Selection & Table Setup */}
          <ResizablePanel defaultSize={35} minSize={30} maxSize={40}>
            <div className="h-full flex flex-col p-4 space-y-4">
              {/* File Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Binary File Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedFile} onValueChange={setSelectedFile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select binary file..." />
                    </SelectTrigger>
                    <SelectContent>
                      {binaryFiles.map((file) => (
                        <SelectItem key={file.name} value={file.name}>
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-mono text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentBuffer && (
                    <div className="text-xs text-muted-foreground">
                      Loaded: {(currentBuffer.byteLength / 1024).toFixed(1)} KB
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Huffman Table Setup */}
              <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Huffman Table Configuration
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Define symbols and their frequencies for Huffman coding
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-3">
                  {/* File Upload Section */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Upload CSV File</Label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                      />
                      <Button 
                        onClick={() => document.getElementById('csv-upload')?.click()}
                        size="sm" 
                        variant="outline"
                        className="flex-1"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Choose CSV File
                      </Button>
                    </div>
                  </div>

                  {/* CSV Textarea */}
                  <div className="flex-1 flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">CSV Tree Data</Label>
                      <Button onClick={parseCSV} size="sm" variant="outline">
                        <Zap className="h-3 w-3 mr-1" />
                        Parse CSV
                      </Button>
                    </div>
                    <textarea
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                      placeholder="node,left,right&#10;0,15,152&#10;1,67,186&#10;..."
                      className="flex-1 text-xs font-mono p-2 border rounded bg-muted resize-none"
                      spellCheck={false}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={buildHuffmanTree} size="sm" className="flex-1">
                      <GitBranch className="h-4 w-4 mr-2" />
                      Build Tree
                    </Button>
                    <Button onClick={exportTable} variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel - Analysis & Visualization */}
          <ResizablePanel defaultSize={40} minSize={35} maxSize={45}>
            <div className="h-full flex flex-col p-4">
              <Tabs defaultValue="table" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="table" className="text-xs">
                    <Code className="h-3 w-3 mr-1" />
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="tree" className="text-xs">
                    <GitBranch className="h-3 w-3 mr-1" />
                    Tree
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="text-xs">
                    <Info className="h-3 w-3 mr-1" />
                    Statistics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="table" className="flex-1 mt-4">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Huffman Codes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2">
                          {Object.entries(huffmanTable).map(([symbol, data]) => (
                            <div key={symbol} className="flex items-center justify-between p-2 rounded border">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {symbol}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  freq: {data.frequency}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                  {data.code}
                                </code>
                                <Badge variant="secondary" className="text-xs">
                                  {data.bits} bits
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tree" className="flex-1 mt-4">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Huffman Tree Structure</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <pre className="text-xs font-mono whitespace-pre">
                          {huffmanTree ? renderTree(huffmanTree) : 'No tree generated yet'}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stats" className="flex-1 mt-4">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Analysis Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analysisResults ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded border">
                              <div className="text-2xl font-bold">{analysisResults.totalNodes}</div>
                              <div className="text-xs text-muted-foreground">Total Nodes</div>
                            </div>
                            <div className="p-3 rounded border">
                              <div className="text-2xl font-bold">{analysisResults.maxDepth}</div>
                              <div className="text-xs text-muted-foreground">Max Depth</div>
                            </div>
                            <div className="p-3 rounded border">
                              <div className="text-2xl font-bold">{analysisResults.compressionRatio.toFixed(2)}x</div>
                              <div className="text-xs text-muted-foreground">Compression Ratio</div>
                            </div>
                            <div className="p-3 rounded border">
                              <div className="text-2xl font-bold">{analysisResults.avgPathLength.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">Avg Path Length</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Parse a Huffman table to see analysis results</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - Encoding/Decoding */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
            <div className="h-full flex flex-col p-4 space-y-4">
              <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Encoding/Decoding
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-3">
                  <div className="flex gap-2">
                    <Button onClick={encodeSampleData} size="sm" className="flex-1">
                      Encode Sample
                    </Button>
                    <Button onClick={decodeSampleData} variant="outline" size="sm" className="flex-1">
                      Decode Sample
                    </Button>
                  </div>

                  {encodedData && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Encoded Data:</label>
                      <ScrollArea className="h-32">
                        <div className="text-xs font-mono bg-muted p-2 rounded">
                          {encodedData}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {decodedData && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Decoded Data:</label>
                      <ScrollArea className="h-32">
                        <div className="text-xs font-mono bg-muted p-2 rounded">
                          {decodedData}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Educational Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>
                      <strong>Huffman Coding:</strong> A lossless data compression algorithm that assigns variable-length codes to symbols based on their frequencies.
                    </p>
                    <p>
                      <strong>ECG Applications:</strong> Commonly used in medical devices to compress ECG signals while preserving diagnostic quality.
                    </p>
                    <p>
                      <strong>Reverse Engineering:</strong> Analyze Huffman tables to understand proprietary ECG format compression schemes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default HuffmanAnalysis;