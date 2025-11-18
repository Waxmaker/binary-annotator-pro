import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { AlertCircle, CheckCircle2, Save, Sparkles } from "lucide-react";
import { createYamlConfig, updateYamlConfig } from "@/lib/api";
import { useAISettings } from "@/hooks/useAISettings";
import { autoGenerateYAMLTags } from "@/services/aiService";
import { calculateEntropy } from "@/utils/binaryAnalysis";
import { findRepeatingPattern } from "@/utils/searchPatterns";
import { findPeriodicStructures } from "@/utils/patternClustering";

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  currentConfigName?: string;
  onConfigSaved?: () => void;
  buffer: ArrayBuffer | null;
  fileName: string | null;
}

export function YamlEditor({
  value,
  onChange,
  error,
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

  const handleSaveClick = () => {
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

          onChange(cleanedData.trim());
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

    try {
      setSaving(true);

      if (currentConfigName && currentConfigName === configName) {
        // Update existing config
        await updateYamlConfig(currentConfigName, value);
        toast.success(`Updated config: ${configName}`);
      } else if (currentConfigName && currentConfigName !== configName) {
        // Save as new with different name
        await createYamlConfig(configName, value);
        toast.success(`Created new config: ${configName}`);
      } else {
        // Create new config
        await createYamlConfig(configName, value);
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

        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
          {error ? (
            <Alert variant="destructive" className="flex-shrink-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : (
            <Alert className="flex-shrink-0 border-accent bg-accent/10">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <AlertDescription className="text-xs text-accent-foreground">
                YAML configuration is valid
              </AlertDescription>
            </Alert>
          )}

          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 font-mono text-xs resize-none bg-hex-background border-border"
            placeholder="Enter YAML configuration..."
            spellCheck={false}
          />

          <div className="flex-shrink-0 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">Configuration Format:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>
                <code className="text-primary">search:</code> Define text
                patterns to highlight
              </li>
              <li>
                <code className="text-primary">tags:</code> Define offset-based
                regions
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
        </div>
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
