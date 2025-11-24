import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Upload, FileUp } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = () => {
    onLoadSamples(inputText);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onInputTextChange(content);
      onLoadSamples(content);
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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
              Sample Data
            </label>
            <p className="text-xs text-muted-foreground">
              Space-separated integers or CSV format (timestamp,value)
            </p>
            <Textarea
              value={inputText}
              onChange={(e) => onInputTextChange(e.target.value)}
              placeholder="CSV format:&#10;timestamp,value&#10;0.0,0.100&#10;0.5,0.100&#10;&#10;Or space-separated:&#10;-12 30 29 -5 100 88 ..."
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

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleUploadClick} variant="outline" className="w-full">
                <FileUp className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <Button onClick={handleLoad} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Load
              </Button>
            </div>
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
