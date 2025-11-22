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
	db               *config.DB
	mcpDockerHandler *MCPDockerHandler
	ragService       *services.RAGService
	approvalChannels map[uint]chan bool // Map session ID to approval channel
}

// NewChatHandler creates a new chat handler
func NewChatHandler(db *config.DB) *ChatHandler {
	return &ChatHandler{
		db:               db,
		mcpDockerHandler: NewMCPDockerHandler(),
		ragService:       services.NewRAGService(""),
		approvalChannels: make(map[uint]chan bool),
	}
}

// ToolApprovalRequest represents a tool call awaiting approval
type ToolApprovalRequest struct {
	ToolName  string                 `json:"tool_name"`
	Arguments map[string]interface{} `json:"arguments"`
	Server    string                 `json:"server"`
}

// HexSelection represents hexadecimal byte selection from the hex viewer
type HexSelection struct {
	Offset   int      `json:"offset"`    // Starting offset in bytes
	Size     int      `json:"size"`      // Size of selection in bytes
	Hex      string   `json:"hex"`       // Hexadecimal representation (space-separated)
	ASCII    string   `json:"ascii"`     // ASCII representation (filtered to printable chars)
	RawBytes []int    `json:"raw_bytes"` // Raw byte values as integers
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
	RAGEnabled   bool                      `json:"rag_enabled"`             // Whether RAG context should be used
	HexSelection *HexSelection             `json:"hex_selection,omitempty"` // Hex selection for analysis
}

// ChatWSResponse represents WebSocket response
type ChatWSResponse struct {
	Type         string               `json:"type"` // "chunk", "done", "error", "history", "session_created", "tool_approval_request"
	Chunk        string               `json:"chunk,omitempty"`
	Error        string               `json:"error,omitempty"`
	SessionID    uint                 `json:"session_id,omitempty"`
	Messages     []models.ChatMessage `json:"messages,omitempty"`
	Sessions     []models.ChatSession `json:"sessions,omitempty"`
	ToolApproval *ToolApprovalRequest `json:"tool_approval,omitempty"` // Tool awaiting approval
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
		systemPrompt := `
		1. 🎯 ROLE & OBJECTIVES

You must:

Analyze binary ECG files and help identify:

headers & magic values

data blocks & structures

metadata fields

encoding methods (endianness, quantization, compression)

waveform samples

per-lead structure

sampling rates & gain factors

record timestamps & patient metadata

Help detect patterns, offsets, field boundaries

Provide clear, actionable suggestions allowing engineers to write parsers & conversion tools.

Always explain your reasoning (hex -> meaning -> hypothesis).

Your tone is normal, precise, and technical.

You adapt to medical researchers (non-developers) AND reverse engineers (deep technical).

2. 📚 USE OF RAG CONTEXT

You may receive:

PDFs (device manuals, research papers, ECG format specs)

Technical chats

Notes from doctors

Reverse engineering attempts

Prior discoveries

Use this retrieved knowledge to produce answers that are:

More accurate

More contextual

Better aligned with the ongoing research

More consistent across sessions

If RAG documents contradict each other, mention uncertainty.

Never hallucinate unknown specifications.

3. 🔨 MCP TOOLS RULES (STRICT)

You may call MCP tools ONLY when the user makes an explicit request involving file operations.

Use tools for:

“analyze file X” → get_file_info

“read bytes at offset …” → read_binary_bytes

“search for this pattern…” → search_pattern

“list available files” → list_binary_files

Do NOT use tools for:

greetings

theory questions

brainstorming

reverse engineering based on hex dumps pasted in chat

high-level analysis

clarification questions

Default rule:
If there is no explicit request for file access → never call a tool.

4. 📎 WHEN GIVING TECHNICAL ANALYSIS

For every binary interpretation, follow this structure:

4.1 — Structural Observations

Example:

“Bytes 0x00–0x03 look like a little-endian integer”

“0x41 0x48 0x4D 0x45 spells ‘AHME’”

4.2 — Hypotheses

Explain possible meaning:

potential version field

lead count

sampling rate

compression flags

block length

4.3 — Next steps

Always propose:

offsets to inspect

patterns to search

likely block boundaries

testable hypotheses using tools

5. 🩺 ECG-SPECIFIC KNOWLEDGE (BUILT-IN)

You have expertise in:

ECG lead sets (I, II, III, V1–V6, aVR, aVL, aVF)

Sampling frequencies (commonly 250/500/1000 Hz)

Amplitude scaling (µV per LSB)

Typical encoding (signed integers 16–24 bits)

Common compression:

delta encoding

Huffman

RLE

differential coding

vendor-specific lossless schemes

Medical device ecosystems (Fukuda, GE, Philips, Schiller, etc.)

But you MUST NOT invent specific proprietary formats unless they appear in RAG documents or binary evidence.

6. 🧬 COOPERATIVE RESEARCH MODE

You adapt your explanations to:

Engineers

→ low-level binary
→ struct layouts
→ endian analysis
→ compression guessing
→ offsets

Doctors / Researchers

→ meaning of waveform
→ medical interpretations
→ typical structure of ECG data

If unclear who you talk to, default to technical but accessible.

7. 🧠 COMMUNICATION STYLE

Clear

Neutral

Professional

No hallucinated facts

No “I think” — use technical reasoning

Provide offsets, structure diagrams, hex interpretations

When summarizing file structure:
		Offset  Size  Meaning
0x00    4     Magic "AHME"
0x04    2     Lead count (?)
0x06    2     Sample rate (?)


8. 🚫 WHAT YOU MUST AVOID

Guessing unsupported compression algorithms

Inventing undocumented ECG formats

Creating spec details without evidence

Overusing tools

Roleplaying or emotional language

Giving medical diagnosis

9. 💡 EXAMPLE OF GOOD ANSWER STYLE

User: “Que penses-tu du header FF FF 41 48 4D 45 44 20 ?”

Assistant:
« 41 48 4D 45 44 20 = “AHMED ” en ASCII.
Comme c’est juste après FF FF, cela ressemble à une signature ou un bloc d’identification propre à l’équipement.
Hypothèse : un magic identifier de fabricant.
Next steps : lire les 128 premiers octets du fichier pour confirmer la structure. »

`
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

	// Prepare user message with hex selection and RAG context if enabled
	userMessage := msg.Message

	// Add hex selection context if available
	if msg.HexSelection != nil {
		log.Printf("Hex selection provided: offset=0x%X, size=%d bytes", msg.HexSelection.Offset, msg.HexSelection.Size)

		// Format hex selection context for the AI
		hexContext := fmt.Sprintf(`HEX SELECTION CONTEXT:
Selected bytes at offset 0x%X (size: %d bytes):
Hex: %s
ASCII: %s
Raw bytes: %v

Please analyze this hex selection in the context of the user's question.`,
			msg.HexSelection.Offset,
			msg.HexSelection.Size,
			msg.HexSelection.Hex,
			msg.HexSelection.ASCII,
			msg.HexSelection.RawBytes)

		userMessage = fmt.Sprintf("%s\n\n%s", hexContext, msg.Message)
		log.Printf("Enhanced user message with hex selection context (total length: %d bytes)", len(userMessage))
	}

	if msg.RAGEnabled {
		log.Printf("RAG is enabled, searching for relevant context...")
		ragResp, err := ch.ragService.Search(msg.Message, nil, 5, 0.18)
		if err != nil {
			log.Printf("Warning: RAG search failed: %v", err)
		} else if ragResp != nil && len(ragResp.Results) > 0 {
			log.Printf("Found %d relevant RAG results", len(ragResp.Results))
			ragContext := services.FormatRAGContext(ragResp.Results)
			log.Printf("RAG Context generated (length: %d bytes)", len(ragContext))

			// Combine hex selection + RAG data with user prompt:
			// "Using this data: {data}. {hex_context}. Respond to this prompt: {input}"
			userMessage = fmt.Sprintf("Using this data:\n\n%s\n\nRespond to this prompt: %s", ragContext, userMessage)
			log.Printf("Enhanced user message with RAG context (total length: %d bytes)", len(userMessage))
		} else {
			log.Printf("No relevant RAG results found (query: %s)", msg.Message)
		}
	}

	// Add current user message (with RAG context if enabled)
	chatMessages = append(chatMessages, services.ChatMessageReq{
		Role:    "user",
		Content: userMessage,
	})

	// Stream response from Ollama with tool calling support
	chatService := services.NewChatService(settings.OllamaURL)

	// Tool calling loop - may need multiple iterations
	maxIterations := 5
	for iteration := 0; iteration < maxIterations; iteration++ {
		var fullResponse string
		var toolCalls []services.ToolCall

		log.Printf("Starting Ollama streaming with %d messages...", len(chatMessages))
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
		log.Printf("Ollama streaming completed. fullResponse length: %d, toolCalls: %d", len(fullResponse), len(toolCalls))

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

			// Index conversation in RAG (asynchronously to not block response)
			if msg.RAGEnabled {
				go func() {
					// Create a conversation exchange document for RAG
					conversationText := fmt.Sprintf("User: %s\n\nAssistant: %s", msg.Message, fullResponse)
					title := fmt.Sprintf("Chat - Session %d", *msg.SessionID)
					metadata := map[string]string{
						"user_id":    msg.UserID,
						"session_id": fmt.Sprintf("%d", *msg.SessionID),
					}

					if resp, err := ch.ragService.IndexDocument("chat", title, conversationText, fmt.Sprintf("session_%d", *msg.SessionID), metadata, 256, 50); err != nil {
						log.Printf("Warning: Failed to index conversation in RAG: %v", err)
					} else {
						log.Printf("Successfully indexed conversation in RAG (ID: %d, Chunks: %d)", resp.DocumentID, resp.ChunkCount)
					}
				}()
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
