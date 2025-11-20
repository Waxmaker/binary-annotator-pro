package handlers

import (
	"binary-annotator-pro/models"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

// StartCompressionAnalysis triggers compression detection analysis on a file
func (h *Handler) StartCompressionAnalysis(c echo.Context) error {
	fileIDStr := c.Param("fileId")
	fileID, err := strconv.ParseUint(fileIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid file ID",
		})
	}

	// Check if file exists
	var file models.File
	if err := h.db.GormDB.First(&file, fileID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "file not found",
		})
	}

	// Check if analysis already exists and is running
	var existingAnalysis models.CompressionAnalysis
	err = h.db.GormDB.Where("file_id = ? AND status IN ?", fileID, []string{"pending", "running"}).
		First(&existingAnalysis).Error
	if err == nil {
		// Analysis already running
		return c.JSON(http.StatusOK, map[string]interface{}{
			"message":     "analysis already running",
			"analysis_id": existingAnalysis.ID,
			"status":      existingAnalysis.Status,
		})
	}

	// Create new analysis record
	analysis := models.CompressionAnalysis{
		FileID:     uint(fileID),
		Status:     "pending",
		TotalTests: 0,
	}

	if err := h.db.GormDB.Create(&analysis).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to create analysis record",
		})
	}

	// TODO: Trigger Python compression detector (async)
	// For now, we'll just mark as pending
	// In the future:
	// go h.runCompressionDetector(analysis.ID, file)

	fmt.Printf("Created compression analysis %d for file %s\n", analysis.ID, file.Name)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"analysis_id": analysis.ID,
		"file_id":     fileID,
		"file_name":   file.Name,
		"status":      "pending",
		"message":     "Compression analysis queued (Python detector not yet implemented)",
	})
}

// GetCompressionAnalysis retrieves compression analysis results
func (h *Handler) GetCompressionAnalysis(c echo.Context) error {
	analysisIDStr := c.Param("analysisId")
	analysisID, err := strconv.ParseUint(analysisIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid analysis ID",
		})
	}

	// Get analysis with results
	var analysis models.CompressionAnalysis
	if err := h.db.GormDB.Preload("Results").First(&analysis, analysisID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "analysis not found",
		})
	}

	return c.JSON(http.StatusOK, analysis)
}

// GetFileCompressionAnalyses gets all compression analyses for a file
func (h *Handler) GetFileCompressionAnalyses(c echo.Context) error {
	fileIDStr := c.Param("fileId")
	fileID, err := strconv.ParseUint(fileIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid file ID",
		})
	}

	// Get all analyses for this file, ordered by creation date
	var analyses []models.CompressionAnalysis
	if err := h.db.GormDB.Where("file_id = ?", fileID).
		Order("created_at DESC").
		Preload("Results").
		Find(&analyses).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch analyses",
		})
	}

	return c.JSON(http.StatusOK, analyses)
}

// GetLatestCompressionAnalysis gets the most recent analysis for a file
func (h *Handler) GetLatestCompressionAnalysis(c echo.Context) error {
	fileIDStr := c.Param("fileId")
	fileID, err := strconv.ParseUint(fileIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid file ID",
		})
	}

	// Get latest analysis
	var analysis models.CompressionAnalysis
	if err := h.db.GormDB.Where("file_id = ?", fileID).
		Order("created_at DESC").
		Preload("Results").
		First(&analysis).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "no analysis found for this file",
		})
	}

	return c.JSON(http.StatusOK, analysis)
}

// DownloadDecompressedFile downloads a decompressed variant
func (h *Handler) DownloadDecompressedFile(c echo.Context) error {
	resultIDStr := c.Param("resultId")
	resultID, err := strconv.ParseUint(resultIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid result ID",
		})
	}

	// Get result
	var result models.CompressionResult
	if err := h.db.GormDB.First(&result, resultID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "result not found",
		})
	}

	// Check if decompressed file exists
	if result.DecompressedFileID == nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "no decompressed file available",
		})
	}

	// Get decompressed file
	var decompressedFile models.DecompressedFile
	if err := h.db.GormDB.First(&decompressedFile, *result.DecompressedFileID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "decompressed file not found",
		})
	}

	// Set headers and return blob
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", decompressedFile.FileName))
	c.Response().Header().Set("Content-Type", "application/octet-stream")
	c.Response().Header().Set("Content-Length", fmt.Sprintf("%d", decompressedFile.Size))

	return c.Blob(http.StatusOK, "application/octet-stream", decompressedFile.Data)
}

// DeleteCompressionAnalysis deletes an analysis and its results
func (h *Handler) DeleteCompressionAnalysis(c echo.Context) error {
	analysisIDStr := c.Param("analysisId")
	analysisID, err := strconv.ParseUint(analysisIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid analysis ID",
		})
	}

	// Delete all results first
	if err := h.db.GormDB.Where("analysis_id = ?", analysisID).Delete(&models.CompressionResult{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to delete results",
		})
	}

	// Delete analysis
	if err := h.db.GormDB.Delete(&models.CompressionAnalysis{}, analysisID).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to delete analysis",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "analysis deleted",
	})
}

// TODO: This will be called when Python detector is integrated
// func (h *Handler) runCompressionDetector(analysisID uint, file models.File) {
// 	// Update status to running
// 	h.db.GormDB.Model(&models.CompressionAnalysis{}).Where("id = ?", analysisID).
// 		Update("status", "running")
//
// 	// Call Python script
// 	// python3 backend/compression_detector/detector.py --file-id <file.ID>
//
// 	// Parse results and save to database
//
// 	// Update status to completed or failed
// }
