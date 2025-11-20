import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAddress } from "@/utils/binaryUtils";
import { convertBytes, formatHexBytes, formatAscii } from "@/utils/conversions";
import { Info } from "lucide-react";

interface SelectionInspectorProps {
  selection: {
    start: number;
    end: number;
    bytes: number[];
  } | null;
}

export function SelectionInspector({ selection }: SelectionInspectorProps) {
  if (!selection || selection.bytes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-panel-border bg-panel-header">
          <h2 className="text-sm font-semibold text-foreground">Inspector</h2>
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

  const conversions = convertBytes(selection.bytes);
  const size = selection.end - selection.start + 1;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">Inspector</h2>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Range Info */}
        <Card className="p-3 bg-card">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start:</span>
              <span className="font-mono text-hex-address">
                {formatAddress(selection.start)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End:</span>
              <span className="font-mono text-hex-address">
                {formatAddress(selection.end)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span className="font-mono">{size} bytes</span>
            </div>
          </div>
        </Card>

        {/* Hex Dump */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground">Hex Bytes</h3>
          <Card className="p-3 bg-hex-background">
            <p className="text-xs font-mono text-hex-text break-all leading-relaxed">
              {formatHexBytes(selection.bytes)}
            </p>
          </Card>
        </div>

        {/* ASCII */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground">ASCII</h3>
          <Card className="p-3 bg-hex-background">
            <p className="text-xs font-mono text-hex-ascii break-all">
              {formatAscii(selection.bytes)}
            </p>
          </Card>
        </div>

        <Separator />

        {/* Integer Conversions */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground">Integers</h3>
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

        {/* Signed Integers */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground">
            Signed Integers
          </h3>
          <Card className="p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Int8:</span>
              <span className="font-mono">{conversions.int8}</span>
            </div>
            {size >= 2 && (
              <>
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
            {size >= 4 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Int32 (LE):</span>
                  <span className="font-mono">{conversions.int32LE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Int32 (BE):</span>
                  <span className="font-mono">{conversions.int32BE}</span>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Floating Point */}
        {size >= 4 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground">
              Floating Point
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

        {/* UTF-8 Text */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground">UTF-8 Text</h3>
          <Card className="p-3 bg-hex-background">
            <p className="text-xs font-mono text-hex-text break-all">
              {conversions.utf8 || "(not valid UTF-8)"}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
