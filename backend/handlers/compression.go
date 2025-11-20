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

	// Create temporary directory for decompressed files
	tmpDir := fmt.Sprintf("/tmp/decompressed_%d_%d", file.ID, analysisID)
	err = os.MkdirAll(tmpDir, 0755)
	if err != nil {
		h.updateAnalysisError(analysisID, fmt.Sprintf("Failed to create temp dir: %v", err))
		return
	}
	defer os.RemoveAll(tmpDir)

	// Execute Python script with output directory
	scriptPath := "../test/compression_detector.py"
	cmd := exec.Command("python3", scriptPath, tmpFile, "--json", "--output-dir", tmpDir)

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

	// Save results to database (including decompressed files)
	if err := h.saveCompressionResults(analysisID, file.ID, &report, tmpDir, tmpFile); err != nil {
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

// ListDecompressedFiles returns all decompressed files
func (h *Handler) ListDecompressedFiles(c echo.Context) error {
	var decompFiles []models.DecompressedFile

	// Get all decompressed files with their associated data
	if err := h.db.GormDB.Order("created_at DESC").Find(&decompFiles).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch decompressed files",
		})
	}

	// Format response with file info
	type DecompressedFileInfo struct {
		ID             uint   `json:"id"`
		OriginalFileID uint   `json:"original_file_id"`
		ResultID       uint   `json:"result_id"`
		Method         string `json:"method"`
		FileName       string `json:"file_name"`
		Size           int64  `json:"size"`
		CreatedAt      string `json:"created_at"`
	}

	response := make([]DecompressedFileInfo, len(decompFiles))
	for i, df := range decompFiles {
		response[i] = DecompressedFileInfo{
			ID:             df.ID,
			OriginalFileID: df.OriginalFileID,
			ResultID:       df.ResultID,
			Method:         df.Method,
			FileName:       df.FileName,
			Size:           df.Size,
			CreatedAt:      df.CreatedAt.Format("2006-01-02 15:04:05"),
		}
	}

	return c.JSON(http.StatusOK, response)
}

// GetDecompressedFileData returns the binary data of a decompressed file
func (h *Handler) GetDecompressedFileData(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid file ID",
		})
	}

	var decompFile models.DecompressedFile
	if err := h.db.GormDB.First(&decompFile, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "file not found",
		})
	}

	// Return binary data
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", decompFile.FileName))
	c.Response().Header().Set("Content-Type", "application/octet-stream")
	return c.Blob(http.StatusOK, "application/octet-stream", decompFile.Data)
}

// AddDecompressedToFiles adds a decompressed file to the main files list
func (h *Handler) AddDecompressedToFiles(c echo.Context) error {
	resultIDStr := c.Param("resultId")
	resultID, err := strconv.ParseUint(resultIDStr, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid result ID",
		})
	}

	// Get the result
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
	var decompFile models.DecompressedFile
	if err := h.db.GormDB.First(&decompFile, *result.DecompressedFileID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "decompressed file not found",
		})
	}

	// Create new binary file
	newFile := models.File{
		Name: decompFile.FileName,
		Size: decompFile.Size,
		Data: decompFile.Data,
	}

	if err := h.db.GormDB.Create(&newFile).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to add file",
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "file added successfully",
		"file": map[string]interface{}{
			"id":   newFile.ID,
			"name": newFile.Name,
			"size": newFile.Size,
		},
	})
}

// saveCompressionResults saves decompression results to database
func (h *Handler) saveCompressionResults(analysisID uint, fileID uint, report *PythonAnalysisReport, tmpDir, tmpFile string) error {
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

		// Save the result first to get an ID
		if err := h.db.GormDB.Create(&result).Error; err != nil {
			return fmt.Errorf("failed to save result for %s: %w", pyResult.Method, err)
		}

		// Try to load and save decompressed file if it exists and was successful
		if pyResult.Success && pyResult.ChecksumValid {
			decompressedPath := fmt.Sprintf("%s.%s.decompressed", tmpFile, pyResult.Method)
			if data, err := os.ReadFile(decompressedPath); err == nil {
				// Save decompressed file to database
				decompressedFile := models.DecompressedFile{
					OriginalFileID: fileID,
					ResultID:       result.ID,
					Method:         pyResult.Method,
					FileName:       fmt.Sprintf("%s_%s_decompressed", report.FilePath, pyResult.Method),
					Size:           int64(len(data)),
					Data:           data,
				}

				if err := h.db.GormDB.Create(&decompressedFile).Error; err != nil {
					fmt.Printf("Warning: failed to save decompressed file for %s: %v\n", pyResult.Method, err)
				} else {
					// Update result with decompressed file ID
					decompressedFileID := decompressedFile.ID
					result.DecompressedFileID = &decompressedFileID
					h.db.GormDB.Save(&result)
				}
			}
		}
	}

	return nil
}
