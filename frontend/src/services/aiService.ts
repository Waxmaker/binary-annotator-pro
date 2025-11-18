import { getUserID } from "@/hooks/useUserID";
import { wsService } from "./websocketService";

export interface AIResponse {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * Call AI via WebSocket (backend handles provider routing)
 */
async function callAI(prompt: string): Promise<AIResponse> {
  try {
    const userID = getUserID();
    const response = await wsService.sendRequest({
      user_id: userID,
      prompt,
    });
    return response;
  } catch (error: any) {
    return {
      success: false,
      error: `AI request failed: ${error.message}`,
    };
  }
}

/**
 * Helper: Predict field type from bytes
 */
export async function predictFieldType(
  bytes: number[],
  offset: number
): Promise<AIResponse> {
  const hexBytes = bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");

  const prompt = `Analyze these bytes at offset 0x${offset.toString(16)}:
${hexBytes}

What data type could this be? Consider:
- Integer types (int8, int16, int32, int64, signed/unsigned)
- Float types (float32, float64)
- String data (ASCII, UTF-8)
- Timestamp formats
- Common binary structures

Provide a concise answer with:
1. Most likely type
2. Interpreted value (if applicable)
3. Brief explanation

Keep response under 100 words.`;

  return callAI(prompt);
}

/**
 * Helper: Explain pattern cluster
 */
export async function explainPattern(
  pattern: number[],
  occurrences: number
): Promise<AIResponse> {
  const hexPattern = pattern
    .slice(0, 32)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  const prompt = `Analyze this repeating binary pattern (${occurrences} occurrences):
${hexPattern}${pattern.length > 32 ? "..." : ""}

What could this pattern represent? Consider:
- Header/footer markers
- Record separators
- Padding patterns
- Checksum/CRC values
- Common file format structures

Provide a concise explanation under 100 words.`;

  return callAI(prompt);
}

/**
 * Helper: Suggest file structure
 */
export async function suggestStructure(
  fileInfo: {
    size: number;
    entropy: number;
    periodicPatterns: Array<{ period: number; confidence: number }>;
  }
): Promise<AIResponse> {
  const prompt = `Analyze this binary file:
- Size: ${fileInfo.size} bytes
- Entropy: ${fileInfo.entropy.toFixed(3)} bits
- Periodic structures detected: ${fileInfo.periodicPatterns.map((p) => `${p.period} bytes (${(p.confidence * 100).toFixed(0)}% confidence)`).join(", ")}

Based on this information, what type of file format could this be?
Consider ECG data, medical device recordings, sensor data, custom binary formats.

Provide:
1. Most likely format type
2. Suggested record size (if applicable)
3. Next analysis steps

Keep response under 150 words.`;

  return callAI(prompt);
}

/**
 * Helper: Generate YAML from description
 */
export async function generateYAML(
  description: string,
  sampleBytes?: number[]
): Promise<AIResponse> {
  let prompt = `Generate a Kaitai Struct YAML configuration for: ${description}\n\n`;

  if (sampleBytes && sampleBytes.length > 0) {
    const hexSample = sampleBytes
      .slice(0, 64)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    prompt += `Sample bytes:\n${hexSample}\n\n`;
  }

  prompt += `Generate a valid Kaitai Struct YAML that defines:
1. Sequence of fields
2. Appropriate data types
3. Field names and descriptions

Return only the YAML code, no explanations.`;

  return callAI(prompt);
}

/**
 * Helper: Auto-generate YAML tags from binary file analysis
 */
export async function autoGenerateYAMLTags(
  fileAnalysis: {
    fileName: string;
    fileSize: number;
    firstBytes: number[];
    entropy: number;
    patterns: Array<{
      offset: number;
      bytes: number[];
      occurrences: number;
    }>;
    periodicStructures?: Array<{
      period: number;
      confidence: number;
    }>;
  }
): Promise<AIResponse> {
  try {
    const userID = getUserID();
    const response = await wsService.sendRequest({
      user_id: userID,
      prompt: "", // Not used when file_analysis is provided
      file_analysis: {
        file_name: fileAnalysis.fileName,
        file_size: fileAnalysis.fileSize,
        first_bytes: fileAnalysis.firstBytes,
        entropy: fileAnalysis.entropy,
        patterns: fileAnalysis.patterns,
        periodic_structures: fileAnalysis.periodicStructures,
      },
    });
    return response;
  } catch (error: any) {
    return {
      success: false,
      error: `AI request failed: ${error.message}`,
    };
  }
}

