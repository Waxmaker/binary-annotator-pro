package indexer

import (
	"binary-annotator-pro/rag-service/models"
	"binary-annotator-pro/rag-service/storage"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const (
	DefaultChunkSize    = 512  // Characters per chunk
	DefaultChunkOverlap = 50   // Characters overlap between chunks
	MaxChunkSize        = 2000 // Maximum chunk size
)

// Indexer handles document indexing and chunking
type Indexer struct {
	store     *storage.VectorStore
	chunkSize int
	overlap   int
}

// NewIndexer creates a new indexer
func NewIndexer(store *storage.VectorStore) *Indexer {
	return &Indexer{
		store:     store,
		chunkSize: DefaultChunkSize,
		overlap:   DefaultChunkOverlap,
	}
}

// IndexDocument indexes a document by chunking and generating embeddings
func (idx *Indexer) IndexDocument(req *models.IndexRequest) (*models.Document, error) {
	// Create document
	metadataJSON, _ := json.Marshal(req.Metadata)
	doc := &models.Document{
		Type:      req.Type,
		Title:     req.Title,
		Content:   req.Content,
		Source:    req.Source,
		Metadata:  string(metadataJSON),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Split content into chunks
	chunks := idx.chunkText(req.Content)

	// Generate embeddings for each chunk
	for i, chunkText := range chunks {
		embedding, err := idx.store.GenerateEmbedding(chunkText)
		if err != nil {
			return nil, fmt.Errorf("failed to generate embedding for chunk %d: %w", i, err)
		}

		// Serialize embedding
		embeddingBytes, err := storage.SerializeEmbedding(embedding)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize embedding: %w", err)
		}

		chunk := models.Chunk{
			Content:    chunkText,
			ChunkIndex: i,
			Embedding:  embeddingBytes,
			CreatedAt:  time.Now(),
		}
		doc.Chunks = append(doc.Chunks, chunk)
	}

	// Save document with chunks
	if err := idx.store.SaveDocument(doc); err != nil {
		return nil, fmt.Errorf("failed to save document: %w", err)
	}

	return doc, nil
}

// IndexBatch indexes multiple documents in batch
func (idx *Indexer) IndexBatch(requests []models.IndexRequest) ([]uint, error) {
	var docIDs []uint

	for i, req := range requests {
		doc, err := idx.IndexDocument(&req)
		if err != nil {
			return docIDs, fmt.Errorf("failed to index document %d: %w", i, err)
		}
		docIDs = append(docIDs, doc.ID)
	}

	return docIDs, nil
}

// chunkText splits text into overlapping chunks
func (idx *Indexer) chunkText(text string) []string {
	if len(text) == 0 {
		return []string{}
	}

	// Clean and normalize text
	text = strings.TrimSpace(text)

	// If text is shorter than chunk size, return as single chunk
	if len(text) <= idx.chunkSize {
		return []string{text}
	}

	var chunks []string
	start := 0

	for start < len(text) {
		end := start + idx.chunkSize
		if end > len(text) {
			end = len(text)
		}

		// Try to break at word boundary
		if end < len(text) {
			// Look back for last space
			for i := end; i > start; i-- {
				if text[i] == ' ' || text[i] == '\n' || text[i] == '.' {
					end = i + 1
					break
				}
			}
		}

		chunk := strings.TrimSpace(text[start:end])
		if len(chunk) > 0 {
			chunks = append(chunks, chunk)
		}

		// Move start forward, accounting for overlap
		start = end - idx.overlap
		if start < 0 {
			start = 0
		}
	}

	return chunks
}

// IndexMarkdown indexes markdown documentation
func (idx *Indexer) IndexMarkdown(title, content, source string) (*models.Document, error) {
	return idx.IndexDocument(&models.IndexRequest{
		Type:    models.TypeMarkdown,
		Title:   title,
		Content: content,
		Source:  source,
	})
}

// IndexYAML indexes YAML configuration
func (idx *Indexer) IndexYAML(title, content, source string, metadata map[string]string) (*models.Document, error) {
	return idx.IndexDocument(&models.IndexRequest{
		Type:     models.TypeYAML,
		Title:    title,
		Content:  content,
		Source:   source,
		Metadata: metadata,
	})
}

// IndexAnalysis indexes analysis results
func (idx *Indexer) IndexAnalysis(title, content, source string, metadata map[string]string) (*models.Document, error) {
	return idx.IndexDocument(&models.IndexRequest{
		Type:     models.TypeAnalysis,
		Title:    title,
		Content:  content,
		Source:   source,
		Metadata: metadata,
	})
}
