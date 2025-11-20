import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

interface TagDefinition {
  name: string;
  offset: string;
  size: number;
  color: string;
  highlight?: boolean;
}

interface TagOffsetManagerProps {
  tags: TagDefinition[];
  onChange: (tags: TagDefinition[]) => void;
  onHighlight?: (offset: number) => void;
}

const DEFAULT_COLORS = [
  "#95E1D3", "#FFD93D", "#6BCF7F", "#4D96FF", "#FF6B9D",
  "#E7679A", "#A76183", "#FCBAD3", "#AA96DA", "#F38181",
  "#4ECDC4", "#FF6B6B", "#95E1D3", "#FFB6B9", "#FEC8D8"
];

export function TagOffsetManager({ tags, onChange, onHighlight }: TagOffsetManagerProps) {
  const [newTag, setNewTag] = useState<TagDefinition>({
    name: "",
    offset: "0x",
    size: 1,
    color: DEFAULT_COLORS[0],
    highlight: false,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddTag = () => {
    if (!newTag.name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    // Validate offset format
    if (!newTag.offset.match(/^0x[0-9a-fA-F]+$/)) {
      toast.error("Offset must be in hex format (e.g., 0x1000)");
      return;
    }

    if (newTag.size <= 0) {
      toast.error("Size must be greater than 0");
      return;
    }

    // Check for duplicate names
    if (tags.some(t => t.name === newTag.name)) {
      toast.error("Tag name already exists");
      return;
    }

    const updatedTags = [...tags, { ...newTag }];
    onChange(updatedTags);

    // Reset form with next color
    const nextColorIndex = (tags.length + 1) % DEFAULT_COLORS.length;
    setNewTag({
      name: "",
      offset: "0x",
      size: 1,
      color: DEFAULT_COLORS[nextColorIndex],
      highlight: false,
    });

    toast.success(`Added tag: ${newTag.name}`);
  };

  const handleRemoveTag = (index: number) => {
    const tag = tags[index];
    const updatedTags = tags.filter((_, i) => i !== index);
    onChange(updatedTags);
    toast.success(`Removed tag: ${tag.name}`);
  };

  const handleToggleHighlight = (index: number) => {
    const updatedTags = [...tags];
    updatedTags[index].highlight = !updatedTags[index].highlight;
    onChange(updatedTags);

    // Trigger highlight in hex viewer
    if (updatedTags[index].highlight && onHighlight) {
      const offset = parseInt(updatedTags[index].offset, 16);
      onHighlight(offset);
    }
  };

  const handleUpdateTag = (index: number, field: keyof TagDefinition, value: string | number | boolean) => {
    const updatedTags = [...tags];
    updatedTags[index] = { ...updatedTags[index], [field]: value };
    onChange(updatedTags);
  };

  const handleQuickAdd = () => {
    // Quick add multiple sequential tags
    const baseOffset = newTag.offset;
    const baseName = newTag.name;
    const size = newTag.size;

    if (!baseName.trim() || !baseOffset.match(/^0x[0-9a-fA-F]+$/)) {
      toast.error("Enter a valid base tag name and offset");
      return;
    }

    // For now, just add one tag
    handleAddTag();
  };

  return (
    <div className="space-y-4">
      {/* Tag List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tags.map((tag, index) => (
          <Card
            key={index}
            className="p-3 relative"
            style={{ borderLeft: `4px solid ${tag.color}` }}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-mono font-semibold">{tag.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Offset:</span>
                  <p className="font-mono">{tag.offset}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <p className="font-mono">{tag.size} bytes</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Color:</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-mono text-[10px]">{tag.color}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  variant={tag.highlight ? "default" : "outline"}
                  className="h-7 w-7 p-0"
                  onClick={() => handleToggleHighlight(index)}
                  title={tag.highlight ? "Remove highlight" : "Highlight in viewer"}
                >
                  <Check className={`h-3.5 w-3.5 ${tag.highlight ? '' : 'opacity-30'}`} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveTag(index)}
                  title="Remove tag"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {tags.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-4 border border-dashed rounded">
            No tags defined yet
          </div>
        )}
      </div>

      {/* Add New Tag Form */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Add New Tag</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name" className="text-xs">Name</Label>
              <Input
                id="tag-name"
                placeholder="e.g., header"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tag-offset" className="text-xs">Offset (hex)</Label>
              <Input
                id="tag-offset"
                placeholder="0x0000"
                value={newTag.offset}
                onChange={(e) => setNewTag({ ...newTag, offset: e.target.value })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tag-size" className="text-xs">Size (bytes)</Label>
              <Input
                id="tag-size"
                type="number"
                min="1"
                value={newTag.size}
                onChange={(e) => setNewTag({ ...newTag, size: parseInt(e.target.value) || 1 })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tag-color" className="text-xs">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="tag-color"
                  type="color"
                  value={newTag.color}
                  onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                  className="h-8 w-12 p-1 cursor-pointer"
                />
                <Input
                  value={newTag.color}
                  onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                  className="h-8 flex-1 text-xs font-mono"
                  placeholder="#FF0000"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddTag}
              className="flex-1 h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Tag
            </Button>
          </div>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1 px-1">
        <p className="font-semibold">Tips:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>Use the <Check className="inline h-3 w-3" /> button to highlight tags in the viewer</li>
          <li>Offsets must be in hex format (e.g., 0x1000)</li>
          <li>Tags are automatically added to the YAML configuration</li>
        </ul>
      </div>
    </div>
  );
}
