package handlers

import (
	"binary-annotator-pro/models"
	"fmt"
	"math"
	"net/http"

	"github.com/labstack/echo/v4"
)

type DeleteBinaryRequest struct {
	Name string `param:"name"`
}

func (h *Handler) DeleteBinaryFile(c echo.Context) error {
	name := c.Param("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "missing file name",
		})
	}
	fmt.Printf("Deleting binary file: %s\n", name)

	// Delete from DB (hard delete with Unscoped to allow re-uploading with same name)
	res := h.db.GormDB.Unscoped().Where("name = ?", name).Delete(&models.File{})
	if res.Error != nil {
		fmt.Printf("Error deleting file from DB: %v\n", res.Error)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": res.Error.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "file deleted",
		"file":    name,
	})
}

// RenameBinaryFile renames a binary file
func (h *Handler) RenameBinaryFile(c echo.Context) error {
	oldName := c.Param("name")
	if oldName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name required"})
	}

	var req struct {
		NewName string `json:"new_name"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.NewName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "new_name required"})
	}

	fmt.Printf("Renaming binary file: %s -> %s\n", oldName, req.NewName)

	// Check if old file exists
	var file models.File
	if err := h.db.GormDB.Where("name = ?", oldName).First(&file).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "file not found"})
	}

	// Check if new name already exists
	var existing models.File
	if err := h.db.GormDB.Where("name = ?", req.NewName).First(&existing).Error; err == nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "file with new name already exists"})
	}

	// Update the file name
	file.Name = req.NewName
	if err := h.db.GormDB.Save(&file).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":  "renamed",
		"old_name": oldName,
		"new_name": req.NewName,
	})
}

// GetBinaryChunk returns a chunk of binary data from a file
// Used by HexViewer for efficient scroll-based loading
func (h *Handler) GetBinaryChunk(c echo.Context) error {
	fileID := c.Param("id")
	if fileID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file ID required"})
	}

	// Parse query params
	offset := 0
	length := 16 * 1000 // Default 16KB chunk

	if o := c.QueryParam("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}
	if l := c.QueryParam("length"); l != "" {
		fmt.Sscanf(l, "%d", &length)
	}

	// Validate
	if offset < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "offset must be non-negative"})
	}
	if length <= 0 || length > 10*1024*1024 { // Max 10MB per chunk
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "length must be between 1 and 10MB"})
	}

	// Load file from DB (only metadata first)
	var file models.File
	if err := h.db.GormDB.First(&file, fileID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "file not found"})
	}

	// Validate offset against file size
	if offset >= len(file.Data) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "offset exceeds file size"})
	}

	// Calculate actual end offset
	endOffset := offset + length
	if endOffset > len(file.Data) {
		endOffset = len(file.Data)
	}

	// Extract chunk
	chunk := file.Data[offset:endOffset]

	// Return chunk data
	return c.JSON(http.StatusOK, map[string]interface{}{
		"file_id":    file.ID,
		"file_name":  file.Name,
		"file_size":  len(file.Data),
		"offset":     offset,
		"length":     len(chunk),
		"data":       chunk, // Will be base64 encoded by Go JSON
		"has_more":   endOffset < len(file.Data),
	})
}

// Trigram represents a 3-byte sequence with position
type Trigram struct {
	X        uint8   `json:"x"`
	Y        uint8   `json:"y"`
	Z        uint8   `json:"z"`
	Position float64 `json:"position"` // 0.0 to 1.0, normalized position in file
}

// TrigramResponse is the JSON response for trigram analysis
type TrigramResponse struct {
	Trigrams []Trigram `json:"trigrams"`
	Total    int       `json:"total"`
	Sampled  bool      `json:"sampled"`
}

// GetBinaryTrigrams calculates trigrams for a binary file
func (h *Handler) GetBinaryTrigrams(c echo.Context) error {
	fileName := c.Param("name")
	if fileName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "missing file name",
		})
	}

	// Get max samples from query param (default 50000)
	maxSamples := 50000
	if ms := c.QueryParam("max_samples"); ms != "" {
		fmt.Sscanf(ms, "%d", &maxSamples)
	}

	// Load file from DB
	var file models.File
	if err := h.db.GormDB.Where("name = ?", fileName).First(&file).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "file not found",
		})
	}

	data := file.Data
	dataLen := len(data)

	if dataLen < 3 {
		return c.JSON(http.StatusOK, TrigramResponse{
			Trigrams: []Trigram{},
			Total:    0,
			Sampled:  false,
		})
	}

	// Calculate step size for sampling
	step := int(math.Max(1, math.Floor(float64(dataLen-2)/float64(maxSamples))))
	sampled := step > 1

	trigrams := make([]Trigram, 0, maxSamples)

	for i := 0; i < dataLen-2; i += step {
		trigrams = append(trigrams, Trigram{
			X:        data[i],
			Y:        data[i+1],
			Z:        data[i+2],
			Position: float64(i) / float64(dataLen),
		})
	}

	fmt.Printf("Generated %d trigrams for file %s (sampled: %v, step: %d)\n",
		len(trigrams), fileName, sampled, step)

	return c.JSON(http.StatusOK, TrigramResponse{
		Trigrams: trigrams,
		Total:    len(trigrams),
		Sampled:  sampled,
	})
}
