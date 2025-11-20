package handlers

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/models"
	"binary-annotator-pro/services"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

// ChatHandler manages chat WebSocket connections
type ChatHandler struct {
	db                *config.DB
	mcpDockerHandler  *MCPDockerHandler
	approvalChannels  map[uint]chan bool // Map session ID to approval channel
}

// NewChatHandler creates a new chat handler
func NewChatHandler(db *config.DB) *ChatHandler {
	return &ChatHandler{
		db:                db,
		mcpDockerHandler:  NewMCPDockerHandler(),
		approvalChannels:  make(map[uint]chan bool),
	}
}

// ToolApprovalRequest represents a tool call awaiting approval
type ToolApprovalRequest struct {
	ToolName  string                 `json:"tool_name"`
	Arguments map[string]interface{} `json:"arguments"`
	Server    string                 `json:"server"`
}

// ChatWSMessage represents WebSocket messages for chat
type ChatWSMessage struct {
	Type         string                    `json:"type"` // "message", "history", "new_session", "load_session", "tool_approval"
	UserID       string                    `json:"user_id"`
	SessionID    *uint                     `json:"session_id,omitempty"`
	Message      string                    `json:"message,omitempty"`
	FileID       *uint                     `json:"file_id,omitempty"`
	Messages     []services.ChatMessageReq `json:"messages,omitempty"`
	ToolApproved *bool                     `json:"tool_approved,omitempty"` // For tool approval responses
}

// ChatWSResponse represents WebSocket response
type ChatWSResponse struct {
	Type            string                 `json:"type"` // "chunk", "done", "error", "history", "session_created", "tool_approval_request"
	Chunk           string                 `json:"chunk,omitempty"`
	Error           string                 `json:"error,omitempty"`
	SessionID       uint                   `json:"session_id,omitempty"`
	Messages        []models.ChatMessage   `json:"messages,omitempty"`
	Sessions        []models.ChatSession   `json:"sessions,omitempty"`
	ToolApproval    *ToolApprovalRequest   `json:"tool_approval,omitempty"`    // Tool awaiting approval
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
			// Run in goroutine to not block WebSocket read loop (needed for tool approval)
			go ch.handleChatMessage(ws, msg)
		case "tool_approval":
			ch.handleToolApproval(ws, msg)
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

// handleToolApproval handles tool approval responses from the user
func (ch *ChatHandler) handleToolApproval(ws *websocket.Conn, msg ChatWSMessage) {
	if msg.SessionID == nil {
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "session_id required",
		})
		return
	}

	if msg.ToolApproved == nil {
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: "tool_approved field required",
		})
		return
	}

	// Find the approval channel for this session
	approvalChan, exists := ch.approvalChannels[*msg.SessionID]
	if !exists {
		log.Printf("No pending tool approval for session %d", *msg.SessionID)
		return
	}

	// Send the approval decision to the waiting goroutine
	approvalChan <- *msg.ToolApproved
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

	// Get MCP tools from Docker Manager
	ollamaTools, toolToServer, err := ch.getMCPToolsFromDocker()
	if err != nil {
		log.Printf("Warning: failed to get MCP tools: %v", err)
		ollamaTools = []services.Tool{} // Continue without tools
	}
	log.Printf("Loaded %d MCP tools from Docker Manager", len(ollamaTools))

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

			// Find which server hosts this tool
			serverName, found := toolToServer[toolName]
			if !found {
				log.Printf("Tool %s not found in any server", toolName)
				ws.WriteJSON(&ChatWSResponse{
					Type:  "chunk",
					Chunk: fmt.Sprintf("❌ Tool %s not found\n", toolName),
				})
				chatMessages = append(chatMessages, services.ChatMessageReq{
					Role:    "tool",
					Content: fmt.Sprintf("Error: tool %s not found", toolName),
				})
				continue
			}

			// Request user approval for tool execution
			approvalChan := make(chan bool, 1)
			ch.approvalChannels[*msg.SessionID] = approvalChan

			// Send approval request to frontend
			ws.WriteJSON(&ChatWSResponse{
				Type: "tool_approval_request",
				ToolApproval: &ToolApprovalRequest{
					ToolName:  toolName,
					Arguments: arguments,
					Server:    serverName,
				},
			})

			log.Printf("Waiting for user approval for tool: %s", toolName)

			// Wait for approval with 60 second timeout
			var approved bool
			select {
			case approved = <-approvalChan:
				log.Printf("Tool %s %s by user", toolName, map[bool]string{true: "approved", false: "denied"}[approved])
			case <-time.After(60 * time.Second):
				log.Printf("Tool approval timeout for %s", toolName)
				approved = false
			}

			// Clean up approval channel
			delete(ch.approvalChannels, *msg.SessionID)

			// If not approved, skip execution
			if !approved {
				ws.WriteJSON(&ChatWSResponse{
					Type:  "chunk",
					Chunk: fmt.Sprintf("⚠️ Tool %s execution was denied\n", toolName),
				})
				chatMessages = append(chatMessages, services.ChatMessageReq{
					Role:    "tool",
					Content: fmt.Sprintf("User denied execution of %s", toolName),
				})
				continue
			}

			// Call the MCP tool via Docker Manager
			result, err := ch.mcpDockerHandler.proxyRequest("POST", "/servers/"+serverName+"/call", map[string]interface{}{
				"tool":      toolName,
				"arguments": arguments,
			})

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
			resultBytes, _ := json.Marshal(result)
			resultText := string(resultBytes)

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
	ws.WriteJSON(&ChatWSResponse{
		Type:  "chunk",
		Chunk: "MCP commands disabled - using Docker MCP manager instead\n",
	})
	ws.WriteJSON(&ChatWSResponse{Type: "done"})
}

// sendMCPStatus sends MCP connection status to the chat
func (ch *ChatHandler) sendMCPStatus(ws *websocket.Conn, msg ChatWSMessage, mcpService interface{}) {
	// Disabled
}


// sendMCPToolsList sends the list of all MCP tools to the chat
func (ch *ChatHandler) sendMCPToolsList(ws *websocket.Conn, msg ChatWSMessage, mcpService interface{}) {
	// Disabled
}

// getMCPToolsFromDocker retrieves all MCP tools from Docker Manager and converts to Ollama format
func (ch *ChatHandler) getMCPToolsFromDocker() ([]services.Tool, map[string]string, error) {
	// Get list of running MCP servers from Docker Manager
	// Note: /servers endpoint returns an array, not an object
	req, err := http.NewRequest("GET", ch.mcpDockerHandler.managerURL+"/servers", nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch servers: %w", err)
	}
	defer resp.Body.Close()

	var servers []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&servers); err != nil {
		return nil, nil, fmt.Errorf("failed to decode servers: %w", err)
	}

	// Convert MCP tools to Ollama format
	var ollamaTools []services.Tool
	toolToServer := make(map[string]string) // Maps tool name to server name

	for _, server := range servers {
		serverName, _ := server["name"].(string)
		tools, ok := server["tools"].([]interface{})
		if !ok || len(tools) == 0 {
			continue
		}

		for _, toolData := range tools {
			toolMap, ok := toolData.(map[string]interface{})
			if !ok {
				continue
			}

			name, _ := toolMap["name"].(string)
			description, _ := toolMap["description"].(string)
			inputSchema, _ := toolMap["inputSchema"].(map[string]interface{})

			// Convert MCP InputSchema to Ollama Parameters format
			parameters := make(map[string]interface{})
			if inputSchema != nil {
				parameters["type"] = inputSchema["type"]
				if props, ok := inputSchema["properties"].(map[string]interface{}); ok {
					parameters["properties"] = props
				}
				if required, ok := inputSchema["required"].([]interface{}); ok {
					parameters["required"] = required
				}
			}

			ollamaTool := services.Tool{
				Type: "function",
				Function: services.FunctionDef{
					Name:        name,
					Description: description,
					Parameters:  parameters,
				},
			}

			ollamaTools = append(ollamaTools, ollamaTool)
			toolToServer[name] = serverName
		}
	}

	return ollamaTools, toolToServer, nil
}
