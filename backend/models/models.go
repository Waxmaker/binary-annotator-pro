package models

import (
	"time"

	"gorm.io/gorm"
)

// File represents an uploaded binary file stored as a BLOB
type File struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name   string `gorm:"uniqueIndex;not null" json:"name"`
	Vendor string `json:"vendor"`
	Size   int64  `json:"size"`
	Data   []byte `gorm:"type:blob" json:"-"`
}

// YamlConfig stores YAML configs, optionally linked to a file
type YamlConfig struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Name   string `json:"name"`    // name of the config
	FileID *uint  `json:"file_id"` // optional
	Yaml   string `gorm:"type:text" json:"yaml"`
}

// Tag as per previous schema
type Tag struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	FileID  uint   `json:"file_id"`
	Name    string `json:"name"`
	Offset  int64  `json:"offset"`
	Size    int64  `json:"size"`
	Color   string `json:"color"`
	Type    string `json:"type"` // manual, yaml, detected
	Comment string `json:"comment"`
}

// SearchResult for pattern matches
type SearchResult struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	FileID   uint   `json:"file_id"`
	RuleName string `json:"rule_name"`
	Offset   int64  `json:"offset"`
	Length   int64  `json:"length"`
	Color    string `json:"color"`
}

// Note for annotations
type Note struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	FileID uint   `json:"file_id"`
	Offset int64  `json:"offset"`
	Note   string `json:"note"`
}

// ExtractedBlock stores extracted binary pieces (e.g., lead samples)
type ExtractedBlock struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	FileID    uint   `json:"file_id"`
	BlockName string `json:"block_name"`
	Offset    int64  `json:"offset"`
	Size      int64  `json:"size"`
	Data      []byte `gorm:"type:blob" json:"-"`
}

// AISettings stores AI provider configuration per user
type AISettings struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID string `gorm:"uniqueIndex;not null" json:"user_id"` // UUID from frontend localStorage

	// Active provider
	Provider string `json:"provider"` // "ollama", "openai", "claude"

	// Ollama settings
	OllamaURL   string `json:"ollama_url"`
	OllamaModel string `json:"ollama_model"`

	// OpenAI settings (encrypted in production)
	OpenAIKey   string `json:"openai_key,omitempty"`
	OpenAIModel string `json:"openai_model"`

	// Claude settings (encrypted in production)
	ClaudeKey   string `json:"claude_key,omitempty"`
	ClaudeModel string `json:"claude_model"`
}
