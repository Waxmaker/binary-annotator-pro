package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// RAGService handles communication with the RAG service
type RAGService struct {
	baseURL string
	client  *http.Client
}

// RAGSearchRequest represents a search request to the RAG service
type RAGSearchRequest struct {
	Query      string   `json:"query"`
	Type       []string `json:"type,omitempty"`
	MaxResults int      `json:"max_results,omitempty"`
	MinScore   float64  `json:"min_score,omitempty"`
}

// RAGSearchResult represents a single search result
type RAGSearchResult struct {
	DocumentID uint    `json:"document_id"`
	ChunkID    uint    `json:"chunk_id"`
	Type       string  `json:"type"`
	Title      string  `json:"title"`
	Content    string  `json:"content"`
	Source     string  `json:"source"`
	Score      float64 `json:"score"`
	Metadata   string  `json:"metadata,omitempty"`
}

// RAGSearchResponse represents the response from RAG search
type RAGSearchResponse struct {
	Query   string            `json:"query"`
	Results []RAGSearchResult `json:"results"`
	Count   int               `json:"count"`
}

// NewRAGService creates a new RAG service client
func NewRAGService(baseURL string) *RAGService {
	if baseURL == "" {
		baseURL = os.Getenv("RAG_API_URL")
	}
	return &RAGService{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 60 * time.Second, // 60 second timeout for embedding generation
		},
	}
}

// Search performs a semantic search in the RAG service
func (rs *RAGService) Search(query string, docTypes []string, maxResults int, minScore float64) (*RAGSearchResponse, error) {
	if maxResults == 0 {
		maxResults = 5
	}
	if minScore == 0 {
		minScore = 0.3 // Default minimum relevance score
	}

	reqBody := RAGSearchRequest{
		Query:      query,
		Type:       docTypes,
		MaxResults: maxResults,
		MinScore:   minScore,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/search", rs.baseURL)
	resp, err := rs.client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to call RAG API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("RAG API error (status %d): %s", resp.StatusCode, string(body))
	}

	var searchResp RAGSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &searchResp, nil
}

// HealthCheck checks if the RAG service is available
func (rs *RAGService) HealthCheck() error {
	url := fmt.Sprintf("%s/health", rs.baseURL)
	resp, err := rs.client.Get(url)
	if err != nil {
		return fmt.Errorf("RAG service unavailable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("RAG service health check failed: status %d", resp.StatusCode)
	}

	return nil
}

// RAGIndexRequest represents a request to index a document
type RAGIndexRequest struct {
	Type          string            `json:"type"`
	Title         string            `json:"title"`
	Content       string            `json:"content"`
	Source        string            `json:"source"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	ChunkTokens   int               `json:"chunk_tokens,omitempty"`
	OverlapTokens int               `json:"overlap_tokens,omitempty"`
}

// RAGIndexResponse represents the response from indexing a document
type RAGIndexResponse struct {
	DocumentID uint `json:"document_id"`
	ChunkCount int  `json:"chunk_count"`
}

// RAGIndexResponseActual represents the actual response from RAG service
type RAGIndexResponseActual struct {
	ID     uint                     `json:"id"`
	Chunks []map[string]interface{} `json:"chunks"`
}

// IndexDocument indexes a document in the RAG service
func (rs *RAGService) IndexDocument(docType, title, content, source string, metadata map[string]string, chunkTokens, overlapTokens int) (*RAGIndexResponse, error) {
	reqBody := RAGIndexRequest{
		Type:          docType,
		Title:         title,
		Content:       content,
		Source:        source,
		Metadata:      metadata,
		ChunkTokens:   chunkTokens,
		OverlapTokens: overlapTokens,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/index/document", rs.baseURL)
	resp, err := rs.client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to call RAG API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("RAG API error (status %d): %s", resp.StatusCode, string(body))
	}

	var actualResp RAGIndexResponseActual
	if err := json.NewDecoder(resp.Body).Decode(&actualResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Convert to expected format
	indexResp := &RAGIndexResponse{
		DocumentID: actualResp.ID,
		ChunkCount: len(actualResp.Chunks),
	}

	return indexResp, nil
}

// DeleteDocument deletes a document from the RAG service
func (rs *RAGService) DeleteDocument(documentID uint) error {
	url := fmt.Sprintf("%s/document/%d", rs.baseURL, documentID)
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := rs.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call RAG API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("RAG API error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// FormatRAGContext formats the search results into a context string for LLM
// Following Ollama's official RAG pattern
func FormatRAGContext(results []RAGSearchResult) string {
	if len(results) == 0 {
		return ""
	}

	var context bytes.Buffer

	for i, result := range results {
		// Limit content to 500 characters to provide good context
		content := result.Content
		if len(content) > 500 {
			content = content[:500] + "..."
		}
		context.WriteString(fmt.Sprintf("Document %d (from %s):\n%s\n\n", i+1, result.Title, content))
	}

	return context.String()
}
