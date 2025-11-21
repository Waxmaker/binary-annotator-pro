package api

import (
	"binary-annotator-pro/rag-service/indexer"
	"binary-annotator-pro/rag-service/models"
	"binary-annotator-pro/rag-service/storage"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

// Handler handles API requests
type Handler struct {
	indexer *indexer.Indexer
	store   *storage.VectorStore
}

// NewHandler creates a new API handler
func NewHandler(idx *indexer.Indexer, store *storage.VectorStore) *Handler {
	return &Handler{
		indexer: idx,
		store:   store,
	}
}

// Health checks the health of the service
func (h *Handler) Health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"status": "healthy",
		"service": "rag-service",
	})
}

// IndexDocument indexes a single document
func (h *Handler) IndexDocument(c echo.Context) error {
	var req models.IndexRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Content == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Content is required",
		})
	}

	doc, err := h.indexer.IndexDocument(&req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, doc)
}

// IndexYAML indexes a YAML configuration
func (h *Handler) IndexYAML(c echo.Context) error {
	var req struct {
		Title    string            `json:"title"`
		Content  string            `json:"content"`
		Source   string            `json:"source"`
		Metadata map[string]string `json:"metadata"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	doc, err := h.indexer.IndexYAML(req.Title, req.Content, req.Source, req.Metadata)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, doc)
}

// IndexAnalysis indexes analysis results
func (h *Handler) IndexAnalysis(c echo.Context) error {
	var req struct {
		Title    string            `json:"title"`
		Content  string            `json:"content"`
		Source   string            `json:"source"`
		Metadata map[string]string `json:"metadata"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	doc, err := h.indexer.IndexAnalysis(req.Title, req.Content, req.Source, req.Metadata)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, doc)
}

// IndexBatch indexes multiple documents
func (h *Handler) IndexBatch(c echo.Context) error {
	var req struct {
		Documents []models.IndexRequest `json:"documents"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	docIDs, err := h.indexer.IndexBatch(req.Documents)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"indexed_count": len(docIDs),
		"document_ids":  docIDs,
	})
}

// Search performs semantic search
func (h *Handler) Search(c echo.Context) error {
	var req models.SearchRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Query is required",
		})
	}

	if req.MaxResults == 0 {
		req.MaxResults = 10
	}

	results, err := h.store.Search(req.Query, req.Type, req.MaxResults, req.MinScore)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.SearchResponse{
		Query:   req.Query,
		Results: results,
		Count:   len(results),
	})
}

// ListDocuments lists all documents
func (h *Handler) ListDocuments(c echo.Context) error {
	// Parse query parameters
	var docType *models.DocumentType
	if typeParam := c.QueryParam("type"); typeParam != "" {
		dt := models.DocumentType(typeParam)
		docType = &dt
	}

	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))

	docs, err := h.store.ListDocuments(docType, limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"documents": docs,
		"count":     len(docs),
	})
}

// GetDocument retrieves a document by ID
func (h *Handler) GetDocument(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid document ID",
		})
	}

	doc, err := h.store.GetDocument(uint(id))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Document not found",
		})
	}

	return c.JSON(http.StatusOK, doc)
}

// DeleteDocument deletes a document
func (h *Handler) DeleteDocument(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid document ID",
		})
	}

	if err := h.store.DeleteDocument(uint(id)); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Document deleted successfully",
	})
}

// ClearIndex clears all documents from the index
func (h *Handler) ClearIndex(c echo.Context) error {
	if err := h.store.ClearAll(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Index cleared successfully",
	})
}

// GetStats returns statistics about the index
func (h *Handler) GetStats(c echo.Context) error {
	stats, err := h.store.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, stats)
}

// GetConfig returns current Ollama configuration
func (h *Handler) GetConfig(c echo.Context) error {
	config := h.store.GetConfig()
	return c.JSON(http.StatusOK, config)
}

// UpdateConfig updates Ollama configuration
func (h *Handler) UpdateConfig(c echo.Context) error {
	var req struct {
		OllamaBaseURL   string `json:"ollama_base_url"`
		OllamaEmbedModel string `json:"ollama_embed_model"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if err := h.store.UpdateConfig(req.OllamaBaseURL, req.OllamaEmbedModel); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Configuration updated successfully",
	})
}
