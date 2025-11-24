import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { getUserID } from "@/hooks/useUserID";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Activity,
  Send,
  Plus,
  MessageSquare,
  Trash2,
  ArrowLeft,
  Menu,
  X,
  Sun,
  Moon,
  Settings,
  Sparkles,
  Database,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchBinaryFile, fetchBinaryList } from "@/lib/api";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SettingsMcp } from "@/components/SettingsMcp";
import { RAGFileManager } from "@/components/RAGFileManager";
import { useAISettings } from "@/hooks/useAISettings";
import { HexViewer } from "@/components/HexViewer";
import { useHexSelection } from "@/hooks/useHexSelection";

interface ChatMessage {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface BinaryFile {
  name: string;
  size: number;
}

const Chat = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const userID = getUserID();
  const { settings: aiSettings, isConfigured } = useAISettings();
  const { settingsMcp: mcpSettings } = useAISettings();
  const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [thinkingMessage, setThinkingMessage] = useState("");
  const [binaryFiles, setBinaryFiles] = useState<BinaryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    // Load from localStorage on mount (shared with Index page)
    return localStorage.getItem("selectedBinaryFile");
  });

  // Hex viewer states
  const [currentBuffer, setCurrentBuffer] = useState<ArrayBuffer | null>(null);
  const [isLoadingBuffer, setIsLoadingBuffer] = useState(false);
  const [hexViewerVisible, setHexViewerVisible] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(660);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [dockerStats, setDockerStats] = useState<{
    serverCount: number;
    totalTools: number;
  } | null>(null);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMcpOpen, setSettingsMcpOpen] = useState(false);
  const [ragManagerOpen, setRagManagerOpen] = useState(false);
  const [pendingToolApproval, setPendingToolApproval] = useState<{
    tool_name: string;
    arguments: Record<string, any>;
    server: string;
  } | null>(null);
  const [ragEnabled, setRagEnabled] = useState(() => {
    // Load RAG preference from localStorage
    const saved = localStorage.getItem("ragEnabled");
    return saved !== null ? saved === "true" : false;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef("");
  const thinkingMessageRef = useRef("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Hex selection hook for the hex viewer
  const {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    selectRange,
  } = useHexSelection(currentBuffer);

  const handleByteClick = useCallback(
    (offset: number) => {
      if (isSelecting) {
        updateSelection(offset);
        endSelection();
      } else {
        startSelection(offset);
      }
    },
    [isSelecting, startSelection, updateSelection, endSelection],
  );

  const handleByteMouseEnter = useCallback(
    (offset: number) => {
      if (isSelecting) {
        updateSelection(offset);
      }
    },
    [isSelecting, updateSelection],
  );

  // Available commands
  const availableCommands = [
    { command: "/mcp-status", description: "Show MCP connection status" },
    { command: "/mcp-list", description: "List all available MCP tools" },
  ];

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, thinkingMessage]);

  // Auto-focus input when session changes or component mounts
  useEffect(() => {
    if (currentSessionId && inputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentSessionId]);

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    }
  };

  const stopResizingRightPanel = () => {
    setIsResizingRightPanel(false);
  };

  const resizeRightPanel = (e: MouseEvent) => {
    if (isResizingRightPanel) {
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setRightPanelWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  useEffect(() => {
    if (isResizingRightPanel) {
      window.addEventListener("mousemove", resizeRightPanel);
      window.addEventListener("mouseup", stopResizingRightPanel);
    }
    return () => {
      window.removeEventListener("mousemove", resizeRightPanel);
      window.removeEventListener("mouseup", stopResizingRightPanel);
    };
  }, [isResizingRightPanel]);

  // Save selected file to localStorage whenever it changes (shared with Index page)
  useEffect(() => {
    if (selectedFile) {
      localStorage.setItem("selectedBinaryFile", selectedFile);
    } else {
      localStorage.removeItem("selectedBinaryFile");
    }
  }, [selectedFile]);

  // Load binary buffer when file is selected
  useEffect(() => {
    if (!selectedFile) {
      setCurrentBuffer(null);
      setHexViewerVisible(false);
      return;
    }

    const loadBinaryBuffer = async () => {
      setIsLoadingBuffer(true);
      try {
        const buffer = await fetchBinaryFile(selectedFile);
        setCurrentBuffer(buffer);

        // Auto-show hex viewer when a file is loaded
        setHexViewerVisible(true);

        toast.success(
          `Loaded ${selectedFile} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
        );
      } catch (err) {
        console.error("Failed to load binary buffer:", err);
        toast.error(`Failed to load ${selectedFile}`);
        setCurrentBuffer(null);
        setHexViewerVisible(false);
      } finally {
        setIsLoadingBuffer(false);
      }
    };

    loadBinaryBuffer();
  }, [selectedFile]);

  // Load binary files
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const list = await fetchBinaryList();
        setBinaryFiles(list);

        if (list.length > 0) {
          // Validate that the selected file from localStorage still exists
          const fileExists =
            selectedFile && list.some((f) => f.name === selectedFile);

          if (!fileExists) {
            // If saved file doesn't exist, select the first one
            setSelectedFile(list[0].name);
          }
        }
      } catch (err) {
        console.error("Failed to load binary files:", err);
      }
    };
    loadFiles();
  }, []);

  // Load MCP Docker stats
  useEffect(() => {
    const loadDockerStats = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/mcp/docker/stats`);
        if (response.ok) {
          const stats = await response.json();
          setDockerStats({
            serverCount: stats.serverCount || 0,
            totalTools: stats.totalTools || 0,
          });
        }
      } catch (err) {
        console.error("Failed to load MCP Docker stats:", err);
      }
    };
    loadDockerStats();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(loadDockerStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : "localhost:3000";
    const wsUrl = `${protocol}//${host}/ws/chat`;

    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("Chat WebSocket connected");
      setConnected(true);
      setWs(websocket);

      // Request session list
      websocket.send(
        JSON.stringify({
          type: "list_sessions",
          user_id: userID,
        }),
      );
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWSMessage(data);
    };

    websocket.onerror = (error) => {
      console.error("Chat WebSocket error:", error);
      toast.error("Connection error");
    };

    websocket.onclose = () => {
      console.log("Chat WebSocket disconnected");
      setConnected(false);
    };

    return () => {
      websocket.close();
    };
  }, [userID]);

  const handleWSMessage = (data: any) => {
    switch (data.type) {
      case "sessions":
        setSessions(data.sessions || []);
        break;

      case "session_created":
        setCurrentSessionId(data.session_id);
        // Optimistically add new session to the list
        const newSession: ChatSession = {
          id: data.session_id,
          title: data.title || "New Chat",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSessions((prev) => [newSession, ...prev]);
        loadSession(data.session_id);
        break;

      case "history":
        setMessages(data.messages || []);
        break;

      case "thinking":
        thinkingMessageRef.current += data.thinking;
        setThinkingMessage(thinkingMessageRef.current);
        break;

      case "chunk":
        streamingMessageRef.current += data.chunk;
        setStreamingMessage(streamingMessageRef.current);
        break;

      case "done":
        // Add streaming message to messages
        const finalMessage = streamingMessageRef.current;
        if (finalMessage) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: finalMessage,
            },
          ]);
        }
        streamingMessageRef.current = "";
        setStreamingMessage("");
        thinkingMessageRef.current = "";
        setThinkingMessage("");
        setIsStreaming(false);
        break;

      case "error":
        toast.error(data.error);
        setIsStreaming(false);
        setStreamingMessage("");
        setThinkingMessage("");
        break;

      case "tool_approval_request":
        if (data.tool_approval) {
          setPendingToolApproval(data.tool_approval);
        }
        break;
    }
  };

  const createNewSession = () => {
    if (!ws || !connected) {
      toast.error("Not connected");
      return;
    }

    ws.send(
      JSON.stringify({
        type: "new_session",
        user_id: userID,
      }),
    );
  };

  const loadSession = (sessionId: number) => {
    if (!ws || !connected) return;

    setCurrentSessionId(sessionId);
    setMessages([]);
    setStreamingMessage("");
    setThinkingMessage("");

    ws.send(
      JSON.stringify({
        type: "load_session",
        user_id: userID,
        session_id: sessionId,
      }),
    );
  };

  const handleToolApproval = (approved: boolean) => {
    if (!ws || !connected || !currentSessionId) {
      toast.error("Not connected");
      return;
    }

    ws.send(
      JSON.stringify({
        type: "tool_approval",
        user_id: userID,
        session_id: currentSessionId,
        tool_approved: approved,
      }),
    );

    // Clear pending approval
    setPendingToolApproval(null);
  };

  const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Delete this conversation?")) return;

    try {
      const API_BASE_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000";
      const res = await fetch(`${API_BASE_URL}/chat/session/${sessionId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete session");

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }

      toast.success("Conversation deleted");
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  // Format hex selection for AI analysis
  const formatHexSelection = () => {
    if (!selection || !currentBuffer) return null;

    const bytes = new Uint8Array(
      currentBuffer,
      selection.start,
      selection.end - selection.start,
    );
    const hexArray = Array.from(bytes).map((b) =>
      b.toString(16).padStart(2, "0").toUpperCase(),
    );
    const hexString = hexArray.join(" ");

    // Also include ASCII representation if readable
    let asciiString = "";
    try {
      asciiString = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      // Filter to readable characters
      asciiString = asciiString.replace(/[^\x20-\x7E]/g, ".");
    } catch (e) {
      asciiString = "[Binary data]";
    }

    return {
      offset: selection.start,
      size: selection.end - selection.start,
      hex: hexString,
      ascii: asciiString,
      rawBytes: Array.from(bytes),
    };
  };

  const sendMessage = () => {
    if (!input.trim() || !ws || !connected || isStreaming) return;

    if (!currentSessionId) {
      toast.error("Create or select a conversation first");
      return;
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Format hex selection if available
    const hexSelection = formatHexSelection();

    // Send to backend with optional file context, RAG preference, and hex selection
    ws.send(
      JSON.stringify({
        type: "message",
        user_id: userID,
        session_id: currentSessionId,
        message: input.trim(),
        file_name: selectedFile, // Include selected binary file for context
        rag_enabled: ragEnabled, // Include RAG preference
        hex_selection: hexSelection, // Include hex selection for analysis
      }),
    );

    setInput("");
    setIsStreaming(true);
    streamingMessageRef.current = "";
    setStreamingMessage("");
    thinkingMessageRef.current = "";
    setThinkingMessage("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Show command suggestions if input starts with /
    if (value.startsWith("/") && value.length > 0) {
      const search = value.toLowerCase();
      const filtered = availableCommands.filter((cmd) =>
        cmd.command.toLowerCase().startsWith(search),
      );
      setShowCommandSuggestions(filtered.length > 0);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
    }
  };

  const toggleRAG = (enabled: boolean) => {
    setRagEnabled(enabled);
    localStorage.setItem("ragEnabled", enabled.toString());
    toast.success(enabled ? "RAG enabled" : "RAG disabled");
  };

  const handleCommandSelect = (command: string) => {
    setInput(command);
    setShowCommandSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommandSuggestions) {
      const filteredCommands = availableCommands.filter((cmd) =>
        cmd.command.toLowerCase().startsWith(input.toLowerCase()),
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (filteredCommands.length > 0) {
          e.preventDefault();
          handleCommandSelect(filteredCommands[selectedCommandIndex].command);
        }
      } else if (e.key === "Escape") {
        setShowCommandSuggestions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Helper to render message content with tool call styling
  const renderMessageContent = (content: string) => {
    const toolCallRegex = /🔧 Calling tool: ([^\n.]+)\.{3}/g;
    const parts: { type: "text" | "tool"; content: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = toolCallRegex.exec(content)) !== null) {
      // Add text before tool call
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.substring(lastIndex, match.index),
        });
      }
      // Add tool call
      parts.push({
        type: "tool",
        content: match[0],
      });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex),
      });
    }

    return parts.map((part, idx) => {
      if (part.type === "tool") {
        return (
          <div
            key={idx}
            className="inline-flex items-center gap-2 px-3 py-1.5 my-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 text-sm font-medium"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
              {part.content}
            </div>
          </div>
        );
      }
      return <span key={idx}>{part.content}</span>;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className="gap-2"
          >
            {sidebarVisible ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
            Conversations
          </Button>
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Chat</h1>
            <p className="text-xs text-muted-foreground">
              Reverse Engineering Assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Binary File Selector */}
          {binaryFiles.length > 0 && (
            <Select value={selectedFile || ""} onValueChange={setSelectedFile}>
              <SelectTrigger className="w-64 flex justify-between h-8 text-sm">
                <SelectValue placeholder="Select binary..." />
              </SelectTrigger>
              <SelectContent>
                {binaryFiles.map((file) => (
                  <SelectItem
                    key={file.name}
                    value={file.name}
                    className="text-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-xs text-muted-foreground">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {/* MCP Docker Status */}
          {dockerStats && dockerStats.serverCount > 0 && (
            <div
              onClick={() => setSettingsMcpOpen(true)}
              className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-md cursor-pointer hover:bg-primary/20 transition-colors"
            >
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-foreground">
                MCP: {dockerStats.serverCount} server(s),{" "}
                {dockerStats.totalTools} tool(s)
              </span>
            </div>
          )}

          {/* RAG Controls - Unified Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-3 border-gray-200 dark:border-gray-700"
              >
                <Database
                  className={`h-4 w-4 ${ragEnabled ? "text-green-500 animate-pulse" : "text-gray-400"}`}
                />
                <span className="text-xs font-medium">RAG</span>
                <div
                  className={`h-1.5 w-1.5 rounded-full ${ragEnabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                />
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                  <Database className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold text-sm">RAG Configuration</h3>
                    <p className="text-xs text-muted-foreground">
                      Retrieval-Augmented Generation
                    </p>
                  </div>
                </div>

                {/* RAG Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-md ${ragEnabled ? "bg-green-100 dark:bg-green-950" : "bg-gray-100 dark:bg-gray-800"}`}
                    >
                      <Database
                        className={`h-4 w-4 ${ragEnabled ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="rag-popover-toggle"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Enable RAG
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {ragEnabled ? "Using document context" : "Disabled"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="rag-popover-toggle"
                    checked={ragEnabled}
                    onCheckedChange={toggleRAG}
                  />
                </div>

                {/* Document Manager */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Documents
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRagManagerOpen(true)}
                    className="w-full justify-start gap-2 h-9"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Manage RAG Documents</span>
                  </Button>
                </div>

                {/* Status Info */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div
                      className={`h-2 w-2 rounded-full ${ragEnabled ? "bg-green-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"}`}
                    />
                    <span>
                      {ragEnabled
                        ? "RAG service active"
                        : "RAG service inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* MCP Settings Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettingsMcpOpen(true)}
                  className="h-8 w-8 p-0 relative"
                >
                  <Settings className="h-4 w-4" />
                  {dockerStats && dockerStats.serverCount > 0 && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white">
                        {dockerStats.serverCount}
                      </span>
                    </div>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>MCP Settings</p>
                {dockerStats && dockerStats.serverCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {dockerStats.serverCount} server(s) active
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHexViewerVisible(!hexViewerVisible)}
                  className={`h-8 w-8 p-0 ${hexViewerVisible ? "bg-primary/10 text-primary" : ""}`}
                >
                  <Database className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Hex Viewer</p>
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    Loaded: {selectedFile}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 p-0"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Sessions */}
        {sidebarVisible && (
          <TooltipProvider delayDuration={300}>
            <div
              ref={sidebarRef}
              className="border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col relative"
              style={{ width: sidebarWidth }}
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <Button
                  onClick={createNewSession}
                  className="w-full gap-2"
                  disabled={!connected}
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {sessions.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No conversations yet.
                      <br />
                      Create a new chat to get started.
                    </div>
                  )}
                  {sessions.map((session) => (
                    <div key={session.id} className="group relative w-full p-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => loadSession(session.id)}
                            className={`
                            flex items-center gap-3 p-3 pr-2 rounded-lg cursor-pointer
                            transition-all duration-200 border border-transparent w-full
                            ${
                              currentSessionId === session.id
                                ? "bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30 shadow-sm"
                                : "hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                            }
                          `}
                          >
                            <div
                              className={`
                            flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center
                            ${
                              currentSessionId === session.id
                                ? "bg-primary/20 dark:bg-primary/30 text-primary"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-gray-300 dark:group-hover:bg-gray-600"
                            }
                          `}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </div>
                            <span
                              className={`
                            text-sm truncate font-medium flex-1 max-w-36
                            ${currentSessionId === session.id ? "text-foreground" : "text-muted-foreground"}
                          `}
                            >
                              {session.title}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => deleteSession(session.id, e)}
                              className="h-7 w-7 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 hover:scale-110"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-sm">{session.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(session.updated_at).toLocaleString()}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Settings Footer */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSettingsOpen(true)}
                      className="w-full justify-start gap-2 relative"
                    >
                      {isConfigured ? (
                        <Sparkles className="h-4 w-4 text-primary" />
                      ) : (
                        <Settings className="h-4 w-4" />
                      )}
                      <span className="flex-1 text-left truncate">
                        AI Settings
                      </span>
                      {isConfigured && (
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-sm">
                      {isConfigured
                        ? `Using ${aiSettings.provider}`
                        : "Configure AI provider"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex bg-white dark:bg-gray-950">
          {/* Chat Section */}
          <div className="flex-1 flex flex-col">
            {currentSessionId ? (
              <>
                {/* Messages */}
                <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
                  <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`
                          max-w-[80%] px-4 py-3 rounded-lg
                          ${
                            msg.role === "user"
                              ? "bg-gray-800 text-gray-100"
                              : "bg-transparent text-gray-900 dark:text-gray-100"
                          }
                        `}
                        >
                          <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                            {msg.role === "assistant"
                              ? renderMessageContent(msg.content)
                              : msg.content}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Typing indicator when waiting for response */}
                    {isStreaming && !streamingMessage && !thinkingMessage && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-4 py-3 rounded-lg bg-transparent">
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Thinking message - Reasoning trace */}
                    {isStreaming && thinkingMessage && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-4 py-3 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/50 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse" />
                              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide">
                                Thinking
                              </span>
                            </div>
                          </div>
                          <div className="text-[14px] leading-relaxed whitespace-pre-wrap text-purple-900 dark:text-purple-100 italic font-light">
                            {thinkingMessage}
                            <span className="inline-block w-1.5 h-4 bg-purple-600 dark:bg-purple-400 animate-pulse ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Streaming message */}
                    {isStreaming && streamingMessage && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-4 py-3 rounded-lg bg-transparent text-gray-900 dark:text-gray-100">
                          <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                            {renderMessageContent(streamingMessage)}
                            <span className="inline-block w-1.5 h-5 bg-gray-900 dark:bg-gray-100 animate-pulse ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Tool Approval Request */}
                {pendingToolApproval && (
                  <div className="border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                            Tool Execution Request
                          </h4>
                          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                            The AI wants to execute the following tool:
                          </p>
                          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 mb-3 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-mono font-semibold text-gray-900 dark:text-gray-100">
                                {pendingToolApproval.tool_name}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({pendingToolApproval.server})
                              </span>
                            </div>
                            {Object.keys(pendingToolApproval.arguments).length >
                              0 && (
                              <div className="text-xs">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Arguments:
                                </span>
                                <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded text-gray-800 dark:text-gray-200 overflow-x-auto">
                                  {JSON.stringify(
                                    pendingToolApproval.arguments,
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleToolApproval(true)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Allow
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToolApproval(false)}
                              className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              Deny
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                  <div className="max-w-3xl mx-auto">
                    <div className="relative flex gap-2">
                      {/* Command Suggestions Dropdown */}
                      {showCommandSuggestions && (
                        <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                          {availableCommands
                            .filter((cmd) =>
                              cmd.command
                                .toLowerCase()
                                .startsWith(input.toLowerCase()),
                            )
                            .map((cmd, index) => (
                              <div
                                key={cmd.command}
                                onClick={() => handleCommandSelect(cmd.command)}
                                className={`
                                px-4 py-3 cursor-pointer transition-colors
                                ${
                                  index === selectedCommandIndex
                                    ? "bg-primary/10 dark:bg-primary/20"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                }
                              `}
                              >
                                <div className="font-mono text-sm font-medium text-foreground">
                                  {cmd.command}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {cmd.description}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything about binary analysis... (Type / for commands)"
                        className="flex-1 min-h-[60px] max-h-[200px] resize-none"
                        disabled={isStreaming}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!input.trim() || isStreaming}
                        size="lg"
                        className="px-6"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No conversation selected</p>
                  <p className="text-sm">Create a new chat to get started</p>
                </div>
              </div>
            )}
          </div>
          {/* End Chat Section */}

          {/* Right Panel - Hex Viewer */}
          {hexViewerVisible && (
            <>
              {/* Resize Handle */}
              <div
                className="w-1 bg-gray-200 dark:bg-gray-700 cursor-ew-resize hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                onMouseDown={() => setIsResizingRightPanel(true)}
              />

              {/* Hex Viewer Panel */}
              <div
                ref={rightPanelRef}
                className="flex flex-col border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900"
                style={{ width: rightPanelWidth }}
              >
                {/* Hex Viewer Header */}
                <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Hex Viewer</h3>
                    {selectedFile && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {selectedFile}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHexViewerVisible(false)}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                </div>

                {/* Hex Viewer Content */}
                <div className="flex-1 overflow-hidden">
                  {isLoadingBuffer ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm">Loading binary data...</p>
                      </div>
                    </div>
                  ) : currentBuffer ? (
                    <HexViewer
                      buffer={currentBuffer}
                      fileName={selectedFile || undefined}
                      fileSize={
                        binaryFiles.find((f) => f.name === selectedFile)?.size
                      }
                      highlights={[]} // No highlights for now
                      selection={selection}
                      onByteClick={handleByteClick}
                      onByteMouseEnter={handleByteMouseEnter}
                      scrollToOffset={scrollToOffset}
                      onClearSelection={clearSelection}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No binary file loaded</p>
                        <p className="text-xs mt-1">
                          Select a file from the header to view
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <SettingsMcp open={settingsMcpOpen} onOpenChange={setSettingsMcpOpen} />
      <RAGFileManager open={ragManagerOpen} onOpenChange={setRagManagerOpen} />
    </div>
  );
};

export default Chat;
