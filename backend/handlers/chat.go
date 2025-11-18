package handlers

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/models"
	"binary-annotator-pro/services"
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

	// Get conversation history
	var messages []models.ChatMessage
	ch.db.GormDB.Where("session_id = ?", *msg.SessionID).
		Order("created_at asc").
		Find(&messages)

	// Convert to chat request format
	chatMessages := make([]services.ChatMessageReq, 0, len(messages))
	for _, m := range messages {
		chatMessages = append(chatMessages, services.ChatMessageReq{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	// Stream response from Ollama
	chatService := services.NewChatService(settings.OllamaURL)

	var fullResponse string
	err := chatService.StreamChat(services.ChatRequest{
		Model:    settings.OllamaModel,
		Messages: chatMessages,
	}, func(chunk string) error {
		fullResponse += chunk
		// Send chunk to client
		return ws.WriteJSON(&ChatWSResponse{
			Type:  "chunk",
			Chunk: chunk,
		})
	})

	if err != nil {
		log.Printf("Chat stream error: %v", err)
		ws.WriteJSON(&ChatWSResponse{
			Type:  "error",
			Error: err.Error(),
		})
		return
	}

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
