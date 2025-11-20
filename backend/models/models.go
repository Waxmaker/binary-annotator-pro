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

// ChatSession represents a chat conversation
type ChatSession struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID string `gorm:"index;not null" json:"user_id"` // UUID from frontend
	Title  string `json:"title"`                         // Auto-generated from first message
	FileID *uint  `json:"file_id,omitempty"`             // Optional: associated binary file

	Messages []ChatMessage `gorm:"foreignKey:SessionID" json:"messages,omitempty"`
}

// ChatMessage represents a single message in a chat
type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	SessionID uint   `gorm:"index;not null" json:"session_id"`
	Role      string `gorm:"not null" json:"role"` // "user", "assistant", "system", "tool"
	Content   string `gorm:"type:text" json:"content"`

	// For tool calls
	ToolCalls string `gorm:"type:text" json:"tool_calls,omitempty"` // JSON encoded
	ToolName  string `json:"tool_name,omitempty"`
}

// CompressionAnalysis represents a compression detection analysis session
type CompressionAnalysis struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	FileID       uint   `gorm:"index;not null" json:"file_id"`
	Status       string `json:"status"` // "pending", "running", "completed", "failed"
	TotalTests   int    `json:"total_tests"`
	SuccessCount int    `json:"success_count"`
	FailedCount  int    `json:"failed_count"`

	// Best candidate
	BestMethod     string  `json:"best_method,omitempty"`
	BestRatio      float64 `json:"best_ratio,omitempty"`
	BestConfidence float64 `json:"best_confidence,omitempty"`

	// Error if failed
	Error string `json:"error,omitempty"`

	// Relations
	Results []CompressionResult `gorm:"foreignKey:AnalysisID" json:"results,omitempty"`
}

// CompressionResult represents a single compression method test result
type CompressionResult struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	AnalysisID         uint    `gorm:"index;not null" json:"analysis_id"`
	Method             string  `gorm:"not null" json:"method"` // "rle", "delta", "huffman", etc.
	Success            bool    `json:"success"`
	CompressionRatio   float64 `json:"compression_ratio"`   // decompressed / original
	Confidence         float64 `json:"confidence"`          // 0.0 to 1.0
	DecompressedSize   int64   `json:"decompressed_size"`
	OriginalSize       int64   `json:"original_size"`
	EntropyOriginal    float64 `json:"entropy_original"`
	EntropyDecompressed float64 `json:"entropy_decompressed"`

	// Validation
	ChecksumValid bool   `json:"checksum_valid"`
	ValidationMsg string `json:"validation_msg,omitempty"`

	// Error if failed
	Error string `json:"error,omitempty"`

	// File reference
	DecompressedFileID *uint `json:"decompressed_file_id,omitempty"`
}

// DecompressedFile stores decompressed variant of a file
type DecompressedFile struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	OriginalFileID uint   `gorm:"index;not null" json:"original_file_id"`
	ResultID       uint   `gorm:"index;not null" json:"result_id"`
	Method         string `json:"method"`
	FileName       string `json:"file_name"` // e.g., "file.DAT.RLE"
	Size           int64  `json:"size"`
	Data           []byte `gorm:"type:blob" json:"-"`
}
