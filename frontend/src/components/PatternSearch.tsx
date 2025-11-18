import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, TrendingUp, Zap, Database } from "lucide-react";
import {
  findHexPattern,
  findRepeatingPattern,
  findLeadBlocks,
} from "@/utils/searchPatterns";
import {
  searchByType,
  getDataTypeCategories,
  getDataTypeName,
  getDataTypeSize,
  DataType,
  TypeSearchResult,
} from "@/utils/typeSearch";
import { formatAddress } from "@/utils/binaryUtils";
import { toast } from "sonner";

interface PatternSearchProps {
  buffer: ArrayBuffer | null;
  onJumpToOffset: (offset: number, length?: number) => void;
}

interface SearchResult {
  offset: number;
  type: string;
  value?: any;
  length?: number;
}

export function PatternSearch({ buffer, onJumpToOffset }: PatternSearchProps) {
  const [hexPattern, setHexPattern] = useState("FF FF 11");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  // Type search state
  const [dataType, setDataType] = useState<DataType>("int32le");
  const [typeSearchValue, setTypeSearchValue] = useState("");

  const handleSearchPattern = () => {
    if (!buffer) {
      toast.error("No file loaded");
      return;
    }

    setSearching(true);
    try {
      const matches = findHexPattern(buffer, hexPattern);
      setResults(matches.map((m) => ({ offset: m.offset, type: "hex pattern" })));
      toast.success(`Found ${matches.length} matches`);
    } catch (e) {
      toast.error("Invalid hex pattern");
    } finally {
      setSearching(false);
    }
  };

  const handleSearchByType = () => {
    if (!buffer) {
      toast.error("No file loaded");
      return;
    }

    if (!typeSearchValue.trim()) {
      toast.error("Enter a value to search");
      return;
    }

    setSearching(true);
    try {
      const matches = searchByType(buffer, typeSearchValue, dataType);
      const typeSize = getDataTypeSize(dataType);
      setResults(
        matches.map((m: TypeSearchResult) => ({
          offset: m.offset,
          type: getDataTypeName(m.type),
          value: m.value,
          length: typeSize || (typeof m.value === 'string' ? m.value.length : 1),
        }))
      );
      toast.success(`Found ${matches.length} matches`);
    } catch (e: any) {
      toast.error(`Search failed: ${e.message || "Invalid input"}`);
    } finally {
      setSearching(false);
    }
  };

  const handleFindRepeating = () => {
    if (!buffer) {
      toast.error("No file loaded");
      return;
    }

    setSearching(true);
    try {
      const patterns = findRepeatingPattern(buffer, 2, 8, 3);
      const allOffsets = patterns.flatMap((p) =>
        p.offsets.map((offset) => ({ offset, type: "repeating" }))
      );
      setResults(allOffsets.slice(0, 100));
      toast.success(`Found ${patterns.length} repeating patterns`);
    } catch (e) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleFindLeads = () => {
    if (!buffer) {
      toast.error("No file loaded");
      return;
    }

    setSearching(true);
    try {
      const blocks = findLeadBlocks(buffer, 12, 1000);
      setResults(blocks.map((b) => ({ offset: b.offset, type: "ECG lead" })));
      toast.success(`Found ${blocks.length} potential lead blocks`);
    } catch (e) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const dataTypeCategories = getDataTypeCategories();

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Pattern Search</h3>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="hex" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hex">Hex Pattern</TabsTrigger>
            <TabsTrigger value="type">
              <Database className="h-3 w-3 mr-1" />
              By Type
            </TabsTrigger>
            <TabsTrigger value="quick">Quick</TabsTrigger>
          </TabsList>

          {/* Hex Pattern Search */}
          <TabsContent value="hex" className="space-y-3">
            <Card className="p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Hex Pattern (space-separated)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={hexPattern}
                    onChange={(e) => setHexPattern(e.target.value)}
                    placeholder="FF FF 11"
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={handleSearchPattern}
                    disabled={searching || !buffer}
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Type-based Search */}
          <TabsContent value="type" className="space-y-3">
            <Card className="p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Data Type</label>
                <Select
                  value={dataType}
                  onValueChange={(val) => setDataType(val as DataType)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(dataTypeCategories).map(([category, types]) => (
                      <SelectGroup key={category}>
                        <SelectLabel>{category}</SelectLabel>
                        {types.map((type) => (
                          <SelectItem key={type} value={type} className="text-xs">
                            {getDataTypeName(type)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Value to Search
                </label>
                <div className="flex gap-2">
                  <Input
                    value={typeSearchValue}
                    onChange={(e) => setTypeSearchValue(e.target.value)}
                    placeholder={
                      dataType.includes("string")
                        ? "Enter text..."
                        : dataType.includes("timestamp")
                        ? "2024-01-01"
                        : dataType.includes("float")
                        ? "3.14159"
                        : "42"
                    }
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={handleSearchByType}
                    disabled={searching || !buffer}
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {dataType.includes("timestamp")
                    ? "Format: YYYY-MM-DD or full ISO date"
                    : dataType.includes("float")
                    ? "Decimal number (uses 0.01% tolerance)"
                    : dataType.includes("string")
                    ? "Case-sensitive text search"
                    : "Integer value in decimal"}
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* Quick Analysis */}
          <TabsContent value="quick" className="space-y-3">
            <Card className="p-4 space-y-3">
              <label className="text-xs text-muted-foreground">
                Quick Pattern Analysis
              </label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  onClick={handleFindRepeating}
                  disabled={searching || !buffer}
                  className="justify-start"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Find Repeating Patterns
                </Button>
                <Button
                  variant="outline"
                  onClick={handleFindLeads}
                  disabled={searching || !buffer}
                  className="justify-start"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Detect ECG Lead Blocks
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {results.length > 0 && (
          <Card className="p-4 space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold">
                Results ({results.length})
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setResults([])}
                className="h-7 text-xs"
              >
                Clear
              </Button>
            </div>
            <div className="max-h-64 overflow-auto space-y-1">
              {results.map((result, i) => (
                <Card
                  key={i}
                  className="p-3 cursor-pointer hover:bg-accent/10 transition-colors"
                  onClick={() => onJumpToOffset(result.offset, result.length)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-hex-address">
                        {formatAddress(result.offset)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {result.type}
                      </div>
                    </div>
                    {result.value !== undefined && (
                      <div className="text-[10px] font-mono bg-muted px-2 py-1 rounded">
                        {typeof result.value === "string"
                          ? result.value.length > 20
                            ? result.value.substring(0, 20) + "..."
                            : result.value
                          : String(result.value)}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
