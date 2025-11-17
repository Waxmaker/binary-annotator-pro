import { useEffect, useState } from "react";
import {
  calculateSHA256,
  detectFileType,
  formatFileSize,
} from "@/utils/fileInfo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface FileInfoProps {
  fileName: string | null;
  buffer: ArrayBuffer | null;
}

export const FileInfo = ({ fileName, buffer }: FileInfoProps) => {
  const [sha256, setSha256] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [fileType, setFileType] = useState<{
    mimeType: string;
    fileType: string;
  } | null>(null);

  useEffect(() => {
    if (!buffer) {
      setSha256("");
      setFileType(null);
      return;
    }

    // Calculate SHA256
    calculateSHA256(buffer).then(setSha256);

    // Detect file type
    setFileType(detectFileType(buffer));
  }, [buffer]);

  const handleCopySHA256 = async () => {
    if (!sha256) return;

    try {
      await navigator.clipboard.writeText(sha256);
      setCopied(true);
      toast.success("SHA-256 copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  if (!buffer || !fileName) {
    return (
      <div className="p-4 text-center text-muted-foreground">No file loaded</div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">File Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs mb-1">File Name</div>
            <div className="font-mono text-xs break-all">{fileName}</div>
          </div>

          <div>
            <div className="text-muted-foreground text-xs mb-1">File Size</div>
            <div className="font-mono">
              {formatFileSize(buffer.byteLength)} ({buffer.byteLength.toLocaleString()} bytes)
            </div>
          </div>

          {fileType && (
            <>
              <div>
                <div className="text-muted-foreground text-xs mb-1">File Type</div>
                <div className="font-mono">{fileType.fileType}</div>
              </div>

              <div>
                <div className="text-muted-foreground text-xs mb-1">MIME Type</div>
                <div className="font-mono text-xs">{fileType.mimeType}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Cryptographic Hash</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <div className="text-muted-foreground text-xs mb-1">SHA-256</div>
            <div className="flex items-start gap-2">
              <div className="font-mono text-[10px] break-all flex-1 bg-muted p-2 rounded">
                {sha256 || "Calculating..."}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySHA256}
                disabled={!sha256}
                className="flex-shrink-0 h-8 w-8 p-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
