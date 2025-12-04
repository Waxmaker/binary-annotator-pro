import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecksumData {
  // Simple checksums
  sum8: string;
  sum16_le: string;
  sum16_be: string;
  sum32: string;
  xor8: string;
  negative_sum8: string;

  // Standard checksums
  fletcher16: string;
  adler32: string;
  bsd_checksum: string;

  // CRC
  crc8: string;
  crc16_modbus: string;
  crc16_xmodem: string;
  crc16_ccitt: string;
  crc32: string;

  // Cryptographic hashes
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;

  // Metadata
  offset: number;
  length: number;
}

interface ChecksumDialogProps {
  open: boolean;
  onClose: () => void;
  checksums: ChecksumData | null;
  loading?: boolean;
}

interface ChecksumItem {
  label: string;
  value: string;
  description: string;
  category: "simple" | "standard" | "crc" | "crypto";
}

export function ChecksumDialog({
  open,
  onClose,
  checksums,
  loading = false,
}: ChecksumDialogProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  useEffect(() => {
    if (copiedValue) {
      const timer = setTimeout(() => setCopiedValue(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedValue]);

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(label);
  };

  if (!checksums) {
    return null;
  }

  const checksumItems: ChecksumItem[] = [
    // Simple checksums (very common in proprietary formats)
    {
      label: "Sum8",
      value: checksums.sum8,
      description: "8-bit addition modulo 256",
      category: "simple",
    },
    {
      label: "Sum16 LE",
      value: checksums.sum16_le,
      description: "16-bit addition (little-endian)",
      category: "simple",
    },
    {
      label: "Sum16 BE",
      value: checksums.sum16_be,
      description: "16-bit addition (big-endian)",
      category: "simple",
    },
    {
      label: "Sum32",
      value: checksums.sum32,
      description: "32-bit addition",
      category: "simple",
    },
    {
      label: "XOR8",
      value: checksums.xor8,
      description: "XOR of all bytes",
      category: "simple",
    },
    {
      label: "Negative Sum8",
      value: checksums.negative_sum8,
      description: "Two's complement of Sum8",
      category: "simple",
    },

    // Standard checksums
    {
      label: "Fletcher-16",
      value: checksums.fletcher16,
      description: "Double checksum algorithm",
      category: "standard",
    },
    {
      label: "Adler-32",
      value: checksums.adler32,
      description: "Robust variant of Fletcher",
      category: "standard",
    },
    {
      label: "BSD Checksum",
      value: checksums.bsd_checksum,
      description: "Rotating checksum (historical)",
      category: "standard",
    },

    // CRC checksums
    {
      label: "CRC-8",
      value: checksums.crc8,
      description: "CRC-8 (polynomial 0x07)",
      category: "crc",
    },
    {
      label: "CRC-16/MODBUS",
      value: checksums.crc16_modbus,
      description: "Industrial systems",
      category: "crc",
    },
    {
      label: "CRC-16/XMODEM",
      value: checksums.crc16_xmodem,
      description: "Serial communication",
      category: "crc",
    },
    {
      label: "CRC-16/CCITT",
      value: checksums.crc16_ccitt,
      description: "Schiller MKF files, binascii.crc_hqx",
      category: "crc",
    },
    {
      label: "CRC-32",
      value: checksums.crc32,
      description: "ZIP, PNG, Ethernet (IEEE 802.3)",
      category: "crc",
    },

    // Cryptographic hashes
    {
      label: "MD5",
      value: checksums.md5,
      description: "128-bit hash (deprecated for security)",
      category: "crypto",
    },
    {
      label: "SHA-1",
      value: checksums.sha1,
      description: "160-bit hash (deprecated for security)",
      category: "crypto",
    },
    {
      label: "SHA-256",
      value: checksums.sha256,
      description: "256-bit hash (recommended)",
      category: "crypto",
    },
    {
      label: "SHA-512",
      value: checksums.sha512,
      description: "512-bit hash (very secure)",
      category: "crypto",
    },
  ];

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "simple":
        return "Simple Checksums";
      case "standard":
        return "Standard Checksums";
      case "crc":
        return "CRC Checksums";
      case "crypto":
        return "Cryptographic Hashes";
      default:
        return "";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "simple":
        return "text-blue-600 dark:text-blue-400";
      case "standard":
        return "text-green-600 dark:text-green-400";
      case "crc":
        return "text-purple-600 dark:text-purple-400";
      case "crypto":
        return "text-orange-600 dark:text-orange-400";
      default:
        return "";
    }
  };

  const groupedChecksums = checksumItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, ChecksumItem[]>,
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checksum Calculator</DialogTitle>
          <div className="text-sm text-muted-foreground mt-2">
            Offset: 0x{checksums.offset.toString(16).toUpperCase()} | Length:{" "}
            {checksums.length} bytes
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {(["simple", "standard", "crc", "crypto"] as const).map(
              (category) =>
                groupedChecksums[category] && (
                  <div key={category}>
                    <h3
                      className={cn(
                        "text-sm font-semibold mb-3",
                        getCategoryColor(category),
                      )}
                    >
                      {getCategoryTitle(category)}
                    </h3>
                    <div className="space-y-2">
                      {groupedChecksums[category].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                        >
                          <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium">
                                {item.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.description}
                              </span>
                            </div>
                            <div className="font-mono text-sm text-foreground mt-1 break-all">
                              {item.value}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-shrink-0"
                            onClick={() => handleCopy(item.value, item.label)}
                          >
                            {copiedValue === item.label ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
