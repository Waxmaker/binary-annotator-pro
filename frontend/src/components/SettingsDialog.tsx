import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAISettings, AIProvider, AISettings } from "@/hooks/useAISettings";
import { toast } from "sonner";
import { Sparkles, Check, AlertCircle } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, isConfigured, saveSettings, resetSettings } = useAISettings();
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
    }
  }, [open, settings]);

  const handleSave = () => {
    saveSettings(localSettings);
    toast.success("Settings saved successfully");
    onOpenChange(false);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all AI settings to defaults?")) {
      resetSettings();
      setLocalSettings(settings);
      toast.success("Settings reset to defaults");
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    setLocalSettings({ ...localSettings, provider });
  };

  const isProviderConfigured = (provider: AIProvider): boolean => {
    switch (provider) {
      case "ollama":
        return !!localSettings.ollamaUrl;
      case "openai":
        return !!localSettings.openaiKey;
      case "claude":
        return !!localSettings.claudeKey;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Settings
          </DialogTitle>
          <DialogDescription>
            Configure AI providers for intelligent binary analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>AI Provider</Label>
            <Select
              value={localSettings.provider}
              onValueChange={(val) => handleProviderChange(val as AIProvider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">
                  <div className="flex items-center gap-2">
                    Ollama (Local)
                    {isProviderConfigured("ollama") && (
                      <Check className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </SelectItem>
                <SelectItem value="openai">
                  <div className="flex items-center gap-2">
                    OpenAI (Cloud)
                    {isProviderConfigured("openai") && (
                      <Check className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </SelectItem>
                <SelectItem value="claude">
                  <div className="flex items-center gap-2">
                    Claude (Cloud)
                    {isProviderConfigured("claude") && (
                      <Check className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={localSettings.provider} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ollama" onClick={() => handleProviderChange("ollama")}>
                Ollama
              </TabsTrigger>
              <TabsTrigger value="openai" onClick={() => handleProviderChange("openai")}>
                OpenAI
              </TabsTrigger>
              <TabsTrigger value="claude" onClick={() => handleProviderChange("claude")}>
                Claude
              </TabsTrigger>
            </TabsList>

            {/* Ollama Configuration */}
            <TabsContent value="ollama" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ollamaUrl">Ollama Server URL</Label>
                <Input
                  id="ollamaUrl"
                  placeholder="http://localhost:11434"
                  value={localSettings.ollamaUrl}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, ollamaUrl: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Make sure Ollama is running locally. Download from{" "}
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    ollama.ai
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ollamaModel">Model</Label>
                <Input
                  id="ollamaModel"
                  placeholder="llama2"
                  value={localSettings.ollamaModel}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, ollamaModel: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Popular models: llama2, codellama, mistral, mixtral
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  Ollama runs locally and is completely free. Great for privacy and no API costs!
                </div>
              </div>
            </TabsContent>

            {/* OpenAI Configuration */}
            <TabsContent value="openai" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openaiKey">API Key</Label>
                <Input
                  id="openaiKey"
                  type="password"
                  placeholder="sk-..."
                  value={localSettings.openaiKey}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, openaiKey: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openaiModel">Model</Label>
                <Select
                  value={localSettings.openaiModel}
                  onValueChange={(val) =>
                    setLocalSettings({ ...localSettings, openaiModel: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4 (Most capable)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Faster)</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Cheaper)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  OpenAI API usage is billed. Your key is stored locally and never sent to our
                  servers.
                </div>
              </div>
            </TabsContent>

            {/* Claude Configuration */}
            <TabsContent value="claude" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="claudeKey">API Key</Label>
                <Input
                  id="claudeKey"
                  type="password"
                  placeholder="sk-ant-..."
                  value={localSettings.claudeKey}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, claudeKey: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="claudeModel">Model</Label>
                <Select
                  value={localSettings.claudeModel}
                  onValueChange={(val) =>
                    setLocalSettings({ ...localSettings, claudeModel: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-3-5-sonnet-20241022">
                      Claude 3.5 Sonnet (Best)
                    </SelectItem>
                    <SelectItem value="claude-3-opus-20240229">
                      Claude 3 Opus (Most capable)
                    </SelectItem>
                    <SelectItem value="claude-3-sonnet-20240229">
                      Claude 3 Sonnet (Balanced)
                    </SelectItem>
                    <SelectItem value="claude-3-haiku-20240307">
                      Claude 3 Haiku (Fastest)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  Claude API usage is billed. Your key is stored locally and never sent to our
                  servers.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
