import { useState, useEffect, useRef } from "react";
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
  Activity,
  Send,
  Plus,
  MessageSquare,
  Trash2,
  ArrowLeft,
  Sun,
  Moon,
  Settings,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { fetchBinaryList } from "@/lib/api";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SettingsMcp } from "@/components/SettingsMcp";
import { useAISettings } from "@/hooks/useAISettings";

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

interface MCPStatus {
  connected_servers: number;
  total_tools: number;
  servers: Array<{
    name: string;
    connected: boolean;
    initialized: boolean;
    tools_count: number;
    version?: string;
  }>;
}

const Chat = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const userID = getUserID();
  const { settings: aiSettings, isConfigured } = useAISettings();
  const { settingsMcp: mcpSettings } = useAISettings();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [binaryFiles, setBinaryFiles] = useState<BinaryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    // Load from localStorage on mount (shared with Index page)
    return localStorage.getItem('selectedBinaryFile');
  });
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMcpOpen, setSettingsMcpOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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
  }, [messages, streamingMessage]);

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

  // Save selected file to localStorage whenever it changes (shared with Index page)
  useEffect(() => {
    if (selectedFile) {
      localStorage.setItem('selectedBinaryFile', selectedFile);
    } else {
      localStorage.removeItem('selectedBinaryFile');
    }
  }, [selectedFile]);

  // Load binary files
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const list = await fetchBinaryList();
        setBinaryFiles(list);

        if (list.length > 0) {
          // Validate that the selected file from localStorage still exists
          const fileExists = selectedFile && list.some(f => f.name === selectedFile);

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

  // Load MCP status
  useEffect(() => {
    const loadMCPStatus = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/mcp/status`);
        if (response.ok) {
          const status = await response.json();
          setMcpStatus(status);
        }
      } catch (err) {
        console.error("Failed to load MCP status:", err);
      }
    };
    loadMCPStatus();
    // Poll every 30 seconds
    const interval = setInterval(loadMCPStatus, 30000);
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
        loadSession(data.session_id);
        // Refresh session list
        ws?.send(
          JSON.stringify({
            type: "list_sessions",
            user_id: userID,
          }),
        );
        break;

      case "history":
        setMessages(data.messages || []);
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
        setIsStreaming(false);
        break;

      case "error":
        toast.error(data.error);
        setIsStreaming(false);
        setStreamingMessage("");
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

    ws.send(
      JSON.stringify({
        type: "load_session",
        user_id: userID,
        session_id: sessionId,
      }),
    );
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

    // Send to backend with optional file context
    ws.send(
      JSON.stringify({
        type: "message",
        user_id: userID,
        session_id: currentSessionId,
        message: input.trim(),
        file_name: selectedFile, // Include selected binary file for context
      }),
    );

    setInput("");
    setIsStreaming(true);
    streamingMessageRef.current = "";
    setStreamingMessage("");
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

          {/* MCP Status */}
          {mcpStatus && mcpStatus.connected_servers > 0 && (
            <div
              onClick={() => setSettingsMcpOpen(true)}
              className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-md cursor-pointer"
            >
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs font-medium text-foreground">
                MCP: {mcpStatus.connected_servers} server(s),{" "}
                {mcpStatus.total_tools} tool(s)
              </span>
            </div>
          )}

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
        <TooltipProvider delayDuration={300}>
          <div
            ref={sidebarRef}
            className="border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col relative"
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

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
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
                  {isStreaming && !streamingMessage && (
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
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <SettingsMcp
        open={settingsMcpOpen}
        onOpenChange={setSettingsMcpOpen}
        MCPStatus={mcpStatus}
      />
    </div>
  );
};

export default Chat;
