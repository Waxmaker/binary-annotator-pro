import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Upload, FileUp, Zap } from "lucide-react";
import { EcgSettingsPanel, EcgSettings } from "./EcgSettings";
import { ConvertEcg } from "@/services/mcpDockerApi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface SampleInputPanelProps {
  onLoadSamples: (input: string) => boolean;
  error: string | null;
  settings: EcgSettings;
  onSettingsChange: (settings: EcgSettings) => void;
  inputText: string;
  onInputTextChange: (text: string) => void;
  onConvertedData?: (data: any) => void;
  overlayMode?: boolean;
  showRaw?: boolean;
  showConverted?: boolean;
  onOverlayModeChange?: (enabled: boolean) => void;
  onShowRawChange?: (show: boolean) => void;
  onShowConvertedChange?: (show: boolean) => void;
  hasConvertedData?: boolean;
}

export function SampleInputPanel({
  onLoadSamples,
  error,
  settings,
  onSettingsChange,
  inputText,
  onInputTextChange,
  onConvertedData,
  overlayMode = false,
  showRaw = true,
  showConverted = true,
  onOverlayModeChange,
  onShowRawChange,
  onShowConvertedChange,
  hasConvertedData = false,
}: SampleInputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [conversionEnabled, setConversionEnabled] = useState(false);
  const [adcBits, setAdcBits] = useState(12);
  const [adcRange, setAdcRange] = useState(10.0);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedCSV, setConvertedCSV] = useState("");
  const [conversionError, setConversionError] = useState<string | null>(null);

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
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleConvertECG = async () => {
    if (!inputText.trim()) return;
    
    setIsConverting(true);
    setConversionError(null);
    
    try {
      const result = await ConvertEcg(inputText, adcBits, adcRange);
      setConvertedCSV(inputText); // Store original CSV for download
      onConvertedData?.(result);
    } catch (err) {
      setConversionError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadConverted = () => {
    if (!convertedCSV) return;

    const blob = new Blob([convertedCSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted_ecg_${adcBits}bits_${adcRange}mV.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            <label className="text-sm font-medium">Sample Data</label>
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
              <Button
                onClick={handleUploadClick}
                variant="outline"
                className="w-full"
              >
                <FileUp className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <Button onClick={handleLoad} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Load
              </Button>
            </div>
          </div>

          {/* ECG Conversion */}
          <div className="pt-4 border-t border-panel-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                ECG Conversion
              </h3>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={conversionEnabled}
                  onCheckedChange={setConversionEnabled}
                />
                <span className="text-xs text-muted-foreground">Enable</span>
              </div>
            </div>

            {conversionEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adc-bits" className="text-xs">
                      ADC Bits
                    </Label>
                    <Input
                      id="adc-bits"
                      type="number"
                      value={adcBits}
                      onChange={(e) =>
                        setAdcBits(parseInt(e.target.value) || 12)
                      }
                      min="8"
                      max="24"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adc-range" className="text-xs">
                      ADC Range (mV)
                    </Label>
                    <Input
                      id="adc-range"
                      type="number"
                      value={adcRange}
                      onChange={(e) =>
                        setAdcRange(parseFloat(e.target.value) || 10.0)
                      }
                      min="0.1"
                      max="100"
                      step="0.1"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleConvertECG}
                    disabled={!inputText.trim() || isConverting}
                    className="w-full"
                    size="sm"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {isConverting ? "Converting..." : "Convert"}
                  </Button>
                  <Button
                    onClick={handleDownloadConverted}
                    disabled={!convertedCSV}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    Download CSV
                  </Button>
                </div>

                {conversionError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {conversionError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Wave Overlay Controls */}
          {hasConvertedData && (
            <div className="pt-4 border-t border-panel-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Wave Overlay
                </h3>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={overlayMode}
                    onCheckedChange={onOverlayModeChange}
                  />
                  <span className="text-xs text-muted-foreground">Enable</span>
                </div>
              </div>
              
              {overlayMode && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <Label className="text-xs">Raw Data</Label>
                    </div>
                    <Switch
                      checked={showRaw}
                      onCheckedChange={onShowRawChange}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <Label className="text-xs">Converted (µV)</Label>
                    </div>
                    <Switch
                      checked={showConverted}
                      onCheckedChange={onShowConvertedChange}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings */}
          <div className="pt-4 border-t border-panel-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Rendering Settings
            </h3>
            <EcgSettingsPanel settings={settings} onChange={onSettingsChange} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
