import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listHuffmanTables,
  decodeHuffmanSelection,
  type HuffmanTable,
  type DecodeHuffmanResponse,
} from "@/services/huffmanApi";
import { HuffmanTableManager } from "./HuffmanTableManager";

interface HuffmanDecodeDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: number;
  fileName: string;
  offset: number;
  length: number;
}

export function HuffmanDecodeDialog({
  open,
  onClose,
  fileId,
  fileName,
  offset,
  length,
}: HuffmanDecodeDialogProps) {
  const [tables, setTables] = useState<HuffmanTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [bitOffset, setBitOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [decodeResult, setDecodeResult] = useState<DecodeHuffmanResponse | null>(null);
  const [showTableManager, setShowTableManager] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadTables();
    }
  }, [open]);

  const loadTables = async () => {
    try {
      const fetchedTables = await listHuffmanTables();
      setTables(fetchedTables);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to load tables: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleDecode = async () => {
    if (!selectedTableId) {
      toast({
        title: "Error",
        description: "Please select a Huffman table",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await decodeHuffmanSelection({
        table_id: selectedTableId,
        file_id: fileId,
        offset,
        length,
        bit_offset: bitOffset,
      });

      setDecodeResult(result);
      toast({
        title: "Success",
        description: `Decoded ${result.count} symbols`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to decode: ${error}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!decodeResult) return;

    // Create the file content
    const content = decodeResult.decoded.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    // Generate filename: huffman_originalfilename
    const baseFileName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const exportFileName = `huffman_${baseFileName}.txt`;

    // Download
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Exported to ${exportFileName}`,
    });
  };

  const handleReset = () => {
    setDecodeResult(null);
    setSelectedTableId(null);
    setBitOffset(0);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Huffman Decode</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File:</span>
                <span className="font-medium">{fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selection:</span>
                <span className="font-mono">
                  0x{offset.toString(16).toUpperCase()} - 0x
                  {(offset + length).toString(16).toUpperCase()} ({length} bytes)
                </span>
              </div>
            </div>

            {!decodeResult ? (
              <>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Huffman Table</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTableManager(true)}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Manage Tables
                    </Button>
                  </div>
                  <Select
                    value={selectedTableId?.toString() || ""}
                    onValueChange={(value) => setSelectedTableId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Huffman table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No tables available
                        </SelectItem>
                      ) : (
                        tables.map((table) => (
                          <SelectItem key={table.id} value={table.id.toString()}>
                            {table.name}
                            {table.description && ` - ${table.description}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bit-offset">Bit Offset (0-7)</Label>
                  <Input
                    id="bit-offset"
                    type="number"
                    min={0}
                    max={7}
                    value={bitOffset}
                    onChange={(e) => setBitOffset(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Start decoding from this bit within the first byte
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDecode}
                    disabled={loading || !selectedTableId}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Decoding...
                      </>
                    ) : (
                      "Decode"
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Decoded Symbols ({decodeResult.count} total)</Label>
                    <span className="text-sm text-muted-foreground">
                      Table: {decodeResult.table_name}
                    </span>
                  </div>
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm bg-muted">
                    {decodeResult.decoded.join(", ")}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleReset}>
                    Decode Again
                  </Button>
                  <Button onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <HuffmanTableManager
        open={showTableManager}
        onClose={() => setShowTableManager(false)}
        onTableCreated={() => {
          loadTables();
          setShowTableManager(false);
        }}
      />
    </>
  );
}
