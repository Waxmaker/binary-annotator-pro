import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Upload } from "lucide-react";
import { EcgSettingsPanel, EcgSettings } from "./EcgSettings";

interface SampleInputPanelProps {
  onLoadSamples: (input: string) => boolean;
  error: string | null;
  settings: EcgSettings;
  onSettingsChange: (settings: EcgSettings) => void;
  inputText: string;
  onInputTextChange: (text: string) => void;
}

export function SampleInputPanel({
  onLoadSamples,
  error,
  settings,
  onSettingsChange,
  inputText,
  onInputTextChange,
}: SampleInputPanelProps) {

  const handleLoad = () => {
    onLoadSamples(inputText);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">
          ECG Sample Input
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Sample Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Sample Data (space-separated integers)
            </label>
            <Textarea
              value={inputText}
              onChange={(e) => onInputTextChange(e.target.value)}
              placeholder="-12 30 29 -5 100 88 ..."
              className={`min-h-[120px] font-mono text-xs ${
                error ? "border-destructive" : ""
              }`}
              spellCheck={false}
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
            <Button onClick={handleLoad} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Load Samples
            </Button>
          </div>

          {/* Settings */}
          <div className="pt-4 border-t border-panel-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Rendering Settings
            </h3>
            <EcgSettingsPanel
              settings={settings}
              onChange={onSettingsChange}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
