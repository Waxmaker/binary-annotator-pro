import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, X, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createHuffmanTable,
  listHuffmanTables,
  deleteHuffmanTable,
  updateHuffmanTable,
  getHuffmanTable,
  type HuffmanTable,
} from "@/services/huffmanApi";

interface HuffmanEntry {
  symbol: number;
  code_length: number;
}

interface HuffmanTableManagerProps {
  open: boolean;
  onClose: () => void;
  onTableCreated?: (table: HuffmanTable) => void;
}

export function HuffmanTableManager({
  open,
  onClose,
  onTableCreated,
}: HuffmanTableManagerProps) {
  const [tables, setTables] = useState<HuffmanTable[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [tableName, setTableName] = useState("");
  const [tableDescription, setTableDescription] = useState("");
  const [entries, setEntries] = useState<HuffmanEntry[]>([{ symbol: 0, code_length: 1 }]);
  const [loading, setLoading] = useState(false);
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

  const handleAddEntry = () => {
    setEntries([...entries, { symbol: 0, code_length: 1 }]);
  };

  const handleRemoveEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const handleEntryChange = (
    index: number,
    field: keyof HuffmanEntry,
    value: string
  ) => {
    const newEntries = [...entries];
    newEntries[index][field] = parseInt(value) || 0;
    setEntries(newEntries);
  };

  const handleEditTable = async (id: number) => {
    try {
      const table = await getHuffmanTable(id);
      setEditingTableId(id);
      setTableName(table.name);
      setTableDescription(table.description || "");
      setEntries(
        table.entries?.map((e) => ({
          symbol: e.symbol,
          code_length: e.code_length,
        })) || []
      );
      setShowCreateForm(true);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to load table: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleCreateTable = async () => {
    if (!tableName.trim()) {
      toast({
        title: "Error",
        description: "Table name is required",
        variant: "destructive",
      });
      return;
    }

    if (entries.length === 0) {
      toast({
        title: "Error",
        description: "At least one entry is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingTableId) {
        // Update existing table
        const updatedTable = await updateHuffmanTable(editingTableId, {
          name: tableName,
          description: tableDescription,
          entries,
        });

        toast({
          title: "Success",
          description: `Table "${tableName}" updated successfully`,
        });

        if (onTableCreated) {
          onTableCreated(updatedTable);
        }
      } else {
        // Create new table
        const newTable = await createHuffmanTable({
          name: tableName,
          description: tableDescription,
          entries,
        });

        toast({
          title: "Success",
          description: `Table "${tableName}" created successfully`,
        });

        if (onTableCreated) {
          onTableCreated(newTable);
        }
      }

      setShowCreateForm(false);
      setEditingTableId(null);
      setTableName("");
      setTableDescription("");
      setEntries([{ symbol: 0, code_length: 1 }]);
      await loadTables();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${editingTableId ? "update" : "create"} table: ${error}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async (id: number, name: string) => {
    if (!confirm(`Delete table "${name}"?`)) {
      return;
    }

    try {
      await deleteHuffmanTable(id);
      toast({
        title: "Success",
        description: `Table "${name}" deleted`,
      });
      await loadTables();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete table: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handlePasteEntries = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.trim().split("\n");
      const parsed: HuffmanEntry[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("sym") || trimmed.startsWith("#")) {
          continue; // Skip headers and comments
        }

        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const symbol = parseInt(parts[0]);
          const code_length = parseInt(parts[1]);
          if (!isNaN(symbol) && !isNaN(code_length)) {
            parsed.push({ symbol, code_length });
          }
        }
      }

      if (parsed.length > 0) {
        setEntries(parsed);
        toast({
          title: "Success",
          description: `Pasted ${parsed.length} entries`,
        });
      } else {
        toast({
          title: "Warning",
          description: "No valid entries found in clipboard",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to paste: ${error}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Huffman Table Manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showCreateForm ? (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Existing Tables</h3>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Table
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No tables found. Create your first Huffman table.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tables.map((table) => (
                        <TableRow key={table.id}>
                          <TableCell className="font-medium">{table.name}</TableCell>
                          <TableCell>{table.description || "-"}</TableCell>
                          <TableCell>
                            {new Date(table.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTable(table.id)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTable(table.id, table.name)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {editingTableId ? "Edit Table" : "Create New Table"}
                </h3>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingTableId(null);
                    setTableName("");
                    setTableDescription("");
                    setEntries([{ symbol: 0, code_length: 1 }]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="table-name">Table Name</Label>
                  <Input
                    id="table-name"
                    placeholder="e.g., table_fukuda"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="table-description">Description (optional)</Label>
                  <Textarea
                    id="table-description"
                    placeholder="Description of this Huffman table..."
                    value={tableDescription}
                    onChange={(e) => setTableDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Entries (Symbol → Code Length)</Label>
                    <div className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePasteEntries}
                      >
                        Paste from Clipboard
                      </Button>
                      <Button size="sm" onClick={handleAddEntry}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Entry
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-2">
                      {entries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1">
                            <Input
                              type="number"
                              placeholder="Symbol"
                              value={entry.symbol}
                              onChange={(e) =>
                                handleEntryChange(index, "symbol", e.target.value)
                              }
                            />
                          </div>
                          <div className="flex-1">
                            <Input
                              type="number"
                              placeholder="Code Length"
                              min={1}
                              value={entry.code_length}
                              onChange={(e) =>
                                handleEntryChange(index, "code_length", e.target.value)
                              }
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEntry(index)}
                            disabled={entries.length === 1}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={handleCreateTable}
                  disabled={loading || !tableName.trim()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading
                    ? editingTableId
                      ? "Updating..."
                      : "Creating..."
                    : editingTableId
                    ? "Update Table"
                    : "Create Table"}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
