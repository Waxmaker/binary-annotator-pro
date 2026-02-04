import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Save,
  Edit,
  FileCode,
  Play,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { HuffmanTable } from "@/services/huffmanApi";
import {
  createHuffmanTable,
  updateHuffmanTable,
  deleteHuffmanTable,
  getHuffmanTable,
} from "@/services/huffmanApi";

interface HuffmanEditorProps {
  tables: HuffmanTable[];
  selectedTableId: number | null;
  onTableSelect: (id: number | null) => void;
  onTableCreated: (table: HuffmanTable) => void;
  onTablesChanged: () => void;
}

interface EntryInput {
  symbol: number;
  code_length: number;
}

export function HuffmanEditor({
  tables,
  selectedTableId,
  onTableSelect,
  onTableCreated,
  onTablesChanged,
}: HuffmanEditorProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("editor");
  const [isEditing, setIsEditing] = useState(false);
  const [editingTableId, setEditingTableId] = useState<number | null>(null);

  // Form state
  const [tableName, setTableName] = useState("");
  const [tableDescription, setTableDescription] = useState("");
  const [entries, setEntries] = useState<EntryInput[]>([{ symbol: 0, code_length: 1 }]);
  const [bulkInput, setBulkInput] = useState("");

  const resetForm = () => {
    setTableName("");
    setTableDescription("");
    setEntries([{ symbol: 0, code_length: 1 }]);
    setBulkInput("");
    setIsEditing(false);
    setEditingTableId(null);
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
      setIsEditing(true);
      setActiveTab("editor");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load table",
        variant: "destructive",
      });
    }
  };

  const handleSaveTable = async () => {
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

    // Validate entries
    const invalidEntries = entries.filter(
      (e) => isNaN(e.symbol) || isNaN(e.code_length) || e.code_length < 1
    );
    if (invalidEntries.length > 0) {
      toast({
        title: "Error",
        description: "Invalid entries found",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEditing && editingTableId) {
        const updated = await updateHuffmanTable(editingTableId, {
          name: tableName,
          description: tableDescription,
          entries,
        });
        toast({
          title: "Success",
          description: `Table "${tableName}" updated`,
        });
        onTableSelect(updated.id);
      } else {
        const created = await createHuffmanTable({
          name: tableName,
          description: tableDescription,
          entries,
        });
        toast({
          title: "Success",
          description: `Table "${tableName}" created`,
        });
        onTableCreated(created);
      }

      resetForm();
      onTablesChanged();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to save table: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTable = async (id: number, name: string) => {
    if (!confirm(`Delete table "${name}"?`)) return;

    try {
      await deleteHuffmanTable(id);
      toast({
        title: "Success",
        description: `Table "${name}" deleted`,
      });
      if (selectedTableId === id) {
        onTableSelect(null);
      }
      onTablesChanged();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete table",
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
    field: keyof EntryInput,
    value: string
  ) => {
    const newEntries = [...entries];
    const numValue = parseInt(value) || 0;
    newEntries[index][field] = numValue;
    setEntries(newEntries);
  };

  const handleBulkParse = () => {
    const lines = bulkInput.trim().split("\n");
    const parsed: EntryInput[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("sym")) {
        continue;
      }

      const parts = trimmed.split(/[\s,\t]+/);
      if (parts.length >= 2) {
        const symbol = parseInt(parts[0]);
        const code_length = parseInt(parts[1]);
        if (!isNaN(symbol) && !isNaN(code_length) && code_length > 0) {
          parsed.push({ symbol, code_length });
        }
      }
    }

    if (parsed.length > 0) {
      setEntries(parsed);
      toast({
        title: "Success",
        description: `Parsed ${parsed.length} entries`,
      });
    } else {
      toast({
        title: "Warning",
        description: "No valid entries found",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor" className="gap-2">
            <Edit className="h-4 w-4" />
            {isEditing ? "Edit Table" : "Create Table"}
          </TabsTrigger>
          <TabsTrigger value="tables" className="gap-2">
            <FileCode className="h-4 w-4" />
            Existing Tables ({tables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="flex-1 flex flex-col space-y-4 m-0 mt-4">
          {/* Table Info */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Table Name *</Label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="e.g., ecg_huffman_table"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={tableDescription}
                onChange={(e) => setTableDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          {/* Bulk Input */}
          <div className="space-y-2">
            <Label className="text-xs">Bulk Input (symbol code_length per line)</Label>
            <Textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={`0 3\n1 3\n2 4\n3 4\n...`}
              rows={3}
              className="text-xs font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkParse}
              className="w-full"
            >
              <Play className="h-3 w-3 mr-2" />
              Parse Bulk Input
            </Button>
          </div>

          {/* Entries Table */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Entries ({entries.length})</Label>
              <Button size="sm" variant="outline" onClick={handleAddEntry}>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            <div className="flex-1 border rounded-lg overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-24">Symbol</TableHead>
                    <TableHead className="w-24">Code Len</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          value={entry.symbol}
                          onChange={(e) =>
                            handleEntryChange(index, "symbol", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min={1}
                          value={entry.code_length}
                          onChange={(e) =>
                            handleEntryChange(index, "code_length", e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveEntry(index)}
                          disabled={entries.length === 1}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSaveTable}
              disabled={!tableName.trim() || entries.length === 0}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Update Table" : "Create Table"}
            </Button>
            {isEditing && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>

          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Enter symbol values and their code lengths. The canonical Huffman
              codes will be automatically generated.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="tables" className="flex-1 m-0 mt-4">
          <div className="h-full flex flex-col space-y-2">
            <Select
              value={selectedTableId?.toString() || ""}
              onValueChange={(v) => onTableSelect(v ? parseInt(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a table to view..." />
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

            <div className="flex-1 border rounded-lg overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-muted-foreground"
                      >
                        No tables yet. Create one in the Editor tab.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tables.map((table) => (
                      <TableRow
                        key={table.id}
                        className={
                          selectedTableId === table.id ? "bg-primary/10" : ""
                        }
                      >
                        <TableCell>
                          <div className="font-medium">{table.name}</div>
                          {table.description && (
                            <div className="text-xs text-muted-foreground">
                              {table.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditTable(table.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleDeleteTable(table.id, table.name)
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
