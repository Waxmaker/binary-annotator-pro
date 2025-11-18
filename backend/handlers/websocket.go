package handlers

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/models"
	"binary-annotator-pro/services"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// WebSocketHandler manages WebSocket connections for AI requests
type WebSocketHandler struct {
	db *config.DB
	mu sync.Mutex
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(db *config.DB) *WebSocketHandler {
	return &WebSocketHandler{
		db: db,
	}
}

// AIWSRequest extends services.AIRequest with user_id
type AIWSRequest struct {
	UserID       string                 `json:"user_id"`
	Prompt       string                 `json:"prompt"`
	FileAnalysis *services.FileAnalysis `json:"file_analysis,omitempty"`
}

// HandleAI handles WebSocket connections for AI requests
func (wsh *WebSocketHandler) HandleAI(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return err
	}
	defer ws.Close()

	log.Println("AI WebSocket client connected")

	for {
		// Read message from client
		var req AIWSRequest
		err := ws.ReadJSON(&req)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket read error: %v", err)
			}
			break
		}

		if req.UserID == "" {
			ws.WriteJSON(&services.AIResponse{
				Success: false,
				Error:   "user_id required",
			})
			continue
		}

		log.Printf("AI request received: user=%s, prompt_len=%d", req.UserID, len(req.Prompt))

		// Get user's AI settings from database
		var settings models.AISettings
		result := wsh.db.GormDB.Where("user_id = ?", req.UserID).First(&settings)

		if result.Error != nil || result.RowsAffected == 0 {
			ws.WriteJSON(&services.AIResponse{
				Success: false,
				Error:   "AI settings not configured. Please configure AI settings first.",
			})
			continue
		}

		// Create AI service with user's settings
		aiService := &services.AIService{
			OllamaURL:   settings.OllamaURL,
			OllamaModel: settings.OllamaModel,
			OpenAIKey:   settings.OpenAIKey,
			OpenAIModel: settings.OpenAIModel,
			ClaudeKey:   settings.ClaudeKey,
			ClaudeModel: settings.ClaudeModel,
		}

		// Convert provider string to AIProvider type
		var provider services.AIProvider
		switch settings.Provider {
		case "ollama":
			provider = services.ProviderOllama
		case "openai":
			provider = services.ProviderOpenAI
		case "claude":
			provider = services.ProviderClaude
		default:
			ws.WriteJSON(&services.AIResponse{
				Success: false,
				Error:   "unknown provider: " + settings.Provider,
			})
			continue
		}

		// Generate AI response
		var response *services.AIResponse

		// Check if this is a YAML generation request
		if req.FileAnalysis != nil {
			response, err = aiService.GenerateYAMLTags(provider, req.FileAnalysis)
		} else {
			response, err = aiService.Generate(services.AIRequest{
				Provider: provider,
				Prompt:   req.Prompt,
			})
		}

		if err != nil {
			log.Printf("AI generation error: %v", err)
			response = &services.AIResponse{
				Success: false,
				Error:   err.Error(),
			}
		}

		// Send response back to client
		err = ws.WriteJSON(response)
		if err != nil {
			log.Printf("websocket write error: %v", err)
			break
		}

		log.Printf("AI response sent: success=%v, data_len=%d", response.Success, len(response.Data))
	}

	log.Println("AI WebSocket client disconnected")
	return nil
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}
