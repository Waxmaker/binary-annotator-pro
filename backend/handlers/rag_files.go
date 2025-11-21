package handlers

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"binary-annotator-pro/config"
	"binary-annotator-pro/models"
	"binary-annotator-pro/services"

	"github.com/labstack/echo/v4"
	"github.com/ledongthuc/pdf"
)

// RAGFilesHandler handles RAG document management
type RAGFilesHandler struct {
	db         *config.DB
	ragService *services.RAGService
}

// NewRAGFilesHandler creates a new RAG files handler
func NewRAGFilesHandler(db *config.DB) *RAGFilesHandler {
	return &RAGFilesHandler{
		db:         db,
		ragService: services.NewRAGService("http://localhost:3003"),
	}
}

// UploadDocument handles file upload and indexing in RAG
func (h *RAGFilesHandler) UploadDocument(c echo.Context) error {
	userID := c.QueryParam("user_id")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	// Parse chunk configuration parameters
	chunkTokens := 256 // Default
	overlapTokens := 50 // Default
	if ct := c.QueryParam("chunk_tokens"); ct != "" {
		if parsed, err := strconv.Atoi(ct); err == nil && parsed > 0 {
			chunkTokens = parsed
		}
	}
	if ot := c.QueryParam("overlap_tokens"); ot != "" {
		if parsed, err := strconv.Atoi(ot); err == nil && parsed >= 0 {
			overlapTokens = parsed
		}
	}

	// Get uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file is required"})
	}

	// Validate file size (max 10MB)
	if file.Size > 10*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file too large (max 10MB)"})
	}

	// Validate file type
	fileType := strings.ToLower(filepath.Ext(file.Filename))
	if !isValidFileType(fileType) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "unsupported file type. Supported: .txt, .md, .pdf"})
	}

	// Open file
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open file"})
	}
	defer src.Close()

	// Parse file content
	content, err := parseFile(src, fileType)
	if err != nil {
		log.Printf("Failed to parse file %s: %v", file.Filename, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to parse file: %v", err)})
	}

	// Limit content size to avoid overwhelming RAG service (max 30KB of text)
	// This prevents RAG service crashes when generating embeddings for many chunks
	// With 512 token chunks, 30KB ≈ 60 chunks, taking ~30-60 seconds to process
	maxContentSize := 30 * 1024
	if len(content) > maxContentSize {
		log.Printf("Warning: Content size %d bytes, truncating to %d bytes", len(content), maxContentSize)
		content = content[:maxContentSize] + "\n\n[Content truncated due to size limit]"
	}

	// Index in RAG service
	ragResp, err := h.ragService.IndexDocument(
		"document",
		file.Filename,
		content,
		fmt.Sprintf("user:%s", userID),
		map[string]string{
			"user_id":   userID,
			"file_type": fileType,
		},
		chunkTokens,
		overlapTokens,
	)
	if err != nil {
		log.Printf("Failed to index document in RAG: %v", err)

		// Save error in database
		doc := models.RAGDocument{
			UserID:   userID,
			FileName: file.Filename,
			FileType: fileType,
			FileSize: file.Size,
			Status:   "error",
			ErrorMsg: err.Error(),
		}
		h.db.GormDB.Create(&doc)

		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to index document"})
	}

	// Save metadata in database
	doc := models.RAGDocument{
		UserID:     userID,
		FileName:   file.Filename,
		FileType:   fileType,
		FileSize:   file.Size,
		RAGDocID:   ragResp.DocumentID,
		ChunkCount: ragResp.ChunkCount,
		Status:     "indexed",
	}
	if err := h.db.GormDB.Create(&doc).Error; err != nil {
		log.Printf("Failed to save document metadata: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save metadata"})
	}

	log.Printf("Successfully indexed document: %s (ID: %d, Chunks: %d)", file.Filename, ragResp.DocumentID, ragResp.ChunkCount)

	return c.JSON(http.StatusOK, doc)
}

// ListDocuments returns all documents for a user
func (h *RAGFilesHandler) ListDocuments(c echo.Context) error {
	userID := c.QueryParam("user_id")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	var documents []models.RAGDocument
	if err := h.db.GormDB.Where("user_id = ?", userID).Order("created_at desc").Find(&documents).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch documents"})
	}

	return c.JSON(http.StatusOK, documents)
}

// DeleteDocument deletes a document from RAG and database
func (h *RAGFilesHandler) DeleteDocument(c echo.Context) error {
	id := c.Param("id")
	userID := c.QueryParam("user_id")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	// Get document
	var doc models.RAGDocument
	if err := h.db.GormDB.Where("id = ? AND user_id = ?", id, userID).First(&doc).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "document not found"})
	}

	// Delete from RAG service
	if doc.Status == "indexed" && doc.RAGDocID > 0 {
		if err := h.ragService.DeleteDocument(doc.RAGDocID); err != nil {
			log.Printf("Warning: Failed to delete document from RAG: %v", err)
			// Continue anyway to delete from database
		}
	}

	// Delete from database
	if err := h.db.GormDB.Delete(&doc).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete document"})
	}

	log.Printf("Deleted document: %s (ID: %d)", doc.FileName, doc.ID)

	return c.JSON(http.StatusOK, map[string]string{"message": "document deleted"})
}

// GetDocumentStats returns statistics about documents
func (h *RAGFilesHandler) GetDocumentStats(c echo.Context) error {
	userID := c.QueryParam("user_id")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "user_id is required"})
	}

	var stats struct {
		TotalDocuments int   `json:"total_documents"`
		TotalChunks    int   `json:"total_chunks"`
		TotalSize      int64 `json:"total_size"`
	}

	h.db.GormDB.Model(&models.RAGDocument{}).
		Where("user_id = ? AND status = ?", userID, "indexed").
		Select("COUNT(*) as total_documents, SUM(chunk_count) as total_chunks, SUM(file_size) as total_size").
		Scan(&stats)

	return c.JSON(http.StatusOK, stats)
}

// SearchRAG performs a semantic search in the RAG service
func (h *RAGFilesHandler) SearchRAG(c echo.Context) error {
	// Parse request body
	var req struct {
		Query      string   `json:"query"`
		Type       []string `json:"type,omitempty"`
		MaxResults int      `json:"max_results,omitempty"`
		MinScore   float64  `json:"min_score,omitempty"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.Query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query is required"})
	}

	// Set defaults
	if req.MaxResults == 0 {
		req.MaxResults = 5
	}
	if req.MinScore == 0 {
		req.MinScore = 0.3
	}

	// Call RAG service
	searchResp, err := h.ragService.Search(req.Query, req.Type, req.MaxResults, req.MinScore)
	if err != nil {
		log.Printf("RAG search failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "search failed"})
	}

	return c.JSON(http.StatusOK, searchResp)
}

// Helper functions

func isValidFileType(ext string) bool {
	validTypes := []string{".txt", ".md", ".pdf"}
	for _, t := range validTypes {
		if ext == t {
			return true
		}
	}
	return false
}

func parseFile(file multipart.File, fileType string) (string, error) {
	switch fileType {
	case ".txt", ".md":
		return parseTextFile(file)
	case ".pdf":
		return parsePDFFile(file)
	default:
		return "", fmt.Errorf("unsupported file type: %s", fileType)
	}
}

func parseTextFile(file multipart.File) (string, error) {
	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func parsePDFFile(file multipart.File) (string, error) {
	// Read all bytes from multipart file
	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read PDF file: %w", err)
	}

	// Create a temporary file to store PDF data
	tmpFile, err := os.CreateTemp("", "pdf-*.pdf")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	// Write PDF data to temp file
	if _, err := tmpFile.Write(data); err != nil {
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}

	// Close before reading with PDF library
	tmpFile.Close()

	// Open PDF file
	pdfFile, pdfReader, err := pdf.Open(tmpFile.Name())
	if err != nil {
		return "", fmt.Errorf("failed to open PDF: %w", err)
	}
	defer pdfFile.Close()

	// Extract text from all pages
	var textBuffer bytes.Buffer
	numPages := pdfReader.NumPage()

	for pageNum := 1; pageNum <= numPages; pageNum++ {
		page := pdfReader.Page(pageNum)
		if page.V.IsNull() {
			continue
		}

		// Get text content from page
		text, err := page.GetPlainText(nil)
		if err != nil {
			log.Printf("Warning: failed to extract text from page %d: %v", pageNum, err)
			continue
		}

		textBuffer.WriteString(text)
		textBuffer.WriteString("\n")
	}

	extractedText := textBuffer.String()
	if len(extractedText) == 0 {
		return "", fmt.Errorf("no text could be extracted from PDF")
	}

	return extractedText, nil
}
