package handlers

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/mcplib"
	"binary-annotator-pro/models"
	"binary-annotator-pro/services"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

// ChatHandler manages chat WebSocket connections
type ChatHandler struct {
	db *config.DB
}

// NewChatHandler creates a new chat handler
func NewChatHandler(db *config.DB) *ChatHandler {
	return &ChatHandler{db: db}
}

// ChatWSMessage represents WebSocket messages for chat
type ChatWSMessage struct {
	Type      string                    `json:"type"` // "message", "history", "new_session", "load_session"
	UserID    string                    `json:"user_id"`
	SessionID *uint                     `json:"session_id,omitempty"`
	Message   string                    `json:"message,omitempty"`
	FileID    *uint                     `json:"file_id,omitempty"`
	Messages  []services.ChatMessageReq `json:"messages,omitempty"`
}

// ChatWSResponse represents WebSocket response
type ChatWSResponse struct {
	Type      string               `json:"type"` // "chunk", "done", "error", "history", "session_created"
	Chunk     string               `json:"chunk,omitempty"`
	Error     string               `json:"error,omitempty"`
	SessionID uint                 `json:"session_id,omitempty"`
	Messages  []models.ChatMessage `json:"messages,omitempty"`
	Sessions  []models.ChatSession `json:"sessions,omitempty"`
}

// HandleChat handles WebSocket connections for chat
func (ch *ChatHandler) HandleChat(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		log.Printf("chat websocket upgrade error: %v", err)
		return err
	}
	defer ws.Close()

	log.Println("Chat WebSocket client connected")

	for {
		var msg ChatWSMessage
		err := ws.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("chat websocket read error: %v", err)
			}
			break
		}

		if msg.UserID == "" {
			ws.WriteJSON(&ChatWSResponse{
				Type:  "error",
				Error: "user_id required",
			})
			continue
		}

		log.Printf("Chat message received: type=%s, user=%s", msg.Type, msg.UserID)

		switch msg.Type {
		case "new_session":
			ch.handleNewSession(ws, msg)
		case "load_session":
			ch.handleLoadSession(ws, msg)
		case "list_sessions":
			ch.handleListSessions(ws, msg)
		case "message":
			ch.handleChatMessage(ws, msg)
		default:
			ws.WriteJSON(&ChatWSResponse{
				Type:  "error",
				Error: "unknown message type",
			})
		}
	}

	log.Println("Chat WebSocket client disconnected")
	return nil
}

// handleNewSession creates a new chat session
func (ch *ChatHandler) handleNewSession(ws *websocket.Conn, msg ChatWSMessage) {
	session := models.ChatSession{
		UserID: msg.UserID,
		Title:  "New Chat",
		FileID: msg.FileID,
	}

	if err := ch.db.GormDB.Create(&session).Error; err != nil {
		log.Printf("Failed to create session: %v", err)
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "failed to create session",
		})
		return
	}

	ws.WriteJSON(&ChatWSResponse{
		Type:      "session_created",
		SessionID: session.ID,
	})
}

// handleLoadSession loads chat history for a session
func (ch *ChatHandler) handleLoadSession(ws *websocket.Conn, msg ChatWSMessage) {
	if msg.SessionID == nil {
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "session_id required",
		})
		return
	}

	var messages []models.ChatMessage
	if err := ch.db.GormDB.Where("session_id = ?", *msg.SessionID).
		Order("created_at asc").
		Find(&messages).Error; err != nil {
		log.Printf("Failed to load messages: %v", err)
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "failed to load messages",
		})
		return
	}

	ws.WriteJSON(&ChatWSResponse{
		Type:     "history",
		Messages: messages,
	})
}

// handleListSessions lists all sessions for a user
func (ch *ChatHandler) handleListSessions(ws *websocket.Conn, msg ChatWSMessage) {
	var sessions []models.ChatSession
	if err := ch.db.GormDB.Where("user_id = ?", msg.UserID).
		Order("updated_at desc").
		Find(&sessions).Error; err != nil {
		log.Printf("Failed to load sessions: %v", err)
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "failed to load sessions",
		})
		return
	}

	ws.WriteJSON(&ChatWSResponse{
		Type:     "sessions",
		Sessions: sessions,
	})
}

// handleChatMessage processes a chat message and streams response
func (ch *ChatHandler) handleChatMessage(ws *websocket.Conn, msg ChatWSMessage) {
	if msg.SessionID == nil {
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "session_id required",
		})
		return
	}

	// Check for MCP commands
	if len(msg.Message) > 0 && msg.Message[0] == '/' {
		ch.handleMCPCommand(ws, msg)
		return
	}

	// Get user's AI settings
	var settings models.AISettings
	if err := ch.db.GormDB.Where("user_id = ?", msg.UserID).First(&settings).Error; err != nil {
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "AI settings not configured",
		})
		return
	}

	if settings.Provider != "ollama" {
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "Only Ollama is supported for chat currently",
		})
		return
	}

	// Save user message
	userMsg := models.ChatMessage{
		SessionID: *msg.SessionID,
		Role:      "user",
		Content:   msg.Message,
	}
	if err := ch.db.GormDB.Create(&userMsg).Error; err != nil {
		log.Printf("Failed to save user message: %v", err)
	}

	// Update session title if this is the first message
	var session models.ChatSession
	if err := ch.db.GormDB.First(&session, *msg.SessionID).Error; err == nil {
		if session.Title == "New Chat" {
			chatService := services.NewChatService(settings.OllamaURL)
			session.Title = chatService.GenerateTitle(msg.Message)
			ch.db.GormDB.Save(&session)
		}
	}

	// Get MCP tools
	mcpService := services.GetMCPService()
	mcpTools, err := mcpService.ListAllTools()
	if err != nil {
		log.Printf("Failed to get MCP tools: %v", err)
	}

	// Convert MCP tools to Ollama format
	var ollamaTools []services.Tool
	if mcpTools != nil && len(mcpTools) > 0 {
		ollamaTools = convertMCPToolsToOllamaFormat(mcpTools)
		log.Printf("Loaded %d MCP tools for chat", len(ollamaTools))
	}

	// Get conversation history
	var messages []models.ChatMessage
	ch.db.GormDB.Where("session_id = ?", *msg.SessionID).
		Order("created_at asc").
		Find(&messages)

	// Convert to chat request format with system prompt
	chatMessages := make([]services.ChatMessageReq, 0, len(messages)+1)

	// Add system prompt with research context (only if it's the first message in conversation)
	if len(messages) <= 1 {
		systemPrompt := `You are an AI assistant specialized in reverse engineering and binary analysis, working within a research institute environment.

**Context:**
- You are assisting researchers at a medical research institute
- The primary focus is reverse engineering proprietary ECG (electrocardiogram) file formats
- These are binary files from various medical device manufacturers with undocumented or partially documented formats
- The goal is to extract and analyze ECG waveform data for research purposes

**Your expertise includes:**
- Binary file format analysis and structure identification
- ECG data format understanding (leads, sampling rates, signal encoding)
- Pattern recognition in hex dumps
- Identifying file headers, metadata sections, and data blocks
- Understanding common encoding schemes (little-endian, big-endian, compressed formats)
- Medical device file format specifications (when available)

**You have access to MCP tools for:**
- Binary file inspection and hex viewing
- Pattern searching (hex, ASCII, various data types)
- YAML-based structure annotation
- File information and entropy analysis
- Structure analysis and pattern detection

**Guidelines:**
- Use the available tools to analyze binary files when asked
- Provide detailed technical explanations based on actual data from tools
- Suggest specific byte offsets and patterns to investigate
- Help interpret binary structures in medical device context
- Be precise with hexadecimal notation and byte calculations
- Consider common ECG file characteristics (lead data, timing, metadata)

When analyzing files:
1. Start by listing available files if needed
2. Get file information to understand size and entropy
3. Read specific byte ranges to examine headers
4. Search for patterns (magic bytes, delimiters, etc.)
5. Analyze structure to identify sections`

		chatMessages = append(chatMessages, services.ChatMessageReq{
			Role:    "system",
			Content: systemPrompt,
		})
	}

	// Add conversation history
	for _, m := range messages {
		chatMessages = append(chatMessages, services.ChatMessageReq{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	// Stream response from Ollama with tool calling support
	chatService := services.NewChatService(settings.OllamaURL)

	// Tool calling loop - may need multiple iterations
	maxIterations := 5
	for iteration := 0; iteration < maxIterations; iteration++ {
		var fullResponse string
		var toolCalls []services.ToolCall

		err := chatService.StreamChatWithTools(services.ChatRequest{
			Model:    settings.OllamaModel,
			Messages: chatMessages,
			Tools:    ollamaTools,
		}, func(resp services.StreamResponse) error {
			// Handle content chunks
			if resp.Content != "" {
				fullResponse += resp.Content
				// Send chunk to client
				ws.WriteJSON(&ChatWSResponse{
					Type:  "chunk",
					Chunk: resp.Content,
				})
			}

			// Collect tool calls
			if len(resp.ToolCalls) > 0 {
				toolCalls = append(toolCalls, resp.ToolCalls...)
			}

			return nil
		})

		if err != nil {
			log.Printf("Chat stream error: %v", err)
			ws.WriteJSON(&ChatWSResponse{
				Type:  "error",
				Error: err.Error(),
			})
			return
		}

		// If no tool calls, we're done
		if len(toolCalls) == 0 {
			// Save assistant response
			assistantMsg := models.ChatMessage{
				SessionID: *msg.SessionID,
				Role:      "assistant",
				Content:   fullResponse,
			}
			if err := ch.db.GormDB.Create(&assistantMsg).Error; err != nil {
				log.Printf("Failed to save assistant message: %v", err)
			}

			// Send done signal
			ws.WriteJSON(&ChatWSResponse{
				Type: "done",
			})
			return
		}

		// Execute tool calls
		log.Printf("Executing %d tool call(s)", len(toolCalls))

		// Add assistant message with tool calls to history
		chatMessages = append(chatMessages, services.ChatMessageReq{
			Role:    "assistant",
			Content: fullResponse,
		})

		// Execute each tool call and add results to messages
		for _, toolCall := range toolCalls {
			toolName := toolCall.Function.Name
			arguments := toolCall.Function.Arguments

			log.Printf("Calling tool: %s with args: %v", toolName, arguments)

			// Send status to client
			ws.WriteJSON(&ChatWSResponse{
				Type:  "chunk",
				Chunk: fmt.Sprintf("\n\n🔧 Calling tool: %s...\n", toolName),
			})

			// Call the MCP tool
			result, err := mcpService.CallTool("binary-annotator", toolName, arguments)
			if err != nil {
				log.Printf("Tool call error: %v", err)
				ws.WriteJSON(&ChatWSResponse{
					Type:  "chunk",
					Chunk: fmt.Sprintf("❌ Tool error: %v\n", err),
				})

				// Add error result to messages
				chatMessages = append(chatMessages, services.ChatMessageReq{
					Role:    "tool",
					Content: fmt.Sprintf("Error calling %s: %v", toolName, err),
				})
				continue
			}

			// Format tool result
			var resultText string
			if len(result.Content) > 0 {
				// Combine all content items
				for _, item := range result.Content {
					if item.Type == "text" {
						resultText += item.Text
					}
				}
			}

			if resultText == "" {
				resultText = "Tool executed successfully but returned no content"
			}

			log.Printf("Tool result: %s", resultText)

			// Don't send result preview to client - let AI interpret it
			// The AI will receive the tool result and formulate a user-friendly response

			// Add tool result to conversation
			chatMessages = append(chatMessages, services.ChatMessageReq{
				Role:    "tool",
				Content: resultText,
			})
		}

		// Continue loop to get AI's response to the tool results
	}

	// If we hit max iterations, send warning
	log.Printf("Max tool calling iterations reached")
	ws.WriteJSON(&ChatWSResponse{
		Type:  "chunk",
		Chunk: "\n\n⚠️ Maximum tool calling iterations reached.\n",
	})
	ws.WriteJSON(&ChatWSResponse{
		Type: "done",
	})
}

// GetChatSessions returns all chat sessions for a user (REST endpoint)
func (ch *ChatHandler) GetChatSessions(c echo.Context) error {
	userID := c.Param("userId")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing user_id"})
	}

	var sessions []models.ChatSession
	if err := ch.db.GormDB.Where("user_id = ?", userID).
		Order("updated_at desc").
		Limit(50).
		Find(&sessions).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to load sessions"})
	}

	return c.JSON(http.StatusOK, sessions)
}

// DeleteChatSession deletes a chat session
func (ch *ChatHandler) DeleteChatSession(c echo.Context) error {
	sessionID := c.Param("sessionId")
	if sessionID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing session_id"})
	}

	// Delete messages first
	ch.db.GormDB.Where("session_id = ?", sessionID).Delete(&models.ChatMessage{})

	// Delete session
	if err := ch.db.GormDB.Delete(&models.ChatSession{}, sessionID).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete session"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "session deleted"})
}

// handleMCPCommand handles MCP-specific commands in chat
func (ch *ChatHandler) handleMCPCommand(ws *websocket.Conn, msg ChatWSMessage) {
	mcpService := services.GetMCPService()

	switch msg.Message {
	case "/mcp-status":
		ch.sendMCPStatus(ws, msg, mcpService)
	case "/mcp-list":
		ch.sendMCPToolsList(ws, msg, mcpService)
	default:
		// Send error as a chunk
		ws.WriteJSON(&ChatWSResponse{
			Type:  "chunk",
			Chunk: "Unknown command. Available commands:\n- /mcp-status - Show MCP connection status\n- /mcp-list - List all available MCP tools\n",
		})
		ws.WriteJSON(&ChatWSResponse{Type: "done"})
	}
}

// sendMCPStatus sends MCP connection status to the chat
func (ch *ChatHandler) sendMCPStatus(ws *websocket.Conn, msg ChatWSMessage, mcpService *services.MCPService) {
	connectedCount := mcpService.GetConnectedCount()
	toolsCount := mcpService.GetToolsCount()
	statuses := mcpService.GetServerStatus()

	response := "📊 **MCP Status**\n\n"
	response += "**Connected Servers:** " + fmt.Sprintf("%d\n", connectedCount)
	response += "**Total Tools:** " + fmt.Sprintf("%d\n\n", toolsCount)

	if len(statuses) > 0 {
		response += "**Server Details:**\n"
		for _, status := range statuses {
			response += fmt.Sprintf("\n• **%s**\n", status.Name)
			if status.Connected {
				response += "  ✅ Connected\n"
			} else {
				response += "  ❌ Disconnected\n"
			}
			if status.Initialized {
				response += fmt.Sprintf("  🔧 Tools: %d\n", status.ToolsCount)
				response += fmt.Sprintf("  📦 Version: %s\n", status.ServerInfo.Version)
			}
		}
	} else {
		response += "No MCP servers configured. Add servers to ~/.mcp.json\n"
	}

	// Save command message
	userMsg := models.ChatMessage{
		SessionID: *msg.SessionID,
		Role:      "user",
		Content:   msg.Message,
	}
	ch.db.GormDB.Create(&userMsg)

	// Send response as chunks
	ws.WriteJSON(&ChatWSResponse{
		Type:  "chunk",
		Chunk: response,
	})

	// Save assistant response
	assistantMsg := models.ChatMessage{
		SessionID: *msg.SessionID,
		Role:      "assistant",
		Content:   response,
	}
	ch.db.GormDB.Create(&assistantMsg)

	ws.WriteJSON(&ChatWSResponse{Type: "done"})
}

// convertMCPToolsToOllamaFormat converts MCP tools to Ollama's tool format
func convertMCPToolsToOllamaFormat(mcpTools []mcplib.ToolInfo) []services.Tool {
	ollamaTools := make([]services.Tool, 0, len(mcpTools))

	for _, mcpTool := range mcpTools {
		// Convert InputSchema to Ollama parameters format
		parameters := map[string]interface{}{
			"type": mcpTool.Tool.InputSchema.Type,
		}

		if mcpTool.Tool.InputSchema.Properties != nil {
			parameters["properties"] = mcpTool.Tool.InputSchema.Properties
		}

		if len(mcpTool.Tool.InputSchema.Required) > 0 {
			parameters["required"] = mcpTool.Tool.InputSchema.Required
		}

		ollamaTool := services.Tool{
			Type: "function",
			Function: services.FunctionDef{
				Name:        mcpTool.Tool.Name,
				Description: mcpTool.Tool.Description,
				Parameters:  parameters,
			},
		}

		ollamaTools = append(ollamaTools, ollamaTool)
	}

	return ollamaTools
}

// sendMCPToolsList sends the list of all MCP tools to the chat
func (ch *ChatHandler) sendMCPToolsList(ws *websocket.Conn, msg ChatWSMessage, mcpService *services.MCPService) {
	tools, err := mcpService.ListAllTools()
	if err != nil {
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "Failed to list MCP tools",
		})
		return
	}

	response := "🛠️ **Available MCP Tools**\n\n"
	response += fmt.Sprintf("Total: %d tools\n\n", len(tools))

	if len(tools) == 0 {
		response += "No tools available. Make sure MCP servers are connected.\n"
	} else {
		currentServer := ""
		for _, toolInfo := range tools {
			if currentServer != toolInfo.ServerName {
				currentServer = toolInfo.ServerName
				response += fmt.Sprintf("\n**Server: %s**\n\n", currentServer)
			}
			response += fmt.Sprintf("• **%s**\n", toolInfo.Tool.Name)
			if toolInfo.Tool.Description != "" {
				response += fmt.Sprintf("  %s\n", toolInfo.Tool.Description)
			}
			response += "\n"
		}
	}

	// Save command message
	userMsg := models.ChatMessage{
		SessionID: *msg.SessionID,
		Role:      "user",
		Content:   msg.Message,
	}
	ch.db.GormDB.Create(&userMsg)

	// Send response as chunks
	ws.WriteJSON(&ChatWSResponse{
		Type:  "chunk",
		Chunk: response,
	})

	// Save assistant response
	assistantMsg := models.ChatMessage{
		SessionID: *msg.SessionID,
		Role:      "assistant",
		Content:   response,
	}
	ch.db.GormDB.Create(&assistantMsg)

	ws.WriteJSON(&ChatWSResponse{Type: "done"})
}
