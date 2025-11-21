package storage

import (
	"binary-annotator-pro/rag-service/models"
	"bytes"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"sort"
	"sync"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// VectorStore manages document storage and vector similarity search using Ollama embeddings
type VectorStore struct {
	db         *gorm.DB
	ollamaURL  string
	modelName  string
	httpClient *http.Client
	mu         sync.RWMutex // Protects ollamaURL and modelName
}

// OllamaEmbedRequest represents the request to Ollama embeddings API
type OllamaEmbedRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

// OllamaEmbedResponse represents the response from Ollama embeddings API
type OllamaEmbedResponse struct {
	Embedding []float64 `json:"embedding"`
}

// Config represents Ollama configuration stored in database
type Config struct {
	Key       string `gorm:"primaryKey"`
	Value     string
	UpdatedAt int64
}

// NewVectorStore creates a new vector store with Ollama integration using PostgreSQL
func NewVectorStore(dsn string) (*VectorStore, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Auto migrate the schema
	if err := db.AutoMigrate(&models.Document{}, &models.Chunk{}, &Config{}); err != nil {
		return nil, fmt.Errorf("failed to migrate schema: %w", err)
	}

	vs := &VectorStore{
		db:         db,
		httpClient: &http.Client{},
	}

	// Load configuration from database, fallback to environment variables
	if err := vs.loadConfig(); err != nil {
		return nil, fmt.Errorf("failed to load configuration: %w", err)
	}

	return vs, nil
}

// loadConfig loads Ollama configuration from database or environment
func (vs *VectorStore) loadConfig() error {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	// Try to load from database first
	var ollamaURLConfig, modelNameConfig Config

	if err := vs.db.Where("key = ?", "ollama_base_url").First(&ollamaURLConfig).Error; err == nil {
		vs.ollamaURL = ollamaURLConfig.Value
	} else {
		// Fallback to environment
		vs.ollamaURL = os.Getenv("OLLAMA_BASE_URL")
		if vs.ollamaURL == "" {
			vs.ollamaURL = "http://host.docker.internal:11434"
		}
	}

	if err := vs.db.Where("key = ?", "ollama_embed_model").First(&modelNameConfig).Error; err == nil {
		vs.modelName = modelNameConfig.Value
	} else {
		// Fallback to environment
		vs.modelName = os.Getenv("OLLAMA_EMBED_MODEL")
		if vs.modelName == "" {
			vs.modelName = "nomic-embed-text"
		}
	}

	return nil
}

// Close closes the database connection
func (vs *VectorStore) Close() error {
	sqlDB, err := vs.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// GenerateEmbedding generates an embedding for the given text using Ollama
func (vs *VectorStore) GenerateEmbedding(text string) ([]float64, error) {
	vs.mu.RLock()
	ollamaURL := vs.ollamaURL
	modelName := vs.modelName
	vs.mu.RUnlock()

	reqBody := OllamaEmbedRequest{
		Model:  modelName,
		Prompt: text,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/embeddings", ollamaURL)
	resp, err := vs.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to call Ollama API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ollama API error (status %d): %s", resp.StatusCode, string(body))
	}

	var embedResp OllamaEmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&embedResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return embedResp.Embedding, nil
}

// GetConfig returns current Ollama configuration
func (vs *VectorStore) GetConfig() map[string]string {
	vs.mu.RLock()
	defer vs.mu.RUnlock()

	return map[string]string{
		"ollama_base_url":   vs.ollamaURL,
		"ollama_embed_model": vs.modelName,
	}
}

// UpdateConfig updates Ollama configuration and persists to database
func (vs *VectorStore) UpdateConfig(ollamaURL, modelName string) error {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	// Update in-memory configuration
	if ollamaURL != "" {
		vs.ollamaURL = ollamaURL
		// Persist to database using GORM's Save method (upsert)
		config := Config{
			Key:   "ollama_base_url",
			Value: ollamaURL,
		}
		if err := vs.db.Save(&config).Error; err != nil {
			return fmt.Errorf("failed to save ollama_base_url: %w", err)
		}
	}

	if modelName != "" {
		vs.modelName = modelName
		// Persist to database using GORM's Save method (upsert)
		config := Config{
			Key:   "ollama_embed_model",
			Value: modelName,
		}
		if err := vs.db.Save(&config).Error; err != nil {
			return fmt.Errorf("failed to save ollama_embed_model: %w", err)
		}
	}

	return nil
}

// SaveDocument saves a document and its chunks with embeddings
func (vs *VectorStore) SaveDocument(doc *models.Document) error {
	return vs.db.Create(doc).Error
}

// GetDocument retrieves a document by ID
func (vs *VectorStore) GetDocument(id uint) (*models.Document, error) {
	var doc models.Document
	err := vs.db.Preload("Chunks").First(&doc, id).Error
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

// ListDocuments lists all documents with optional type filter
func (vs *VectorStore) ListDocuments(docType *models.DocumentType, limit, offset int) ([]models.Document, error) {
	var docs []models.Document
	query := vs.db.Order("created_at DESC")

	if docType != nil {
		query = query.Where("type = ?", *docType)
	}

	if limit > 0 {
		query = query.Limit(limit)
	}

	if offset > 0 {
		query = query.Offset(offset)
	}

	err := query.Find(&docs).Error
	return docs, err
}

// DeleteDocument deletes a document and its chunks
func (vs *VectorStore) DeleteDocument(id uint) error {
	return vs.db.Transaction(func(tx *gorm.DB) error {
		// Delete chunks first
		if err := tx.Where("document_id = ?", id).Delete(&models.Chunk{}).Error; err != nil {
			return err
		}
		// Delete document
		return tx.Delete(&models.Document{}, id).Error
	})
}

// ClearAll deletes all documents and chunks
func (vs *VectorStore) ClearAll() error {
	return vs.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM chunks").Error; err != nil {
			return err
		}
		return tx.Exec("DELETE FROM documents").Error
	})
}

// Search performs vector similarity search
func (vs *VectorStore) Search(query string, docTypes []models.DocumentType, maxResults int, minScore float64) ([]models.SearchResult, error) {
	// Generate embedding for query using Ollama
	queryEmbedding, err := vs.GenerateEmbedding(query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	if maxResults <= 0 {
		maxResults = 10
	}

	// Get all chunks with documents (filtered by type if specified)
	var results []struct {
		models.Chunk
		Type     models.DocumentType
		Title    string
		Source   string
		Metadata string
	}

	dbQuery := vs.db.Table("chunks").
		Select("chunks.*, documents.type, documents.title, documents.source, documents.metadata").
		Joins("INNER JOIN documents ON documents.id = chunks.document_id")

	if len(docTypes) > 0 {
		dbQuery = dbQuery.Where("documents.type IN ?", docTypes)
	}

	if err := dbQuery.Find(&results).Error; err != nil {
		return nil, err
	}

	// Calculate similarity scores
	type scoredResult struct {
		result models.SearchResult
		score  float64
	}

	var scoredResults []scoredResult

	for _, r := range results {
		// Deserialize embedding
		embedding, err := DeserializeEmbedding(r.Embedding)
		if err != nil {
			continue
		}

		// Calculate cosine similarity
		score := cosineSimilarity(queryEmbedding, embedding)

		if score >= minScore {
			scoredResults = append(scoredResults, scoredResult{
				result: models.SearchResult{
					DocumentID: r.DocumentID,
					ChunkID:    r.ID,
					Type:       r.Type,
					Title:      r.Title,
					Content:    r.Content,
					Source:     r.Source,
					Score:      score,
					Metadata:   r.Metadata,
				},
				score: score,
			})
		}
	}

	// Sort by score descending
	sort.Slice(scoredResults, func(i, j int) bool {
		return scoredResults[i].score > scoredResults[j].score
	})

	// Limit results
	if len(scoredResults) > maxResults {
		scoredResults = scoredResults[:maxResults]
	}

	// Extract results
	searchResults := make([]models.SearchResult, len(scoredResults))
	for i, sr := range scoredResults {
		searchResults[i] = sr.result
	}

	return searchResults, nil
}

// GetStats returns statistics about the vector store
func (vs *VectorStore) GetStats() (*models.StatsResponse, error) {
	var totalDocs, totalChunks int64
	var storageSize int64

	if err := vs.db.Model(&models.Document{}).Count(&totalDocs).Error; err != nil {
		return nil, err
	}

	if err := vs.db.Model(&models.Chunk{}).Count(&totalChunks).Error; err != nil {
		return nil, err
	}

	// Get documents by type
	docsByType := make(map[models.DocumentType]int)
	var typeCounts []struct {
		Type  models.DocumentType
		Count int
	}

	vs.db.Model(&models.Document{}).
		Select("type, COUNT(*) as count").
		Group("type").
		Scan(&typeCounts)

	for _, tc := range typeCounts {
		docsByType[tc.Type] = tc.Count
	}

	// Estimate storage size (sum of chunk embedding sizes)
	var chunks []models.Chunk
	vs.db.Select("length(embedding) as size").Find(&chunks)
	for _, c := range chunks {
		storageSize += int64(len(c.Embedding))
	}

	return &models.StatsResponse{
		TotalDocuments:  int(totalDocs),
		TotalChunks:     int(totalChunks),
		DocumentsByType: docsByType,
		StorageSize:     storageSize,
	}, nil
}

// SerializeEmbedding converts a float64 slice to bytes
func SerializeEmbedding(embedding []float64) ([]byte, error) {
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	if err := enc.Encode(embedding); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// DeserializeEmbedding converts bytes back to float64 slice
func DeserializeEmbedding(data []byte) ([]float64, error) {
	var embedding []float64
	buf := bytes.NewBuffer(data)
	dec := gob.NewDecoder(buf)
	if err := dec.Decode(&embedding); err != nil {
		return nil, err
	}
	return embedding, nil
}

// cosineSimilarity calculates the cosine similarity between two vectors
func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}
