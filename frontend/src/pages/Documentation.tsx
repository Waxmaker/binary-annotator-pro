import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Search,
  Home,
  FileText,
  Upload,
  Settings,
  Palette,
  GitBranch,
  BarChart3,
  GitCompare,
  MessageSquare,
  Bookmark,
  Keyboard,
  Lightbulb,
  Code,
  ExternalLink,
  Server,
  Database,
  Container,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export default function Documentation() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("getting-started");

  const sections: Section[] = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: Home,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Getting Started</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Binary Annotator Pro is a professional reverse engineering tool
              designed for analyzing and documenting proprietary binary file
              formats, with a focus on medical device ECG files.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-6 hover:border-primary transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Hex Analysis</h3>
              <p className="text-muted-foreground">
                Complete binary visualization with annotations and color-coded
                highlights for easy pattern recognition.
              </p>
            </div>

            <div className="border rounded-lg p-6 hover:border-primary transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">YAML Configuration</h3>
              <p className="text-muted-foreground">
                Flexible data structure definition using YAML with support for
                16+ data types and automatic AI generation.
              </p>
            </div>

            <div className="border rounded-lg p-6 hover:border-primary transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Assistant</h3>
              <p className="text-muted-foreground">
                Integrated Ollama-powered AI to help analyze files, generate
                configurations, and answer questions.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 border rounded-lg p-6 mt-8">
            <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </span>
                <span>Upload your binary file using the "Files" tab</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </span>
                <span>
                  Review file information in the "Info" tab to understand the
                  structure
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </span>
                <span>
                  Create or generate a YAML configuration to define data
                  structures
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  4
                </span>
                <span>
                  Use the AI Chat to ask questions about the binary format
                </span>
              </li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "file-management",
      title: "File Management",
      icon: Upload,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">File Management</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Learn how to upload, manage, and navigate between binary files in
              Binary Annotator Pro.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Uploading Files</h3>
              <div className="border-l-4 border-primary pl-6 space-y-3">
                <p className="text-muted-foreground">
                  Binary files are stored directly in the SQLite database as
                  BLOB data, ensuring everything stays in one place.
                </p>
                <div className="space-y-2">
                  <p className="font-semibold">To upload a file:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Navigate to the "Files" tab in the left panel</li>
                    <li>Click "Upload Binary" button</li>
                    <li>Select your binary file (any format supported)</li>
                    <li>
                      The file will be stored and appear in your file list
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Quick File Selection
              </h3>
              <p className="text-muted-foreground mb-4">
                You can switch between files in multiple ways for faster
                workflow:
              </p>
              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Method 1: File List</h4>
                  <p className="text-sm text-muted-foreground">
                    Click any file in the "Files" tab to load it in the hex
                    viewer
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">
                    Method 2: Hex Viewer Dropdown
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Use the file selector dropdown in the hex viewer header for
                    instant switching
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">
                    Method 3: AI Chat Context
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Select a file in the chat interface to provide context for
                    your AI questions
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">File Information</h3>
              <p className="text-muted-foreground mb-4">
                Access detailed file statistics in the "Info" tab:
              </p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    <strong>Basic Info:</strong> File name, size, SHA-256 hash
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    <strong>Byte Statistics:</strong> Min, max, average values
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    <strong>Shannon Entropy:</strong> Detects compression or
                    encryption (0-8 scale)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    <strong>Byte Frequency:</strong> Histogram showing
                    distribution of byte values
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "yaml-configuration",
      title: "YAML Configuration",
      icon: FileText,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">YAML Configuration</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Define data structures and search patterns using flexible YAML
              configuration files.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Configuration Structure
              </h3>
              <p className="text-muted-foreground mb-4">
                A YAML configuration file contains two main sections:
              </p>
              <div className="bg-muted/50 rounded-lg p-6 font-mono text-sm">
                <pre className="overflow-x-auto">{`# Search patterns (executed on backend)
search:
  pattern_name:
    value: "FF FF"      # Value to search for
    type: hex           # Search type
    color: "#FF0000"    # Highlight color

# Fixed offset tags
tags:
  tag_name:
    offset: 0x1000      # Position in file (hex or decimal)
    size: 256           # Size in bytes
    color: "#00FF00"    # Highlight color`}</pre>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Supported Search Types
              </h3>
              <p className="text-muted-foreground mb-4">
                All search operations are performed server-side for optimal
                performance. Binary Annotator Pro supports 16+ data types:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">hex</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hex pattern (e.g., "FF 00 AA")
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">string-ascii</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    ASCII text string
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">string-utf8</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    UTF-8 text string
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">int8 / uint8</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    8-bit integers
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    int16le / int16be
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    16-bit signed integers
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    uint16le / uint16be
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    16-bit unsigned integers
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    int32le / int32be
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    32-bit signed integers
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    uint32le / uint32be
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    32-bit unsigned integers
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    float32le / float32be
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    32-bit floats
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    float64le / float64be
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    64-bit doubles
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    timestamp-unix32
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Unix timestamp (32-bit)
                  </p>
                </div>
                <div className="border rounded p-3">
                  <code className="text-sm font-semibold">
                    timestamp-unix64
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Unix timestamp (64-bit)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                YAML Editor Features
              </h3>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1 text-xl">→</span>
                  <div>
                    <strong>Tab Support:</strong> Press Tab to insert 2-space
                    indentation (YAML standard)
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1 text-xl">→</span>
                  <div>
                    <strong>Apply Changes:</strong> Click "Apply Changes" to
                    update the hex viewer with new highlights
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1 text-xl">→</span>
                  <div>
                    <strong>Auto-Validation:</strong> YAML is validated only
                    when saving to prevent lag during editing
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1 text-xl">→</span>
                  <div>
                    <strong>AI Generation:</strong> Click "AI" to automatically
                    generate a configuration based on file analysis
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-500" />
                Highlight Priority System
              </h4>
              <p className="text-sm text-muted-foreground">
                When multiple tags overlap, smaller (more specific) tags are
                displayed on top of larger ones. For example, a 2-byte red tag
                at 0x001 will be visible even if it's inside a 256-byte yellow
                tag at 0x000.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "pattern-analysis",
      title: "Pattern Analysis",
      icon: GitBranch,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Pattern Analysis</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Discover repeating patterns and periodic structures in your binary
              files.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Pattern Search</h3>
              <p className="text-muted-foreground mb-4">
                Automatically detect repeating byte sequences in your binary
                file:
              </p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    <strong>Min/Max Length:</strong> Configure pattern size
                    (2-16 bytes)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    <strong>Minimum Occurrences:</strong> Filter by how many
                    times a pattern repeats
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    <strong>Results:</strong> Click any pattern to jump to its
                    first occurrence in the hex viewer
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Pattern Clustering
              </h3>
              <p className="text-muted-foreground mb-4">
                Detect periodic structures that may indicate record boundaries
                or data frames:
              </p>
              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="text-sm mb-2">
                  The clustering algorithm analyzes byte distribution across the
                  file to find:
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                  <li>• Repeating data structures</li>
                  <li>• Record boundaries</li>
                  <li>• Header/footer patterns</li>
                  <li>• Fixed-size data blocks</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Server-Side Search Performance
              </h3>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                <p className="text-sm">
                  All search operations are executed on the Go backend for
                  maximum performance. This includes:
                </p>
                <ul className="space-y-1 text-sm mt-3 ml-4">
                  <li>• YAML-defined searches (16+ data types)</li>
                  <li>• Pattern matching and clustering</li>
                  <li>• Data type conversions and endianness handling</li>
                  <li>
                    • Large file processing (efficiently handles 50MB+ files)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "visualizations",
      title: "Advanced Visualizations",
      icon: BarChart3,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Advanced Visualizations</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Visualize binary data structure through entropy analysis,
              histograms, and more.
            </p>
          </div>

          <div className="grid gap-6">
            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Entropy Graph</h3>
              <p className="text-muted-foreground mb-4">
                Shannon entropy analysis plotted across the file length. Entropy
                values range from 0 (highly structured) to 8
                (random/compressed).
              </p>
              <div className="bg-muted/50 rounded p-4">
                <p className="text-sm font-semibold mb-2">
                  Entropy Interpretation:
                </p>
                <ul className="text-sm space-y-1">
                  <li>
                    <strong>0-4:</strong> Structured data (text, repetitive
                    patterns)
                  </li>
                  <li>
                    <strong>4-7:</strong> Mixed data (typical binary formats)
                  </li>
                  <li>
                    <strong>7-8:</strong> High entropy (compressed or encrypted
                    data)
                  </li>
                </ul>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Byte Histogram</h3>
              <p className="text-muted-foreground mb-4">
                Frequency distribution of all byte values (0x00 to 0xFF) in the
                file. Useful for:
              </p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Identifying dominant byte values</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Detecting null-byte padding</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Spotting ASCII vs binary sections</span>
                </li>
              </ul>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Digram Analysis</h3>
              <p className="text-muted-foreground">
                Analysis of consecutive byte pairs to reveal structural patterns
                and frequently occurring byte combinations.
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">2D Bitmap View</h3>
              <p className="text-muted-foreground">
                Renders the binary file as a 2D image (Binvis style) where
                structures become visually apparent through color patterns.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "comparison",
      title: "File Comparison",
      icon: GitCompare,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">File Comparison</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Compare multiple binary files side-by-side to identify differences
              and similarities.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Use Cases</h3>
              <div className="grid gap-4">
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-1">Version Comparison</h4>
                  <p className="text-sm text-muted-foreground">
                    Compare different versions of the same file format to track
                    changes
                  </p>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-1">
                    Dynamic Field Detection
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Identify which fields change between recordings vs static
                    fields
                  </p>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-1">Format Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Find common patterns across similar files to understand the
                    format structure
                  </p>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-1">Data Validation</h4>
                  <p className="text-sm text-muted-foreground">
                    Verify that certain fields remain constant across different
                    files
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Comparison Features
              </h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Side-by-side hex view of multiple files</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Byte-level difference highlighting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Synchronized scrolling across files</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Statistical difference summary</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "ai-assistant",
      title: "AI Assistant",
      icon: MessageSquare,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">AI Assistant</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Leverage AI to accelerate binary analysis with Ollama integration.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Setup</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    1
                  </span>
                  <div>
                    <p className="font-semibold">Install Ollama</p>
                    <p className="text-sm text-muted-foreground">
                      Download and install Ollama from{" "}
                      <a
                        href="https://ollama.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        ollama.ai
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    2
                  </span>
                  <div>
                    <p className="font-semibold">Pull a Model</p>
                    <code className="block mt-2 bg-muted p-2 rounded text-sm">
                      ollama pull qwen2.5-coder:7b
                    </code>
                    <p className="text-sm text-muted-foreground mt-2">
                      Recommended: qwen2.5-coder, llama3.2, codellama
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    3
                  </span>
                  <div>
                    <p className="font-semibold">
                      Configure in Binary Annotator
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Click "AI Settings" and enter your Ollama URL (default:
                      http://localhost:11434)
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">AI Chat</h3>
              <p className="text-muted-foreground mb-4">
                Open the AI Chat to ask questions about your binary files:
              </p>
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div>
                  <p className="font-semibold mb-2">Example Questions:</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">Q:</span>
                      <span>
                        "What is the structure of this ECG file format?"
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">Q:</span>
                      <span>
                        "Where might the timestamp be stored in this file?"
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">Q:</span>
                      <span>
                        "Can you help me create a YAML config for this format?"
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">Q:</span>
                      <span>
                        "What does the high entropy region at 0x1000 indicate?"
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Auto-Generate YAML Configuration
              </h3>
              <p className="text-muted-foreground mb-4">
                In the Config tab, click the "AI" button to automatically
                generate a YAML configuration:
              </p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Analyzes file structure, entropy, and patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Detects magic bytes and headers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Identifies potential data structures</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Generates initial tag and search definitions</span>
                </li>
              </ul>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
              <h4 className="font-semibold mb-2">File Context</h4>
              <p className="text-sm text-muted-foreground">
                Use the file selector in the chat header to specify which binary
                file you're asking about. The AI will use this context to
                provide more relevant answers.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "bookmarks",
      title: "Bookmarks & Notes",
      icon: Bookmark,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Bookmarks & Notes</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Save important offsets and add annotations to your binary files.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Creating Bookmarks
              </h3>
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <span>
                    Select bytes in the hex viewer by clicking or dragging
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <span>Navigate to the "Info" tab → Bookmarks section</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </span>
                  <span>Click "Add Bookmark"</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    4
                  </span>
                  <span>Enter a name and description for the bookmark</span>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Using Bookmarks</h3>
              <div className="border rounded-lg p-6 bg-muted/50">
                <p className="mb-4">
                  Bookmarks provide quick navigation to important file
                  locations:
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      Click any bookmark to jump to that offset in the hex
                      viewer
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      The byte range is automatically selected for easy
                      reference
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      Edit or delete bookmarks to keep your annotations
                      organized
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Bookmarks are stored per file in the database</span>
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Best Practices</h3>
              <div className="grid gap-4">
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-1">Descriptive Names</h4>
                  <p className="text-sm text-muted-foreground">
                    Use clear names like "Header Magic", "Sample Rate Offset",
                    or "Lead II Data Start"
                  </p>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-1">Document Findings</h4>
                  <p className="text-sm text-muted-foreground">
                    Add detailed descriptions explaining what the data
                    represents and how you determined it
                  </p>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-1">Organize by Type</h4>
                  <p className="text-sm text-muted-foreground">
                    Group related bookmarks with consistent naming (e.g.,
                    "Header - ...", "Data - ...")
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "api-reference",
      title: "API Reference",
      icon: Server,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">API Reference</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Complete REST API documentation for Binary Annotator Pro.
            </p>
            <div className="bg-muted/50 border rounded-lg p-4">
              <p className="text-sm">
                <strong>Base URL:</strong>{" "}
                <code className="bg-background px-2 py-1 rounded">
                  http://localhost:3000
                </code>
              </p>
              <p className="text-sm mt-2">
                <strong>Response Format:</strong> JSON
              </p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Binary Files */}
            <div>
              <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Database className="h-6 w-6 text-primary" />
                Binary Files
              </h3>
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">/upload/binary</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload a binary file to the database
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request:</p>
                    <code>Content-Type: multipart/form-data</code>
                    <br />
                    <code>file: [binary file]</code>
                    <p className="font-semibold mt-2 mb-1">Response:</p>
                    <code>{`{"message": "File uploaded", "fileName": "example.bin"}`}</code>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">/get/list/binary</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    List all binary files with metadata
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Response:</p>
                    <pre className="overflow-x-auto">{`[
  {
    "id": 1,
    "name": "file.bin",
    "size": 1024,
    "created_at": "2025-01-20T10:00:00Z"
  }
]`}</pre>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /get/binary/:fileName
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Download binary file content (returns raw bytes)
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /get/binary-by-id/:id
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Get binary file metadata by ID
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded">
                      PUT
                    </span>
                    <code className="text-sm font-mono">
                      /rename/binary/:name
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Rename a binary file
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request Body:</p>
                    <code>{`{"new_name": "newfile.bin"}`}</code>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                      DELETE
                    </span>
                    <code className="text-sm font-mono">
                      /delete/binary/:name
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Delete a binary file from database
                  </p>
                </div>
              </div>
            </div>

            {/* YAML Configurations */}
            <div>
              <h3 className="text-2xl font-semibold mb-4">
                YAML Configurations
              </h3>
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">/upload/yaml</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Save or update YAML configuration
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request Body:</p>
                    <code>{`{"name": "config.yaml", "content": "..."}`}</code>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">/get/list/yaml</code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    List all saved YAML configurations
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /get/yaml/:configName
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get YAML configuration content
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded">
                      PUT
                    </span>
                    <code className="text-sm font-mono">
                      /update/yaml/:name
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Update existing YAML configuration
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                      DELETE
                    </span>
                    <code className="text-sm font-mono">
                      /delete/yaml/:name
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Delete YAML configuration
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis & Search */}
            <div>
              <h3 className="text-2xl font-semibold mb-4">Analysis & Search</h3>
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">/search</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Search for patterns in binary file (16+ data types
                    supported)
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request Body:</p>
                    <pre className="overflow-x-auto">{`{
  "fileName": "file.bin",
  "searches": {
    "pattern_name": {
      "value": "FF FF",
      "type": "hex",
      "color": "#FF0000"
    }
  }
}`}</pre>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /analysis/trigrams/:name
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get trigram analysis for visualization
                  </p>
                </div>
              </div>
            </div>

            {/* Compression Detection */}
            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Compression Detection
              </h3>
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">
                      /analysis/compression/:fileId
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Start compression analysis on a file (tests 9+ algorithms)
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Response:</p>
                    <code>{`{"analysisId": 1, "status": "running"}`}</code>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /analysis/compression/:analysisId
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get compression analysis results with all test details
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /analysis/compression/file/:fileId/latest
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get most recent analysis for a file
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /decompressed/list
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    List all successfully decompressed files
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /decompressed/:id/data
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Download decompressed file binary data
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">
                      /analysis/compression/result/:resultId/add-to-files
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Add decompressed file to main files list
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                      DELETE
                    </span>
                    <code className="text-sm font-mono">
                      /analysis/compression/:analysisId
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Delete compression analysis and related decompressed files
                  </p>
                </div>
              </div>
            </div>

            {/* AI Integration */}
            <div>
              <h3 className="text-2xl font-semibold mb-4">AI Integration</h3>
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /ai/settings/:userId
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get AI settings (Ollama URL, model, etc.)
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">
                      /ai/settings/:userId
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Save AI settings
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request Body:</p>
                    <pre className="overflow-x-auto">{`{
  "provider": "ollama",
  "base_url": "http://localhost:11434",
  "model": "qwen2.5-coder:7b"
}`}</pre>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">/ai/test/:userId</code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Test AI connection
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded">
                      WS
                    </span>
                    <code className="text-sm font-mono">/ws/chat</code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    WebSocket endpoint for AI chat (streaming responses)
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /chat/sessions/:userId
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get all chat sessions for user
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                      DELETE
                    </span>
                    <code className="text-sm font-mono">
                      /chat/session/:sessionId
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Delete a chat session
                  </p>
                </div>
              </div>
            </div>

            {/* MCP Docker Manager */}
            <div>
              <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Container className="h-6 w-6 text-primary" />
                MCP Docker Manager
              </h3>
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /mcp/docker/health
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Check MCP Docker Manager health status
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">/mcp/docker/stats</code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get aggregated statistics about running MCP servers
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                      GET
                    </span>
                    <code className="text-sm font-mono">
                      /mcp/docker/servers
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    List all running MCP server containers
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">
                      /mcp/docker/servers/:name/start
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Start an MCP server container
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request Body:</p>
                    <code>{`{"image": "mcp/filesystem:latest"}`}</code>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">
                      /mcp/docker/servers/:name/stop
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Stop an MCP server container
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">
                      /mcp/docker/servers/:name/toggle
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Toggle server on/off
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request Body:</p>
                    <code>{`{"action": "start|stop", "image": "..."}`}</code>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                      POST
                    </span>
                    <code className="text-sm font-mono">
                      /mcp/docker/servers/:name/call
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Call a tool on an MCP server
                  </p>
                  <div className="bg-background rounded p-3 text-xs">
                    <p className="font-semibold mb-1">Request Body:</p>
                    <pre className="overflow-x-auto">{`{
  "tool": "read_file",
  "arguments": {
    "path": "/path/to/file"
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "mcp-integration",
      title: "MCP Integration",
      icon: Container,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">MCP Integration</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Model Context Protocol (MCP) integration for extending Binary
              Annotator Pro with containerized tools and services.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">What is MCP?</h3>
              <div className="bg-muted/50 border rounded-lg p-6">
                <p className="text-muted-foreground mb-4">
                  The Model Context Protocol (MCP) is an open standard for
                  connecting AI assistants to external data sources and tools.
                  Binary Annotator Pro implements MCP through a Docker-based
                  manager that runs MCP servers in isolated containers.
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>Isolated Execution:</strong> Each MCP server runs
                      in its own Docker container
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>Dynamic Management:</strong> Start/stop servers on
                      demand
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>Tool Discovery:</strong> Automatically discover
                      available tools from running servers
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>AI Integration:</strong> Tools are available to
                      the AI assistant during chat sessions
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Architecture</h3>
              <div className="border rounded-lg p-6 bg-muted/30">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-semibold">MCP Docker Manager</p>
                      <p className="text-sm text-muted-foreground">
                        Standalone Go service (port 8080) that manages Docker
                        containers
                      </p>
                      <code className="text-xs bg-background px-2 py-1 rounded mt-1 inline-block">
                        localhost:8080
                      </code>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-semibold">Backend Proxy</p>
                      <p className="text-sm text-muted-foreground">
                        Binary Annotator Pro backend proxies requests to the MCP
                        manager
                      </p>
                      <code className="text-xs bg-background px-2 py-1 rounded mt-1 inline-block">
                        /mcp/docker/* → localhost:8080/*
                      </code>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-semibold">MCP Server Containers</p>
                      <p className="text-sm text-muted-foreground">
                        Docker containers running MCP servers (filesystem,
                        binary-tools, etc.)
                      </p>
                      <code className="text-xs bg-background px-2 py-1 rounded mt-1 inline-block">
                        Docker network: mcp-network
                      </code>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">4</span>
                    </div>
                    <div>
                      <p className="font-semibold">AI Assistant</p>
                      <p className="text-sm text-muted-foreground">
                        AI chat discovers and uses tools from running MCP
                        servers
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Available MCP Servers
              </h3>
              <div className="grid gap-4">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <Container className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Filesystem Server</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Provides file system operations for AI assistant
                  </p>
                  <div className="text-xs">
                    <p className="font-semibold mb-1">Available Tools:</p>
                    <ul className="space-y-1 ml-4">
                      <li>
                        <code className="bg-background px-1 rounded">
                          read_file
                        </code>{" "}
                        - Read file contents
                      </li>
                      <li>
                        <code className="bg-background px-1 rounded">
                          write_file
                        </code>{" "}
                        - Write to files
                      </li>
                      <li>
                        <code className="bg-background px-1 rounded">
                          list_directory
                        </code>{" "}
                        - List directory contents
                      </li>
                      <li>
                        <code className="bg-background px-1 rounded">
                          search_files
                        </code>{" "}
                        - Search for files
                      </li>
                    </ul>
                    <p className="mt-2">
                      <strong>Image:</strong>{" "}
                      <code className="bg-background px-1 rounded">
                        mcp/filesystem:latest
                      </code>
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <Container className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Binary Tools Server</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Binary analysis tools (hex conversion, entropy, etc.)
                  </p>
                  <div className="text-xs">
                    <p className="font-semibold mb-1">Available Tools:</p>
                    <ul className="space-y-1 ml-4">
                      <li>
                        <code className="bg-background px-1 rounded">
                          hex_dump
                        </code>{" "}
                        - Generate hex dumps
                      </li>
                      <li>
                        <code className="bg-background px-1 rounded">
                          calculate_entropy
                        </code>{" "}
                        - Calculate Shannon entropy
                      </li>
                      <li>
                        <code className="bg-background px-1 rounded">
                          find_patterns
                        </code>{" "}
                        - Pattern matching
                      </li>
                      <li>
                        <code className="bg-background px-1 rounded">
                          checksum
                        </code>{" "}
                        - Calculate checksums
                      </li>
                    </ul>
                    <p className="mt-2">
                      <strong>Image:</strong>{" "}
                      <code className="bg-background px-1 rounded">
                        mcp/binary-tools:latest
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                Setup Instructions
              </h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold mb-2">
                      Build MCP Docker Manager
                    </p>
                    <div className="bg-background rounded p-3 font-mono text-xs">
                      <code>
                        cd mcp-docker-manager
                        <br />
                        make build-manager
                      </code>
                    </div>
                  </div>
                </li>

                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold mb-2">
                      Build MCP Server Images
                    </p>
                    <div className="bg-background rounded p-3 font-mono text-xs">
                      <code>
                        make build-binary-tools
                        <br />
                        docker-compose up -d
                      </code>
                    </div>
                  </div>
                </li>

                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    3
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold mb-2">Start MCP Manager</p>
                    <div className="bg-background rounded p-3 font-mono text-xs">
                      <code>./bin/mcp-docker-manager</code>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Manager will run on port 8080
                    </p>
                  </div>
                </li>

                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    4
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold mb-2">
                      Start Backend with MCP Support
                    </p>
                    <div className="bg-background rounded p-3 font-mono text-xs">
                      <code>
                        cd backend
                        <br />
                        export MCP_MANAGER_URL=http://localhost:8080
                        <br />
                        go run main.go
                      </code>
                    </div>
                  </div>
                </li>

                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    5
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold mb-2">
                      Access MCP Settings in UI
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Navigate to Settings → MCP Settings to manage servers and
                      view available tools
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Using MCP Tools</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold mb-2">In AI Chat</h4>
                  <p className="text-sm text-muted-foreground">
                    When MCP servers are running, their tools are automatically
                    available to the AI assistant. Simply ask questions like:
                  </p>
                  <div className="bg-muted/50 rounded p-3 mt-2 text-sm">
                    <p className="mb-1">
                      "Can you read the file at /tmp/sample.bin and analyze it?"
                    </p>
                    <p className="mb-1">
                      "Calculate the entropy of this binary section"
                    </p>
                    <p>"Search for files containing 'header' in their name"</p>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold mb-2">Via API</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Call MCP tools directly through the REST API:
                  </p>
                  <div className="bg-background rounded p-3 font-mono text-xs">
                    <pre className="overflow-x-auto">{`POST /mcp/docker/servers/filesystem/call
{
  "tool": "read_file",
  "arguments": {
    "path": "/path/to/file"
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-500" />
                MCP Best Practices
              </h4>
              <ul className="space-y-2 text-sm ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">
                    •
                  </span>
                  <span>
                    Start only the MCP servers you need to reduce resource usage
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">
                    •
                  </span>
                  <span>
                    Check server health regularly via the MCP Settings page
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">
                    •
                  </span>
                  <span>
                    Use tool approval system to control which tools the AI can
                    execute
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">
                    •
                  </span>
                  <span>
                    Create custom MCP servers by following the MCP specification
                    and adding to docker-compose.yml
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "keyboard-shortcuts",
      title: "Keyboard Shortcuts",
      icon: Keyboard,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Keyboard Shortcuts</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Speed up your workflow with keyboard shortcuts.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">YAML Editor</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Insert indentation</span>
                  <kbd className="px-3 py-1.5 bg-muted border rounded font-mono text-sm">
                    Tab
                  </kbd>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">AI Chat</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Send message</span>
                  <kbd className="px-3 py-1.5 bg-muted border rounded font-mono text-sm">
                    Enter
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">New line</span>
                  <kbd className="px-3 py-1.5 bg-muted border rounded font-mono text-sm">
                    Shift + Enter
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tips",
      title: "Tips & Best Practices",
      icon: Lightbulb,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Tips & Best Practices</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Get the most out of Binary Annotator Pro with these expert tips.
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-500" />
                Recommended Workflow
              </h3>
              <ol className="space-y-3 ml-4">
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    1.
                  </span>
                  <span>Upload your binary files through the Files tab</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    2.
                  </span>
                  <span>
                    Check the Info tab for file statistics and entropy analysis
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    3.
                  </span>
                  <span>
                    Use Analysis visualizations to understand the structure
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    4.
                  </span>
                  <span>
                    Search for patterns to identify repeating structures
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    5.
                  </span>
                  <span>
                    Create or AI-generate a YAML config to document the format
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    6.
                  </span>
                  <span>
                    Use AI Chat for specific questions about the format
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    7.
                  </span>
                  <span>Bookmark important offsets for quick reference</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    8.
                  </span>
                  <span>
                    Compare multiple files to identify variable fields
                  </span>
                </li>
              </ol>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Pro Tips</h3>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">
                    ✓
                  </span>
                  <span>
                    <strong>Smaller tags are always visible:</strong> When tags
                    overlap, more specific (smaller) tags display on top
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">
                    ✓
                  </span>
                  <span>
                    <strong>Quick file switching:</strong> Use the hex viewer
                    dropdown instead of the Files tab for faster navigation
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">
                    ✓
                  </span>
                  <span>
                    <strong>Server-side searches:</strong> All search operations
                    run on the backend for better performance
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">
                    ✓
                  </span>
                  <span>
                    <strong>Apply Changes button:</strong> Prevents lag during
                    YAML editing - apply only when ready
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">
                    ✓
                  </span>
                  <span>
                    <strong>Database storage:</strong> All files and configs are
                    stored in SQLite for portability
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">
                    ✓
                  </span>
                  <span>
                    <strong>Copy As menu:</strong> Export selections in multiple
                    formats (hex, base64, C array, etc.)
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Limitations</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 dark:text-orange-400 mt-1">
                    !
                  </span>
                  <span>Very large files (&gt;50MB) may cause UI slowdown</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 dark:text-orange-400 mt-1">
                    !
                  </span>
                  <span>AI features require Ollama installed locally</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 dark:text-orange-400 mt-1">
                    !
                  </span>
                  <span>
                    Searches on large files may take a few seconds to complete
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 dark:text-orange-400 mt-1">
                    !
                  </span>
                  <span>
                    Only one file can be viewed in the hex viewer at a time
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "technical",
      title: "Technical Details",
      icon: Code,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Technical Details</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Architecture and technical implementation details.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Technology Stack</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-6">
                  <h4 className="font-semibold mb-3">Frontend</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>React 18 + TypeScript</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>Vite (build tool)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>shadcn/ui + Tailwind CSS</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>TanStack Query (data fetching)</span>
                    </li>
                  </ul>
                </div>

                <div className="border rounded-lg p-6">
                  <h4 className="font-semibold mb-3">Backend</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>Go 1.25+</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>Echo v4 (web framework)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>GORM (ORM)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      <span>SQLite (database)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">
                REST API Endpoints
              </h3>
              <div className="space-y-2 font-mono text-sm">
                <div className="border rounded p-3 bg-muted/50">
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    POST
                  </span>{" "}
                  <span className="text-muted-foreground">/upload/binary</span>
                  <p className="text-xs text-muted-foreground mt-1 ml-16">
                    Upload binary file
                  </p>
                </div>
                <div className="border rounded p-3 bg-muted/50">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    GET
                  </span>{" "}
                  <span className="text-muted-foreground">
                    /get/list/binary
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 ml-16">
                    List all binary files
                  </p>
                </div>
                <div className="border rounded p-3 bg-muted/50">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    GET
                  </span>{" "}
                  <span className="text-muted-foreground">
                    /get/binary/:name
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 ml-16">
                    Download binary file
                  </p>
                </div>
                <div className="border rounded p-3 bg-muted/50">
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    DELETE
                  </span>{" "}
                  <span className="text-muted-foreground">
                    /delete/binary/:name
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 ml-16">
                    Delete binary file
                  </p>
                </div>
                <div className="border rounded p-3 bg-muted/50">
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    POST
                  </span>{" "}
                  <span className="text-muted-foreground">/search</span>
                  <p className="text-xs text-muted-foreground mt-1 ml-16">
                    Search patterns (16+ types)
                  </p>
                </div>
                <div className="border rounded p-3 bg-muted/50">
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                    WS
                  </span>{" "}
                  <span className="text-muted-foreground">/ws/chat</span>
                  <p className="text-xs text-muted-foreground mt-1 ml-16">
                    AI chat WebSocket
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Data Storage</h3>
              <div className="border rounded-lg p-6 bg-muted/50">
                <p className="mb-4">
                  Binary Annotator Pro uses SQLite with the following schema:
                </p>
                <ul className="space-y-2 text-sm ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>files:</strong> Binary files stored as BLOBs
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>yaml_configs:</strong> Saved YAML configurations
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>tags:</strong> Tag definitions and annotations
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>notes:</strong> User bookmarks and notes
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>
                      <strong>chat_sessions:</strong> AI chat history
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Performance</h3>
              <div className="grid gap-4">
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold mb-1">Server-Side Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    All heavy computations (searches, pattern matching, data
                    conversions) run on the Go backend for optimal speed
                  </p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold mb-1">Virtual Scrolling</h4>
                  <p className="text-sm text-muted-foreground">
                    The hex viewer only renders visible lines, handling large
                    files efficiently
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold mb-1">Streaming Responses</h4>
                  <p className="text-sm text-muted-foreground">
                    AI chat uses WebSocket streaming for real-time response
                    display
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;

    const query = searchQuery.toLowerCase();
    return sections.filter(
      (section) =>
        section.title.toLowerCase().includes(query) ||
        section.id.toLowerCase().includes(query),
    );
  }, [searchQuery, sections]);

  const activeContent = sections.find((s) => s.id === activeSection);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workbench
          </Button>
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Documentation</h1>
            <p className="text-xs text-muted-foreground">
              Complete guide to Binary Annotator Pro
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-panel-border bg-muted/30 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-panel-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Navigation Menu */}
          <ScrollArea className="flex-1 p-4">
            <nav className="space-y-1">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-panel-border">
            <p className="text-xs text-muted-foreground">
              Binary Annotator Pro
              <br />
              v1.0.0
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto p-8">
              {activeContent?.content}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
