import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { getUserID } from "@/hooks/useUserID";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";
import { fetchBinaryList } from "@/lib/api";

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
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [binaryFiles, setBinaryFiles] = useState<BinaryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef("");

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // Load binary files
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const list = await fetchBinaryList();
        setBinaryFiles(list);
        if (list.length > 0 && !selectedFile) {
          setSelectedFile(list[0].name);
        }
      } catch (err) {
        console.error("Failed to load binary files:", err);
      }
    };
    loadFiles();
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
            <Select
              value={selectedFile || ""}
              onValueChange={setSelectedFile}
            >
              <SelectTrigger className="w-[200px] h-8 text-sm">
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
        <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col">
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
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`
                    flex items-center justify-between p-3 rounded-lg cursor-pointer
                    transition-colors hover:bg-gray-200 dark:hover:bg-gray-800
                    ${currentSessionId === session.id ? "bg-gray-200 dark:bg-gray-800" : ""}
                  `}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{session.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => deleteSession(session.id, e)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

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
                          {msg.content}
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
                          {streamingMessage}
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
                <div className="max-w-3xl mx-auto flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about binary analysis..."
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
    </div>
  );
};

export default Chat;
