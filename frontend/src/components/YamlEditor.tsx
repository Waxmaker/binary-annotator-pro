import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Sparkles, Code, List } from "lucide-react";
import { createYamlConfig, updateYamlConfig } from "@/lib/api";
import { useAISettings } from "@/hooks/useAISettings";
import { autoGenerateYAMLTags } from "@/services/aiService";
import { calculateEntropy } from "@/utils/binaryAnalysis";
import { findRepeatingPattern } from "@/utils/searchPatterns";
import { findPeriodicStructures } from "@/utils/patternClustering";
import { parseYamlConfig } from "@/utils/yamlParser";
import { TagOffsetManager } from "@/components/TagOffsetManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import yaml from "js-yaml";

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentConfigName?: string;
  onConfigSaved?: () => void;
  buffer: ArrayBuffer | null;
  fileName: string | null;
}

interface TagDefinition {
  name: string;
  offset: string;
  size: number;
  color: string;
  highlight?: boolean;
}

export function YamlEditor({
  value,
  onChange,
  currentConfigName,
  onConfigSaved,
  buffer,
  fileName,
}: YamlEditorProps) {
  const { settings, isConfigured } = useAISettings();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [configName, setConfigName] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [hasChanges, setHasChanges] = useState(false);
  const [editMode, setEditMode] = useState<"text" | "visual">("text");
  const [visualTags, setVisualTags] = useState<TagDefinition[]>([]);

  // Sync localValue when value changes externally (e.g., loading a config)
  useEffect(() => {
    setLocalValue(value);
    setHasChanges(false);
    // Parse YAML to extract tags for visual editor
    extractTagsFromYaml(value);
  }, [value]);

  // Extract tags from YAML text for visual editor
  const extractTagsFromYaml = (yamlText: string) => {
    try {
      if (!yamlText.trim()) {
        setVisualTags([]);
        return;
      }

      const parsed = yaml.load(yamlText) as any;
      if (!parsed?.tags) {
        setVisualTags([]);
        return;
      }

      const extractedTags: TagDefinition[] = Object.entries(parsed.tags).map(
        ([name, tagData]: [string, any]) => ({
          name,
          offset: typeof tagData.offset === "number"
            ? `0x${tagData.offset.toString(16).toUpperCase().padStart(4, '0')}`
            : tagData.offset,
          size: tagData.size || 1,
          color: tagData.color || "#95E1D3",
          highlight: false,
        })
      );

      setVisualTags(extractedTags);
    } catch (err) {
      console.error("Failed to extract tags from YAML:", err);
      setVisualTags([]);
    }
  };

  // Generate YAML from visual tags
  const generateYamlFromTags = (tags: TagDefinition[]): string => {
    try {
      // Parse existing YAML to preserve search rules
      let existingConfig: any = {};
      try {
        existingConfig = yaml.load(localValue) || {};
      } catch (err) {
        // If parsing fails, start fresh
        existingConfig = {};
      }

      // Build tags object
      const tagsObject: any = {};
      tags.forEach((tag) => {
        tagsObject[tag.name] = {
          offset: tag.offset,
          size: tag.size,
          color: tag.color,
        };
      });

      // Merge with existing config
      const newConfig = {
        ...existingConfig,
        tags: tagsObject,
      };

      // Generate YAML
      const yamlText = yaml.dump(newConfig, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      return yamlText;
    } catch (err) {
      console.error("Failed to generate YAML from tags:", err);
      toast.error("Failed to generate YAML");
      return localValue;
    }
  };

  const handleTagsChange = (tags: TagDefinition[]) => {
    setVisualTags(tags);
    const newYaml = generateYamlFromTags(tags);
    setLocalValue(newYaml);
    setHasChanges(newYaml !== value);
  };

  const handleTagHighlight = (offset: number) => {
    // This would trigger scrolling in the hex viewer
    // We'll need to pass this up through props if needed
    toast.info(`Highlighting offset: 0x${offset.toString(16).toUpperCase()}`);
  };

  const handleApply = () => {
    onChange(localValue);
    setHasChanges(false);
  };

  const handleLocalChange = (newValue: string) => {
    setLocalValue(newValue);
    setHasChanges(newValue !== value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert tab character at cursor position
      const newValue =
        localValue.substring(0, start) + "  " + localValue.substring(end);

      setLocalValue(newValue);
      setHasChanges(newValue !== value);

      // Set cursor position after the inserted tab
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleSaveClick = () => {
    // Apply changes before saving
    if (hasChanges) {
      onChange(localValue);
      setHasChanges(false);
    }
    setConfigName(currentConfigName || "");
    setSaveDialogOpen(true);
  };

  const handleAIGenerate = async () => {
    if (!buffer || !fileName) {
      toast.error("No file loaded");
      return;
    }

    if (!isConfigured) {
      toast.error("Please configure AI settings first");
      return;
    }

    setGeneratingAI(true);
    toast.info("Analyzing file structure...");

    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(async () => {
      try {
        // Analyze file
        const data = new Uint8Array(buffer);
        const firstBytes = Array.from(data.slice(0, 256));
        const entropy = calculateEntropy(data);

        // Find patterns
        const patterns = findRepeatingPattern(buffer, 2, 16, 3)
          .slice(0, 10)
          .map((p) => ({
            offset: p.offsets[0],
            bytes: Array.from(
              data.slice(p.offsets[0], p.offsets[0] + p.pattern.length),
            ),
            occurrences: p.offsets.length,
          }));

        // Find periodic structures
        const periodicStructures = findPeriodicStructures(buffer);

        toast.info("Sending to AI for analysis...");

        // Call AI
        const response = await autoGenerateYAMLTags({
          fileName,
          fileSize: buffer.byteLength,
          firstBytes,
          entropy,
          patterns,
          periodicStructures,
        });

        if (response.success && response.data) {
          // Clean any remaining markdown code blocks (backup cleanup)
          let cleanedData = response.data.trim();
          if (cleanedData.startsWith("```yaml")) {
            cleanedData = cleanedData.replace(/^```yaml\n?/, "");
          } else if (cleanedData.startsWith("```")) {
            cleanedData = cleanedData.replace(/^```\n?/, "");
          }
          if (cleanedData.endsWith("```")) {
            cleanedData = cleanedData.replace(/\n?```$/, "");
          }

          setLocalValue(cleanedData.trim());
          onChange(cleanedData.trim());
          setHasChanges(false);
          toast.success("AI generated YAML tags successfully");
        } else {
          toast.error(response.error || "AI generation failed");
        }
      } catch (error: any) {
        toast.error(`Error: ${error.message}`);
      } finally {
        setGeneratingAI(false);
      }
    }, 100);
  };

  const handleSaveConfirm = async () => {
    if (!configName.trim()) {
      toast.error("Please enter a configuration name");
      return;
    }

    // Use the current value (which was already applied by handleSaveClick)
    const yamlToSave = value;

    // Validate YAML before saving
    const { error: validationError } = parseYamlConfig(yamlToSave);
    if (validationError) {
      toast.error(`Invalid YAML: ${validationError}`);
      return;
    }

    try {
      setSaving(true);

      if (currentConfigName && currentConfigName === configName) {
        // Update existing config
        await updateYamlConfig(currentConfigName, yamlToSave);
        toast.success(`Updated config: ${configName}`);
      } else if (currentConfigName && currentConfigName !== configName) {
        // Save as new with different name
        await createYamlConfig(configName, yamlToSave);
        toast.success(`Created new config: ${configName}`);
      } else {
        // Create new config
        await createYamlConfig(configName, yamlToSave);
        toast.success(`Saved config: ${configName}`);
      }

      if (onConfigSaved) onConfigSaved();
      setSaveDialogOpen(false);
      setConfigName("");
    } catch (err: any) {
      console.error("Failed to save config:", err);
      toast.error(`Failed to save config: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-panel-border bg-panel-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            YAML Configuration
          </h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={isConfigured ? "outline" : "ghost"}
              onClick={handleAIGenerate}
              className="h-8"
              disabled={generatingAI || !buffer}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {generatingAI ? "AI ..." : "AI"}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleSaveClick}
              className="h-8"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
          </div>
        </div>

        <Tabs value={editMode} onValueChange={(v) => setEditMode(v as "text" | "visual")} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="visual" className="text-xs">
                <List className="h-3.5 w-3.5 mr-1.5" />
                Visual Editor
              </TabsTrigger>
              <TabsTrigger value="text" className="text-xs">
                <Code className="h-3.5 w-3.5 mr-1.5" />
                YAML Text
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="visual" className="flex-1 overflow-auto p-4 m-0">
            <TagOffsetManager
              tags={visualTags}
              onChange={handleTagsChange}
              onHighlight={handleTagHighlight}
            />
          </TabsContent>

          <TabsContent value="text" className="flex-1 flex flex-col overflow-hidden p-4 gap-4 m-0">
            <div className="flex-1 flex flex-col gap-2">
              <Textarea
                value={localValue}
                onChange={(e) => handleLocalChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 font-mono text-xs resize-none bg-hex-background border-border"
                placeholder="Enter YAML configuration..."
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleApply}
                  disabled={!hasChanges}
                  className="h-8"
                >
                  Apply Changes
                </Button>
                {hasChanges && (
                  <span className="text-xs text-muted-foreground">
                    You have unsaved changes
                  </span>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">Configuration Format:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>
                  <code className="text-primary">search:</code> Search patterns with type support
                </li>
                <li>
                  <code className="text-primary">tags:</code> Define offset-based regions
                </li>
                <li>
                  Search types:{" "}
                  <code className="text-primary">hex</code>,{" "}
                  <code className="text-primary">string-ascii</code>,{" "}
                  <code className="text-primary">int16le</code>,{" "}
                  <code className="text-primary">uint32le</code>, etc.
                </li>
                <li>
                  Colors in hex format (e.g.,{" "}
                  <code className="text-primary">#FF0000</code>)
                </li>
                <li>
                  Offsets support hex (e.g.,{" "}
                  <code className="text-primary">0x1000</code>)
                </li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save YAML Configuration</DialogTitle>
            <DialogDescription>
              {currentConfigName
                ? `Enter a name to save this configuration. Current name: "${currentConfigName}"`
                : "Enter a name for this configuration"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="config-name">Configuration Name</Label>
              <Input
                id="config-name"
                placeholder="e.g., schiller_format"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveConfirm();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveConfirm} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
