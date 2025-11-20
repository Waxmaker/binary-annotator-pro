import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/utils/binaryUtils";
import { convertBytesECG, formatHexBytesSpaced } from "@/utils/conversionsECG";
import {
  generateKaitaiSnippet,
  suggestFieldType,
  downloadKaitaiTemplate,
} from "@/utils/kaitaiHelper";
import { Info, Download, Copy, Activity, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAISettings } from "@/hooks/useAISettings";
import { predictFieldType } from "@/services/aiService";

interface ECGInspectorProps {
  selection: {
    start: number;
    end: number;
    bytes: number[];
  } | null;
}

export function ECGInspector({ selection }: ECGInspectorProps) {
  const { settings, isConfigured } = useAISettings();
  const [aiPrediction, setAiPrediction] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const handleCopyKaitai = () => {
    if (!selection) return;
    const snippet = generateKaitaiSnippet(selection.bytes, selection.start);
    navigator.clipboard.writeText(snippet);
    toast.success("Kaitai snippet copied to clipboard");
  };

  const handleExportBytes = () => {
    if (!selection) return;
    const blob = new Blob([new Uint8Array(selection.bytes)], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selection_${selection.start.toString(16)}.bin`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Selection exported");
  };

  const handleAIPredict = async () => {
    if (!selection) return;
    if (!isConfigured) {
      toast.error("Please configure AI settings first");
      return;
    }

    setIsLoadingAI(true);
    setAiPrediction(null);

    try {
      const response = await predictFieldType(selection.bytes, selection.start);
      if (response.success && response.data) {
        setAiPrediction(response.data);
        toast.success("AI prediction completed");
      } else {
        toast.error(response.error || "AI prediction failed");
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoadingAI(false);
    }
  };

  if (!selection || selection.bytes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-panel-border bg-panel-header">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Converter</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No selection</p>
            <p className="text-xs mt-1">Click or drag to select bytes</p>
          </div>
        </div>
      </div>
    );
  }

  const conversions = convertBytesECG(selection.bytes);
  const size = selection.end - selection.start + 1;
  const suggestedType = suggestFieldType(selection.bytes);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Converter</h2>
          </div>
          <div className="flex gap-1">
            <Button
              variant={isConfigured ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={handleAIPredict}
              disabled={isLoadingAI}
              title={isConfigured ? "AI Predict Type" : "Configure AI first"}
            >
              <Sparkles className="h-3 w-3" />
              {isLoadingAI && <span className="text-[10px]">...</span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleExportBytes}
              title="Export selection to file"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleCopyKaitai}
              title="Copy Kaitai snippet"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Range Info */}
        <Card className="p-3 bg-card border-primary/20">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Suggested KSY type:</span>
              <span className="font-mono text-accent text-xs">
                {suggestedType}
              </span>
            </div>
          </div>
        </Card>

        {/* AI Prediction */}
        {aiPrediction && (
          <Card className="p-3 bg-primary/5 border-primary/30">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-foreground">
                  AI Prediction
                </h3>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {aiPrediction}
              </p>
            </div>
          </Card>
        )}

        {/* Hex & Binary */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary">▸</span> Raw Data
          </h3>
          <Card className="p-3 bg-hex-background">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Hex:</p>
                <p className="text-xs font-mono text-hex-text break-all leading-relaxed">
                  {formatHexBytesSpaced(selection.bytes)}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">ASCII:</p>
                <p className="text-xs font-mono text-hex-ascii break-all">
                  {conversions.ascii}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Bit Flags (first byte):
                </p>
                <p className="text-xs font-mono text-accent">
                  {conversions.bitFlags}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* ECG-Specific Conversions */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-3 w-3 text-accent" />
            ECG Interpretations
          </h3>
          <Card className="p-3 space-y-2 text-xs bg-accent/5 border-accent/30">
            {conversions.signed12bit !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Signed 12-bit:</span>
                <span className="font-mono text-accent font-bold">
                  {conversions.signed12bit}
                </span>
              </div>
            )}
            {conversions.packed3byte !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">3-byte packed:</span>
                <span className="font-mono text-accent font-bold">
                  {conversions.packed3byte}
                </span>
              </div>
            )}
            {conversions.amplitudeMV !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amplitude (mV):</span>
                <span className="font-mono text-accent font-bold">
                  {conversions.amplitudeMV.toFixed(4)} mV
                </span>
              </div>
            )}
            {size >= 2 && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Int16 (LE):</span>
                  <span className="font-mono">{conversions.int16LE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Int16 (BE):</span>
                  <span className="font-mono">{conversions.int16BE}</span>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Standard Integer Types */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <span className="text-primary">▸</span> Standard Integers
          </h3>
          <Card className="p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">UInt8:</span>
              <span className="font-mono">{conversions.uint8}</span>
            </div>
            {size >= 2 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UInt16 (LE):</span>
                  <span className="font-mono">{conversions.uint16LE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UInt16 (BE):</span>
                  <span className="font-mono">{conversions.uint16BE}</span>
                </div>
              </>
            )}
            {size >= 4 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UInt32 (LE):</span>
                  <span className="font-mono">{conversions.uint32LE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UInt32 (BE):</span>
                  <span className="font-mono">{conversions.uint32BE}</span>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Floating Point */}
        {size >= 4 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span className="text-primary">▸</span> Floating Point
            </h3>
            <Card className="p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Float32 (LE):</span>
                <span className="font-mono">
                  {conversions.float32LE.toFixed(6)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Float32 (BE):</span>
                <span className="font-mono">
                  {conversions.float32BE.toFixed(6)}
                </span>
              </div>
              {size >= 8 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Float64 (LE):</span>
                    <span className="font-mono">
                      {conversions.float64LE.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Float64 (BE):</span>
                    <span className="font-mono">
                      {conversions.float64BE.toFixed(6)}
                    </span>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* UTF-8 */}
        {conversions.utf8 && conversions.utf8.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span className="text-primary">▸</span> Text
            </h3>
            <Card className="p-3 bg-hex-background">
              <p className="text-xs font-mono text-hex-text break-all">
                {conversions.utf8}
              </p>
            </Card>
          </div>
        )}

        {/* TODO: Go Backend Integration */}
        <Card className="p-3 bg-muted/30 border-dashed">
          <p className="text-xs text-muted-foreground italic">
            🚧 <strong>TODO:</strong> Replace with Go backend API call for
            advanced analysis
          </p>
        </Card>
      </div>
    </div>
  );
}
