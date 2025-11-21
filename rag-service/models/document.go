package models

import (
	"time"
)

// DocumentType represents the type of document being indexed
type DocumentType string

const (
	TypeMarkdown    DocumentType = "markdown"
	TypeYAML        DocumentType = "yaml"
	TypeAnalysis    DocumentType = "analysis"
	TypeCompression DocumentType = "compression"
	TypeChat        DocumentType = "chat"
	TypePattern     DocumentType = "pattern"
)

// Document represents a document in the RAG system
type Document struct {
	ID          uint         `gorm:"primaryKey" json:"id"`
	Type        DocumentType `gorm:"index" json:"type"`
	Title       string       `gorm:"index" json:"title"`
	Content     string       `gorm:"type:text" json:"content"`
	Source      string       `json:"source"`               // File path or origin
	Metadata    string       `gorm:"type:text" json:"metadata"` // JSON metadata
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	Chunks      []Chunk      `gorm:"foreignKey:DocumentID" json:"chunks,omitempty"`
}

// Chunk represents a chunk of a document with its embedding
type Chunk struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	DocumentID uint      `gorm:"index;not null" json:"document_id"`
	Content    string    `gorm:"type:text" json:"content"`
	ChunkIndex int       `json:"chunk_index"`
	Embedding  []byte    `gorm:"type:bytea" json:"-"` // Serialized vector (PostgreSQL bytea type)
	CreatedAt  time.Time `json:"created_at"`
}

// SearchResult represents a search result
type SearchResult struct {
	DocumentID   uint         `json:"document_id"`
	ChunkID      uint         `json:"chunk_id"`
	Type         DocumentType `json:"type"`
	Title        string       `json:"title"`
	Content      string       `json:"content"`
	Source       string       `json:"source"`
	Score        float64      `json:"score"`
	Metadata     string       `json:"metadata,omitempty"`
}

// IndexRequest represents a request to index content
type IndexRequest struct {
	Type     DocumentType      `json:"type"`
	Title    string            `json:"title"`
	Content  string            `json:"content"`
	Source   string            `json:"source"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// SearchRequest represents a search query
type SearchRequest struct {
	Query      string         `json:"query"`
	Type       []DocumentType `json:"type,omitempty"`       // Filter by document type
	MaxResults int            `json:"max_results,omitempty"` // Default 10
	MinScore   float64        `json:"min_score,omitempty"`   // Minimum similarity score
}

// SearchResponse contains search results
type SearchResponse struct {
	Query   string         `json:"query"`
	Results []SearchResult `json:"results"`
	Count   int            `json:"count"`
}

// StatsResponse contains statistics about the index
type StatsResponse struct {
	TotalDocuments int                    `json:"total_documents"`
	TotalChunks    int                    `json:"total_chunks"`
	DocumentsByType map[DocumentType]int   `json:"documents_by_type"`
	StorageSize    int64                  `json:"storage_size_bytes"`
}
