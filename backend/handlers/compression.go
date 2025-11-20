package handlers

import (
	"binary-annotator-pro/models"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
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

	// Trigger Python compression detector asynchronously
	go h.runCompressionDetector(analysis.ID, file)

	fmt.Printf("Created compression analysis %d for file %s\n", analysis.ID, file.Name)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"analysis_id": analysis.ID,
		"file_id":     fileID,
		"file_name":   file.Name,
		"status":      "pending",
		"message":     "Compression analysis started",
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

// Python analysis result structures
type PythonDecompressionResult struct {
	Method               string  `json:"method"`
	Success              bool    `json:"success"`
	DecompressedSize     int64   `json:"decompressed_size"`
	OriginalSize         int64   `json:"original_size"`
	CompressionRatio     float64 `json:"compression_ratio"`
	Confidence           float64 `json:"confidence"`
	EntropyOriginal      float64 `json:"entropy_original"`
	EntropyDecompressed  float64 `json:"entropy_decompressed"`
	ChecksumValid        bool    `json:"checksum_valid"`
	ValidationMsg        string  `json:"validation_msg"`
	Error                *string `json:"error"`
}

type PythonAnalysisReport struct {
	FilePath      string                       `json:"file_path"`
	FileSize      int64                        `json:"file_size"`
	TotalTests    int                          `json:"total_tests"`
	SuccessCount  int                          `json:"success_count"`
	FailedCount   int                          `json:"failed_count"`
	BestMethod    *string                      `json:"best_method"`
	BestRatio     float64                      `json:"best_ratio"`
	BestConfidence float64                     `json:"best_confidence"`
	Results       []PythonDecompressionResult  `json:"results"`
}

// runCompressionDetector executes Python compression detector asynchronously
func (h *Handler) runCompressionDetector(analysisID uint, file models.File) {
	// Update status to running
	h.db.GormDB.Model(&models.CompressionAnalysis{}).Where("id = ?", analysisID).
		Updates(map[string]interface{}{
			"status": "running",
		})

	// Create temporary file for analysis
	tmpFile := fmt.Sprintf("/tmp/binary_analysis_%d_%d.bin", file.ID, analysisID)
	err := os.WriteFile(tmpFile, file.Data, 0644)
	if err != nil {
		h.updateAnalysisError(analysisID, fmt.Sprintf("Failed to create temp file: %v", err))
		return
	}
	defer os.Remove(tmpFile)

	// Execute Python script
	scriptPath := "../test/compression_detector.py"
	cmd := exec.Command("python3", scriptPath, tmpFile, "--json")

	output, err := cmd.CombinedOutput()
	if err != nil {
		h.updateAnalysisError(analysisID, fmt.Sprintf("Python script failed: %v\nOutput: %s", err, string(output)))
		return
	}

	// Parse JSON results
	var report PythonAnalysisReport
	if err := json.Unmarshal(output, &report); err != nil {
		h.updateAnalysisError(analysisID, fmt.Sprintf("Failed to parse JSON: %v\nOutput: %s", err, string(output)))
		return
	}

	// Save results to database
	if err := h.saveCompressionResults(analysisID, file.ID, &report); err != nil {
		h.updateAnalysisError(analysisID, fmt.Sprintf("Failed to save results: %v", err))
		return
	}

	// Update analysis status to completed
	updates := map[string]interface{}{
		"status":       "completed",
		"total_tests":  report.TotalTests,
		"success_count": report.SuccessCount,
		"failed_count": report.FailedCount,
	}

	if report.BestMethod != nil {
		updates["best_method"] = *report.BestMethod
		updates["best_ratio"] = report.BestRatio
		updates["best_confidence"] = report.BestConfidence
	}

	h.db.GormDB.Model(&models.CompressionAnalysis{}).Where("id = ?", analysisID).
		Updates(updates)

	fmt.Printf("Compression analysis %d completed successfully\n", analysisID)
}

// updateAnalysisError updates analysis with error status
func (h *Handler) updateAnalysisError(analysisID uint, errorMsg string) {
	h.db.GormDB.Model(&models.CompressionAnalysis{}).Where("id = ?", analysisID).
		Updates(map[string]interface{}{
			"status": "failed",
			"error":  errorMsg,
		})
	fmt.Printf("Compression analysis %d failed: %s\n", analysisID, errorMsg)
}

// saveCompressionResults saves decompression results to database
func (h *Handler) saveCompressionResults(analysisID uint, fileID uint, report *PythonAnalysisReport) error {
	// Save each result
	for _, pyResult := range report.Results {
		result := models.CompressionResult{
			AnalysisID:          analysisID,
			Method:              pyResult.Method,
			Success:             pyResult.Success,
			CompressionRatio:    pyResult.CompressionRatio,
			Confidence:          pyResult.Confidence,
			DecompressedSize:    pyResult.DecompressedSize,
			OriginalSize:        pyResult.OriginalSize,
			EntropyOriginal:     pyResult.EntropyOriginal,
			EntropyDecompressed: pyResult.EntropyDecompressed,
			ChecksumValid:       pyResult.ChecksumValid,
			ValidationMsg:       pyResult.ValidationMsg,
		}

		if pyResult.Error != nil {
			result.Error = *pyResult.Error
		}

		if err := h.db.GormDB.Create(&result).Error; err != nil {
			return fmt.Errorf("failed to save result for %s: %w", pyResult.Method, err)
		}

		// TODO: Save decompressed file if needed
		// For now, we skip saving the actual decompressed data to save space
		// Users can re-run the analysis if they need the decompressed files
	}

	return nil
}
