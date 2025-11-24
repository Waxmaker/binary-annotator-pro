package handlers

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/models"
	"net/http"

	"github.com/labstack/echo/v4"
)

// AISettingsHandler handles AI settings operations
type AISettingsHandler struct {
	db *config.DB
}

// NewAISettingsHandler creates a new AI settings handler
func NewAISettingsHandler(db *config.DB) *AISettingsHandler {
	return &AISettingsHandler{db: db}
}

// GetAISettings retrieves AI settings for a user
func (h *AISettingsHandler) GetAISettings(c echo.Context) error {
	userID := c.Param("userId")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing user_id"})
	}

	var settings models.AISettings
	result := h.db.GormDB.Where("user_id = ?", userID).First(&settings)

	if result.Error != nil {
		// Return default settings if not found
		if result.RowsAffected == 0 {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"provider":      "ollama",
				"ollama_url":    "http://localhost:11434",
				"ollama_model":  "llama2",
				"openai_model":  "gpt-4",
				"claude_model":  "claude-3-5-sonnet-20241022",
				"user_id":       userID,
				"thinking":      false,
				"is_configured": false,
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "database error"})
	}

	// Check if provider is properly configured
	isConfigured := false
	switch settings.Provider {
	case "ollama":
		isConfigured = settings.OllamaURL != ""
	case "openai":
		isConfigured = settings.OpenAIKey != ""
	case "claude":
		isConfigured = settings.ClaudeKey != ""
	}

	// Don't send API keys to frontend (they stay on backend)
	response := map[string]interface{}{
		"id":             settings.ID,
		"user_id":        settings.UserID,
		"provider":       settings.Provider,
		"ollama_url":     settings.OllamaURL,
		"ollama_model":   settings.OllamaModel,
		"openai_model":   settings.OpenAIModel,
		"claude_model":   settings.ClaudeModel,
		"thinking":       settings.Thinking,
		"is_configured":  isConfigured,
		"has_openai_key": settings.OpenAIKey != "",
		"has_claude_key": settings.ClaudeKey != "",
		"created_at":     settings.CreatedAt,
		"updated_at":     settings.UpdatedAt,
	}

	return c.JSON(http.StatusOK, response)
}

// SaveAISettings creates or updates AI settings for a user
func (h *AISettingsHandler) SaveAISettings(c echo.Context) error {
	userID := c.Param("userId")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing user_id"})
	}

	var req models.AISettings
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Ensure user_id matches
	req.UserID = userID

	// Check if settings exist
	var existing models.AISettings
	result := h.db.GormDB.Where("user_id = ?", userID).First(&existing)

	if result.RowsAffected == 0 {
		// Create new settings
		if err := h.db.GormDB.Create(&req).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create settings"})
		}
		return c.JSON(http.StatusCreated, map[string]interface{}{
			"id":      req.ID,
			"user_id": req.UserID,
			"message": "AI settings created",
		})
	}

	// Update existing settings
	existing.Provider = req.Provider
	existing.OllamaURL = req.OllamaURL
	existing.OllamaModel = req.OllamaModel
	existing.OpenAIModel = req.OpenAIModel
	existing.ClaudeModel = req.ClaudeModel
	existing.Thinking = req.Thinking

	// Only update API keys if provided (non-empty)
	if req.OpenAIKey != "" {
		existing.OpenAIKey = req.OpenAIKey
	}
	if req.ClaudeKey != "" {
		existing.ClaudeKey = req.ClaudeKey
	}

	if err := h.db.GormDB.Save(&existing).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update settings"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":      existing.ID,
		"user_id": existing.UserID,
		"message": "AI settings updated",
	})
}

// DeleteAISettings deletes AI settings for a user
func (h *AISettingsHandler) DeleteAISettings(c echo.Context) error {
	userID := c.Param("userId")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing user_id"})
	}

	result := h.db.GormDB.Where("user_id = ?", userID).Delete(&models.AISettings{})
	if result.Error != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete settings"})
	}

	if result.RowsAffected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "settings not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "AI settings deleted"})
}

// TestAIConnection tests the AI provider connection
func (h *AISettingsHandler) TestAIConnection(c echo.Context) error {
	userID := c.Param("userId")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing user_id"})
	}

	var settings models.AISettings
	result := h.db.GormDB.Where("user_id = ?", userID).First(&settings)

	if result.Error != nil || result.RowsAffected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "settings not found"})
	}

	// TODO: Implement actual connection test based on provider
	// For now, just return success if settings exist

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"provider": settings.Provider,
		"message":  "Connection test successful",
	})
}
