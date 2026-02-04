import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  createHuffmanTable, 
  analyzeHuffmanPatterns,
  type HuffmanTableEntry 
} from "@/services/huffmanApi";
import { 
  Search, 
  Plus, 
  BarChart3, 
  Binary, 
  Sparkles,
  Trash2,
  Loader2
} from "lucide-react";

interface HuffmanPatternAnalyzerProps {
  fileId: number | null;
  startOffset: number;
  endOffset: number;
  onTableCreated: (table: any) => void;
}

interface DetectedPattern {
  pattern: string;
  length: number;
  count: number;
  percentage: number;
  selected: boolean;
}

export function HuffmanPatternAnalyzer({
  fileId,
  startOffset,
  endOffset,
  onTableCreated,
}: HuffmanPatternAnalyzerProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [maxCodeLength, setMaxCodeLength] = useState(8);
  const [detectedPatterns, setDetectedPatterns] = useState<DetectedPattern[]>([]);
  const [tableName, setTableName] = useState("");
  const [totalBits, setTotalBits] = useState(0);

  // Analyze bit patterns via backend
  const analyzePatterns = async () => {
    if (!fileId || startOffset >= endOffset) {
      toast({
        title: "Error",
        description: "Please select a valid file section",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const result = await analyzeHuffmanPatterns({
        file_id: fileId,
        offset: startOffset,
        length: endOffset - startOffset,
        max_code_length: maxCodeLength,
      });

      // Calculate percentages and add selection state
      const patterns: DetectedPattern[] = result.patterns.map((p: any) => ({
        pattern: p.pattern,
        length: p.length,
        count: p.count,
        percentage: (p.count / result.total_bits) * 100,
        selected: true,
      }));

      setDetectedPatterns(patterns);
      setTotalBits(result.total_bits);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${patterns.length} potential patterns`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle pattern selection
  const togglePattern = (index: number) => {
    setDetectedPatterns(prev => 
      prev.map((pattern, i) => 
        i === index ? { ...pattern, selected: !pattern.selected } : pattern
      )
    );
  };

  // Remove pattern
  const removePattern = (index: number) => {
    setDetectedPatterns(prev => prev.filter((_, i) => i !== index));
  };

  // Create table from selected patterns
  const createTableFromPatterns = async () => {
    const selectedPatterns = detectedPatterns.filter(p => p.selected);
    
    if (selectedPatterns.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one pattern",
        variant: "destructive",
      });
      return;
    }

    if (!tableName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a table name",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create entries with sequential symbols
      const entries: HuffmanTableEntry[] = selectedPatterns.map((pattern, index) => ({
        symbol: index,
        code_length: pattern.length,
        code: pattern.pattern,
      }));

      const table = await createHuffmanTable({
        name: tableName,
        description: `Auto-generated from pattern analysis of 0x${startOffset.toString(16)}-0x${endOffset.toString(16)}`,
        entries,
      });

      onTableCreated(table);
      
      toast({
        title: "Success",
        description: `Table "${tableName}" created with ${entries.length} entries`,
      });

      // Reset
      setDetectedPatterns([]);
      setTableName("");
      setTotalBits(0);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to create table: ${error}`,
        variant: "destructive",
      });
    }
  };

  // Group patterns by length
  const groupedByLength = detectedPatterns.reduce((acc, pattern) => {
    if (!acc[pattern.length]) {
      acc[pattern.length] = [];
    }
    acc[pattern.length].push(pattern);
    return acc;
  }, {} as Record<number, DetectedPattern[]>);

  const sortedLengths = Object.keys(groupedByLength)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Pattern Analyzer
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden space-y-4">
        {/* Analysis Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Max Code Length:</Label>
            <Input
              type="number"
              min={1}
              max={16}
              value={maxCodeLength}
              onChange={(e) => setMaxCodeLength(parseInt(e.target.value) || 8)}
              className="h-8 w-20 text-xs"
            />
            <Button
              size="sm"
              onClick={analyzePatterns}
              disabled={isAnalyzing || !fileId}
              className="ml-auto gap-1"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </div>

        {detectedPatterns.length > 0 && (
          <>
            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {detectedPatterns.filter(p => p.selected).length} of {detectedPatterns.length} selected
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDetectedPatterns(prev => prev.map(p => ({ ...p, selected: true })))}
              >
                Select All
              </Button>
            </div>

            {/* Detected Patterns */}
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-3 space-y-4">
                {sortedLengths.map((length) => (
                  <div key={length} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Binary className="h-3 w-3" />
                      {length} bits ({groupedByLength[length].length} patterns)
                    </div>
                    
                    <div className="space-y-1">
                      {groupedByLength[length].map((pattern, idx) => {
                        const originalIndex = detectedPatterns.findIndex(
                          p => p.pattern === pattern.pattern && p.length === pattern.length
                        );
                        return (
                          <div
                            key={originalIndex}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              pattern.selected 
                                ? "bg-primary/10 border border-primary/30" 
                                : "bg-muted/30 border border-transparent hover:bg-muted/50"
                            }`}
                            onClick={() => togglePattern(originalIndex)}
                          >
                            <div className="w-6 h-6 flex items-center justify-center rounded bg-background border">
                              {pattern.selected && <div className="w-3 h-3 rounded-sm bg-primary" />}
                            </div>
                            
                            <code className="font-mono text-sm w-24">
                              {pattern.pattern}
                            </code>
                            
                            <div className="flex-1">
                              <Progress value={pattern.percentage} className="h-1.5" />
                            </div>
                            
                            <div className="text-xs text-muted-foreground w-16 text-right">
                              {pattern.count}×
                            </div>
                            
                            <div className="text-xs font-semibold w-12 text-right">
                              {pattern.percentage.toFixed(1)}%
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                removePattern(originalIndex);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Create Table */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Table name..."
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={createTableFromPatterns}
                  disabled={detectedPatterns.filter(p => p.selected).length === 0 || !tableName.trim()}
                  className="gap-1 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Create Table
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Selected patterns will be assigned symbols 0, 1, 2, etc.
              </p>
            </div>
          </>
        )}

        {detectedPatterns.length === 0 && !isAnalyzing && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Click Analyze to detect patterns</p>
              <p className="text-xs mt-1">
                Select a file section first
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
