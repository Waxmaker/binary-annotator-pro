package handlers

import (
	"net/http"
	"sort"
	"strconv"

	"binary-annotator-pro/models"

	"github.com/labstack/echo/v4"
)

// CreateHuffmanTable creates a new Huffman table with entries and generates codes
func (h *Handler) CreateHuffmanTable(c echo.Context) error {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Entries     []struct {
			Symbol     int `json:"symbol"`
			CodeLength int `json:"code_length"`
		} `json:"entries"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Name is required"})
	}

	if len(req.Entries) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "At least one entry is required"})
	}

	// Check if table with this name already exists
	var existing models.HuffmanTable
	if err := h.db.GormDB.Where("name = ?", req.Name).First(&existing).Error; err == nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Table with this name already exists"})
	}

	// Generate Huffman codes using canonical Huffman algorithm
	codes := generateCanonicalHuffmanCodes(req.Entries)

	// Create table and entries
	table := models.HuffmanTable{
		Name:        req.Name,
		Description: req.Description,
		Entries:     make([]models.HuffmanTableEntry, len(req.Entries)),
	}

	for i, entry := range req.Entries {
		table.Entries[i] = models.HuffmanTableEntry{
			Symbol:     entry.Symbol,
			CodeLength: entry.CodeLength,
			Code:       codes[i],
		}
	}

	if err := h.db.GormDB.Create(&table).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create Huffman table"})
	}

	// Load the created table with entries
	var created models.HuffmanTable
	if err := h.db.GormDB.Preload("Entries").First(&created, table.ID).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to load created table"})
	}

	return c.JSON(http.StatusCreated, created)
}

// generateCanonicalHuffmanCodes generates canonical Huffman codes from symbol-length pairs
func generateCanonicalHuffmanCodes(entries []struct {
	Symbol     int `json:"symbol"`
	CodeLength int `json:"code_length"`
}) []string {
	// Sort by code length, then by symbol value
	type sortEntry struct {
		Symbol int
		Length int
		Index  int
	}

	sorted := make([]sortEntry, len(entries))
	for i, e := range entries {
		sorted[i] = sortEntry{Symbol: e.Symbol, Length: e.CodeLength, Index: i}
	}

	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Length != sorted[j].Length {
			return sorted[i].Length < sorted[j].Length
		}
		return sorted[i].Symbol < sorted[j].Symbol
	})

	codes := make([]string, len(entries))
	code := 0

	for i, entry := range sorted {
		if i > 0 {
			code++
			// If length increased, shift code left
			lengthDiff := entry.Length - sorted[i-1].Length
			code <<= lengthDiff
		}

		// Convert code to binary string with appropriate length
		codeStr := ""
		for j := entry.Length - 1; j >= 0; j-- {
			if (code>>j)&1 == 1 {
				codeStr += "1"
			} else {
				codeStr += "0"
			}
		}

		codes[entry.Index] = codeStr
	}

	return codes
}

// ListHuffmanTables lists all Huffman tables (without entries)
func (h *Handler) ListHuffmanTables(c echo.Context) error {
	var tables []models.HuffmanTable
	if err := h.db.GormDB.Find(&tables).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to list tables"})
	}
	return c.JSON(http.StatusOK, tables)
}

// GetHuffmanTable retrieves a Huffman table by ID with all entries
func (h *Handler) GetHuffmanTable(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid table ID"})
	}

	var table models.HuffmanTable
	if err := h.db.GormDB.Preload("Entries").First(&table, uint(id)).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Table not found"})
	}

	return c.JSON(http.StatusOK, table)
}

// GetHuffmanTableByName retrieves a Huffman table by name with all entries
func (h *Handler) GetHuffmanTableByName(c echo.Context) error {
	name := c.Param("name")

	var table models.HuffmanTable
	if err := h.db.GormDB.Preload("Entries").Where("name = ?", name).First(&table).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Table not found"})
	}

	return c.JSON(http.StatusOK, table)
}

// UpdateHuffmanTable updates an existing Huffman table
func (h *Handler) UpdateHuffmanTable(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid table ID"})
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Entries     []struct {
			Symbol     int `json:"symbol"`
			CodeLength int `json:"code_length"`
		} `json:"entries"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	// Check if table exists
	var table models.HuffmanTable
	if err := h.db.GormDB.First(&table, uint(id)).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Table not found"})
	}

	// Check if new name conflicts with existing table (if name changed)
	if req.Name != "" && req.Name != table.Name {
		var existing models.HuffmanTable
		if err := h.db.GormDB.Where("name = ? AND id != ?", req.Name, uint(id)).First(&existing).Error; err == nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "Table with this name already exists"})
		}
		table.Name = req.Name
	}

	// Update description
	table.Description = req.Description

	// Delete old entries
	if err := h.db.GormDB.Where("table_id = ?", uint(id)).Delete(&models.HuffmanTableEntry{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete old entries"})
	}

	// Generate new codes
	codes := generateCanonicalHuffmanCodes(req.Entries)

	// Create new entries
	newEntries := make([]models.HuffmanTableEntry, len(req.Entries))
	for i, entry := range req.Entries {
		newEntries[i] = models.HuffmanTableEntry{
			TableID:    uint(id),
			Symbol:     entry.Symbol,
			CodeLength: entry.CodeLength,
			Code:       codes[i],
		}
	}

	// Save table updates
	if err := h.db.GormDB.Save(&table).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update table"})
	}

	// Save new entries
	for _, entry := range newEntries {
		if err := h.db.GormDB.Create(&entry).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create entries"})
		}
	}

	// Load updated table with entries
	var updated models.HuffmanTable
	if err := h.db.GormDB.Preload("Entries").First(&updated, uint(id)).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to load updated table"})
	}

	return c.JSON(http.StatusOK, updated)
}

// DeleteHuffmanTable deletes a Huffman table by ID
func (h *Handler) DeleteHuffmanTable(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid table ID"})
	}

	// Delete entries first (cascade should handle this, but being explicit)
	if err := h.db.GormDB.Where("table_id = ?", uint(id)).Delete(&models.HuffmanTableEntry{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete table entries"})
	}

	// Delete table
	if err := h.db.GormDB.Delete(&models.HuffmanTable{}, uint(id)).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete table"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Table deleted successfully"})
}

// DecodeHuffmanSelection decodes a binary selection using a Huffman table
func (h *Handler) DecodeHuffmanSelection(c echo.Context) error {
	var req struct {
		TableID   uint  `json:"table_id"`
		FileID    uint  `json:"file_id"`
		Offset    int64 `json:"offset"`
		Length    int64 `json:"length"`
		BitOffset int   `json:"bit_offset"` // Start bit within the first byte (0-7)
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	// Load Huffman table with entries
	var table models.HuffmanTable
	if err := h.db.GormDB.Preload("Entries").First(&table, req.TableID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Table not found"})
	}

	// Load file data
	var file models.File
	if err := h.db.GormDB.First(&file, req.FileID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
	}

	// Extract selection
	if req.Offset < 0 || req.Offset >= int64(len(file.Data)) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid offset"})
	}

	endOffset := req.Offset + req.Length
	if endOffset > int64(len(file.Data)) {
		endOffset = int64(len(file.Data))
	}

	selection := file.Data[req.Offset:endOffset]

	// Build code-to-symbol lookup map
	codeMap := make(map[string]int)
	for _, entry := range table.Entries {
		codeMap[entry.Code] = entry.Symbol
	}

	// Decode the selection
	decoded := decodeHuffmanData(selection, codeMap, req.BitOffset)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"table_name": table.Name,
		"decoded":    decoded,
		"count":      len(decoded),
	})
}

// decodeHuffmanData decodes binary data using a Huffman code map
func decodeHuffmanData(data []byte, codeMap map[string]int, bitOffset int) []int {
	var result []int
	currentCode := ""
	bitPos := bitOffset

	for byteIdx := 0; byteIdx < len(data); byteIdx++ {
		b := data[byteIdx]

		for bitInByte := bitPos; bitInByte < 8; bitInByte++ {
			// Extract bit
			bit := (b >> (7 - bitInByte)) & 1
			if bit == 1 {
				currentCode += "1"
			} else {
				currentCode += "0"
			}

			// Check if current code matches any symbol
			if symbol, found := codeMap[currentCode]; found {
				result = append(result, symbol)
				currentCode = ""
			}
		}

		bitPos = 0 // After first byte, always start at bit 0
	}

	return result
}

// AnalyzeHuffmanPatterns analyzes a binary section to detect potential Huffman patterns
func (h *Handler) AnalyzeHuffmanPatterns(c echo.Context) error {
	var req struct {
		FileID        uint `json:"file_id"`
		Offset        int  `json:"offset"`
		Length        int  `json:"length"`
		MaxCodeLength int  `json:"max_code_length"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if req.MaxCodeLength < 1 || req.MaxCodeLength > 16 {
		req.MaxCodeLength = 8
	}

	// Load file data
	var file models.File
	if err := h.db.GormDB.First(&file, req.FileID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
	}

	// Validate offset and length
	if req.Offset < 0 || req.Offset >= len(file.Data) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid offset"})
	}

	endOffset := req.Offset + req.Length
	if endOffset > len(file.Data) {
		endOffset = len(file.Data)
	}

	selection := file.Data[req.Offset:endOffset]

	// Extract bits
	var bits []int
	for i := 0; i < len(selection) && i < 65536; i++ {
		b := selection[i]
		for bit := 0; bit < 8; bit++ {
			bits = append(bits, int((b>>(7-bit))&1))
		}
	}

	// Find repeating patterns
	patterns := make(map[string]int)

	for patternLen := 1; patternLen <= req.MaxCodeLength && patternLen <= 16; patternLen++ {
		localPatterns := make(map[string]int)

		for i := 0; i <= len(bits)-patternLen; i++ {
			pattern := ""
			for j := 0; j < patternLen; j++ {
				if bits[i+j] == 1 {
					pattern += "1"
				} else {
					pattern += "0"
				}
			}
			localPatterns[pattern]++
		}

		// Keep patterns that appear frequently
		for pattern, count := range localPatterns {
			if count >= 3 {
				patterns[pattern] = count
			}
		}
	}

	// Sort patterns by frequency and length
	type patternInfo struct {
		Pattern string `json:"pattern"`
		Length  int    `json:"length"`
		Count   int    `json:"count"`
	}

	var result []patternInfo
	for pattern, count := range patterns {
		result = append(result, patternInfo{
			Pattern: pattern,
			Length:  len(pattern),
			Count:   count,
		})
	}

	// Sort by count (descending), then by length (ascending)
	sort.Slice(result, func(i, j int) bool {
		if result[i].Count != result[j].Count {
			return result[i].Count > result[j].Count
		}
		return result[i].Length < result[j].Length
	})

	// Limit to top 32 patterns
	if len(result) > 32 {
		result = result[:32]
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"patterns":   result,
		"total_bits": len(bits),
	})
}
