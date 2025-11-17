import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CopyAsMenuProps {
  selection: { start: number; end: number; bytes: number[] } | null;
}

export const CopyAsMenu = ({ selection }: CopyAsMenuProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (format: string) => {
    if (!selection || selection.bytes.length === 0) {
      toast.error("No bytes selected");
      return;
    }

    let output = "";
    const bytes = selection.bytes;

    try {
      switch (format) {
        case "hex":
          // Simple hex string: "4A6F686E"
          output = bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
          break;

        case "hex-spaced":
          // Hex with spaces: "4A 6F 68 6E"
          output = bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
          break;

        case "hex-0x":
          // Hex with 0x prefix: "0x4A, 0x6F, 0x68, 0x6E"
          output = bytes.map((b) => `0x${b.toString(16).padStart(2, "0").toUpperCase()}`).join(", ");
          break;

        case "base64":
          // Base64 encoding
          const uint8Array = new Uint8Array(bytes);
          const binaryString = Array.from(uint8Array)
            .map((b) => String.fromCharCode(b))
            .join("");
          output = btoa(binaryString);
          break;

        case "c-array":
          // C array format: unsigned char data[] = { 0x4A, 0x6F, 0x68, 0x6E };
          const hexBytes = bytes.map((b) => `0x${b.toString(16).padStart(2, "0").toUpperCase()}`);
          const lines: string[] = [];
          lines.push("unsigned char data[] = {");

          // Format in rows of 12 bytes for readability
          for (let i = 0; i < hexBytes.length; i += 12) {
            const chunk = hexBytes.slice(i, i + 12);
            const line = "    " + chunk.join(", ") + (i + 12 < hexBytes.length ? "," : "");
            lines.push(line);
          }

          lines.push("};");
          lines.push(`unsigned int data_len = ${bytes.length};`);
          output = lines.join("\n");
          break;

        case "python-bytes":
          // Python bytes: b'\x4a\x6f\x68\x6e'
          output = "b'" + bytes.map((b) => `\\x${b.toString(16).padStart(2, "0")}`).join("") + "'";
          break;

        case "go-slice":
          // Go byte slice: []byte{0x4A, 0x6F, 0x68, 0x6E}
          const goBytes = bytes.map((b) => `0x${b.toString(16).padStart(2, "0").toUpperCase()}`);
          output = "[]byte{" + goBytes.join(", ") + "}";
          break;

        case "decimal":
          // Decimal values: "74, 111, 104, 110"
          output = bytes.join(", ");
          break;

        default:
          toast.error("Unknown format");
          return;
      }

      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success(`Copied as ${format.toUpperCase()}`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy to clipboard");
    }
  };

  const disabled = !selection || selection.bytes.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Copy As...
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleCopy("hex")}>
          Hex (No Spaces)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy("hex-spaced")}>
          Hex (Spaced)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy("hex-0x")}>
          Hex (0x Prefix)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleCopy("base64")}>
          Base64
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleCopy("c-array")}>
          C Array
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy("python-bytes")}>
          Python Bytes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy("go-slice")}>
          Go Byte Slice
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleCopy("decimal")}>
          Decimal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
