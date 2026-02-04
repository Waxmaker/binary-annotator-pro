package handlers

import (
	"binary-annotator-pro/models"
	"encoding/json"
	"fmt"
	"math"
	"net/http"

	"github.com/labstack/echo/v4"
)

// ========== Binary Diff API ==========

type BinaryDiffRequest struct {
	File1ID    uint `json:"file1_id"`
	File2ID    uint `json:"file2_id"`
	ChunkSize  int  `json:"chunk_size"`  // Bytes per line (default 16)
	MaxResults int  `json:"max_results"` // Max diff chunks to return (default 10000)
}

type DiffChunk struct {
	Offset   int      `json:"offset"`
	Type     string   `json:"type"` // "equal", "modified", "added", "removed"
	Bytes1   []uint8  `json:"bytes1"` // Always include, even if empty
	Bytes2   []uint8  `json:"bytes2"` // Always include, even if empty
	DiffMask []bool   `json:"diff_mask,omitempty"` // Which bytes differ within chunk
}

type BinaryDiffResponse struct {
	Chunks      []DiffChunk `json:"chunks"`
	TotalChunks int         `json:"total_chunks"`
	Truncated   bool        `json:"truncated"`
}

func (h *Handler) CompareBinaryFiles(c echo.Context) error {
	var req BinaryDiffRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Validate
	if req.File1ID == 0 || req.File2ID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Both file IDs required"})
	}
	if req.ChunkSize <= 0 {
		req.ChunkSize = 16
	}
	if req.MaxResults <= 0 {
		req.MaxResults = 10000
	}

	// Fetch files
	var file1, file2 models.File
	if err := h.db.GormDB.First(&file1, req.File1ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 1 not found"})
	}
	if err := h.db.GormDB.First(&file2, req.File2ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 2 not found"})
	}

	// Calculate diff
	chunks := []DiffChunk{}
	offset := 0
	maxLen := len(file1.Data)
	if len(file2.Data) > maxLen {
		maxLen = len(file2.Data)
	}

	totalChunks := 0
	truncated := false

	for offset < maxLen {
		if len(chunks) >= req.MaxResults {
			truncated = true
			break
		}

		end1 := offset + req.ChunkSize
		if end1 > len(file1.Data) {
			end1 = len(file1.Data)
		}
		end2 := offset + req.ChunkSize
		if end2 > len(file2.Data) {
			end2 = len(file2.Data)
		}

		bytes1 := []uint8{}
		bytes2 := []uint8{}
		if offset < len(file1.Data) {
			bytes1 = file1.Data[offset:end1]
		}
		if offset < len(file2.Data) {
			bytes2 = file2.Data[offset:end2]
		}

		// Determine diff type
		diffType := "equal"
		diffMask := []bool{}

		if len(bytes1) == 0 && len(bytes2) > 0 {
			diffType = "added"
		} else if len(bytes1) > 0 && len(bytes2) == 0 {
			diffType = "removed"
		} else if len(bytes1) > 0 && len(bytes2) > 0 {
			// Check for modifications
			hasModification := false
			maxChunkLen := len(bytes1)
			if len(bytes2) > maxChunkLen {
				maxChunkLen = len(bytes2)
			}

			for i := 0; i < maxChunkLen; i++ {
				b1 := uint8(0)
				b2 := uint8(0)
				if i < len(bytes1) {
					b1 = bytes1[i]
				}
				if i < len(bytes2) {
					b2 = bytes2[i]
				}
				differs := b1 != b2
				diffMask = append(diffMask, differs)
				if differs {
					hasModification = true
				}
			}

			if hasModification {
				diffType = "modified"
			}
		}

		// Only include chunks that have differences
		if diffType != "equal" {
			chunk := DiffChunk{
				Offset:   offset,
				Type:     diffType,
				Bytes1:   bytes1,
				Bytes2:   bytes2,
				DiffMask: diffMask,
			}
			chunks = append(chunks, chunk)
		}

		totalChunks++
		offset += req.ChunkSize
	}

	return c.JSON(http.StatusOK, BinaryDiffResponse{
		Chunks:      chunks,
		TotalChunks: totalChunks,
		Truncated:   truncated,
	})
}

// ========== Delta Analysis API ==========

type DeltaAnalysisRequest struct {
	File1ID         uint `json:"file1_id"`
	File2ID         uint `json:"file2_id"`
	MinRegionSize   int  `json:"min_region_size"`   // Minimum bytes for a changed region (default 4)
	MaxChangePoints int  `json:"max_change_points"` // Max individual changes to return (default 1000)
}

type DiffStats struct {
	TotalBytes       int     `json:"total_bytes"`
	ChangedBytes     int     `json:"changed_bytes"`
	UnchangedBytes   int     `json:"unchanged_bytes"`
	PercentChanged   float64 `json:"percent_changed"`
	File1Size        int     `json:"file1_size"`
	File2Size        int     `json:"file2_size"`
	SizeDifference   int     `json:"size_difference"`
	ChangedRegions   int     `json:"changed_regions"`
	LongestUnchanged int     `json:"longest_unchanged"`
}

type ByteChange struct {
	Offset int   `json:"offset"`
	Old    uint8 `json:"old"`
	New    uint8 `json:"new"`
}

type ChangedRegion struct {
	Start  int `json:"start"`
	End    int `json:"end"`
	Length int `json:"length"`
}

type DeltaAnalysisResponse struct {
	Stats   DiffStats       `json:"stats"`
	Changes []ByteChange    `json:"changes"`
	Regions []ChangedRegion `json:"regions"`
}

func (h *Handler) AnalyzeDelta(c echo.Context) error {
	var req DeltaAnalysisRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if req.File1ID == 0 || req.File2ID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Both file IDs required"})
	}
	if req.MinRegionSize <= 0 {
		req.MinRegionSize = 4
	}
	if req.MaxChangePoints <= 0 {
		req.MaxChangePoints = 1000
	}

	// Fetch files
	var file1, file2 models.File
	if err := h.db.GormDB.First(&file1, req.File1ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 1 not found"})
	}
	if err := h.db.GormDB.First(&file2, req.File2ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 2 not found"})
	}

	// Calculate stats
	maxLen := len(file1.Data)
	if len(file2.Data) > maxLen {
		maxLen = len(file2.Data)
	}

	changedBytes := 0
	unchangedBytes := 0
	longestUnchanged := 0
	currentUnchanged := 0
	changes := []ByteChange{}
	regions := []ChangedRegion{}
	inRegion := false
	regionStart := 0

	for i := 0; i < maxLen; i++ {
		b1 := uint8(0)
		b2 := uint8(0)
		if i < len(file1.Data) {
			b1 = file1.Data[i]
		}
		if i < len(file2.Data) {
			b2 = file2.Data[i]
		}

		if b1 != b2 {
			changedBytes++
			currentUnchanged = 0

			// Track individual changes
			if len(changes) < req.MaxChangePoints {
				changes = append(changes, ByteChange{
					Offset: i,
					Old:    b1,
					New:    b2,
				})
			}

			// Track regions
			if !inRegion {
				inRegion = true
				regionStart = i
			}
		} else {
			unchangedBytes++
			currentUnchanged++
			if currentUnchanged > longestUnchanged {
				longestUnchanged = currentUnchanged
			}

			// End region if long enough unchanged sequence
			if inRegion && currentUnchanged >= req.MinRegionSize {
				regionEnd := i - req.MinRegionSize
				if regionEnd > regionStart {
					regions = append(regions, ChangedRegion{
						Start:  regionStart,
						End:    regionEnd,
						Length: regionEnd - regionStart,
					})
				}
				inRegion = false
			}
		}
	}

	// Close final region
	if inRegion {
		regions = append(regions, ChangedRegion{
			Start:  regionStart,
			End:    maxLen,
			Length: maxLen - regionStart,
		})
	}

	percentChanged := 0.0
	if maxLen > 0 {
		percentChanged = float64(changedBytes) / float64(maxLen) * 100
	}

	stats := DiffStats{
		TotalBytes:       maxLen,
		ChangedBytes:     changedBytes,
		UnchangedBytes:   unchangedBytes,
		PercentChanged:   percentChanged,
		File1Size:        len(file1.Data),
		File2Size:        len(file2.Data),
		SizeDifference:   len(file2.Data) - len(file1.Data),
		ChangedRegions:   len(regions),
		LongestUnchanged: longestUnchanged,
	}

	return c.JSON(http.StatusOK, DeltaAnalysisResponse{
		Stats:   stats,
		Changes: changes,
		Regions: regions,
	})
}

// ========== Pattern Correlation API ==========

type PatternCorrelationRequest struct {
	File1ID    uint `json:"file1_id"`
	File2ID    uint `json:"file2_id"`
	WindowSize int  `json:"window_size"` // Sliding window size (default 256)
	MaxSamples int  `json:"max_samples"` // Max correlation samples to return (default 5000)
}

type CorrelationPoint struct {
	Offset      int     `json:"offset"`
	Correlation float64 `json:"correlation"` // -1 to 1
}

type PatternCorrelationResponse struct {
	Correlations []CorrelationPoint `json:"correlations"`
	Average      float64            `json:"average"`
	MinValue     float64            `json:"min_value"`
	MaxValue     float64            `json:"max_value"`
	Sampled      bool               `json:"sampled"`
}

func (h *Handler) CalculatePatternCorrelation(c echo.Context) error {
	var req PatternCorrelationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if req.File1ID == 0 || req.File2ID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Both file IDs required"})
	}
	if req.WindowSize <= 0 {
		req.WindowSize = 256
	}
	if req.MaxSamples <= 0 {
		req.MaxSamples = 5000
	}

	// Fetch files
	var file1, file2 models.File
	if err := h.db.GormDB.First(&file1, req.File1ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 1 not found"})
	}
	if err := h.db.GormDB.First(&file2, req.File2ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 2 not found"})
	}

	// Calculate correlation at multiple offsets
	minLen := len(file1.Data)
	if len(file2.Data) < minLen {
		minLen = len(file2.Data)
	}

	if minLen < req.WindowSize {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Files too small for window size",
		})
	}

	// Determine sampling step
	maxPossibleSamples := minLen - req.WindowSize + 1
	step := int(math.Max(1, math.Ceil(float64(maxPossibleSamples)/float64(req.MaxSamples))))
	sampled := step > 1

	correlations := []CorrelationPoint{}
	sum := 0.0
	minVal := 1.0
	maxVal := -1.0

	for offset := 0; offset <= minLen-req.WindowSize; offset += step {
		window1 := file1.Data[offset : offset+req.WindowSize]
		window2 := file2.Data[offset : offset+req.WindowSize]

		// Calculate Pearson correlation
		corr := calculatePearsonCorrelation(window1, window2)

		correlations = append(correlations, CorrelationPoint{
			Offset:      offset,
			Correlation: corr,
		})

		sum += corr
		if corr < minVal {
			minVal = corr
		}
		if corr > maxVal {
			maxVal = corr
		}
	}

	avg := 0.0
	if len(correlations) > 0 {
		avg = sum / float64(len(correlations))
	}

	return c.JSON(http.StatusOK, PatternCorrelationResponse{
		Correlations: correlations,
		Average:      avg,
		MinValue:     minVal,
		MaxValue:     maxVal,
		Sampled:      sampled,
	})
}

// calculatePearsonCorrelation calculates correlation coefficient between two byte arrays
func calculatePearsonCorrelation(data1, data2 []byte) float64 {
	if len(data1) != len(data2) || len(data1) == 0 {
		return 0
	}

	n := float64(len(data1))

	// Calculate means
	sum1 := 0.0
	sum2 := 0.0
	for i := 0; i < len(data1); i++ {
		sum1 += float64(data1[i])
		sum2 += float64(data2[i])
	}
	mean1 := sum1 / n
	mean2 := sum2 / n

	// Calculate correlation
	numerator := 0.0
	sum1Sq := 0.0
	sum2Sq := 0.0

	for i := 0; i < len(data1); i++ {
		diff1 := float64(data1[i]) - mean1
		diff2 := float64(data2[i]) - mean2
		numerator += diff1 * diff2
		sum1Sq += diff1 * diff1
		sum2Sq += diff2 * diff2
	}

	denominator := math.Sqrt(sum1Sq * sum2Sq)
	if denominator == 0 {
		return 0
	}

	return numerator / denominator
}

// ========== Streaming Comparison for Large Files ==========

type StreamingDiffRequest struct {
	File1ID   uint `json:"file1_id"`
	File2ID   uint `json:"file2_id"`
	ChunkSize int  `json:"chunk_size"` // Bytes to compare per request
	Offset    int  `json:"offset"`     // Starting offset
}

type StreamingDiffResponse struct {
	Chunks      []DiffChunk `json:"chunks"`
	NextOffset  int         `json:"next_offset"`
	HasMore     bool        `json:"has_more"`
	File1Size   int         `json:"file1_size"`
	File2Size   int         `json:"file2_size"`
}

func (h *Handler) StreamingCompare(c echo.Context) error {
	var req StreamingDiffRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if req.File1ID == 0 || req.File2ID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Both file IDs required"})
	}
	if req.ChunkSize <= 0 {
		req.ChunkSize = 16 * 1000 // 16KB default
	}
	if req.Offset < 0 {
		req.Offset = 0
	}

	// Fetch files (only metadata, data loaded on-demand)
	var file1, file2 models.File
	if err := h.db.GormDB.First(&file1, req.File1ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 1 not found"})
	}
	if err := h.db.GormDB.First(&file2, req.File2ID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File 2 not found"})
	}

	// Calculate end offset
	maxLen := len(file1.Data)
	if len(file2.Data) > maxLen {
		maxLen = len(file2.Data)
	}

	endOffset := req.Offset + req.ChunkSize
	if endOffset > maxLen {
		endOffset = maxLen
	}

	// Extract chunks for comparison (using 16-byte line size)
	lineSize := 16
	chunks := []DiffChunk{}

	for offset := req.Offset; offset < endOffset; offset += lineSize {
		end1 := offset + lineSize
		if end1 > len(file1.Data) {
			end1 = len(file1.Data)
		}
		end2 := offset + lineSize
		if end2 > len(file2.Data) {
			end2 = len(file2.Data)
		}

		bytes1 := []uint8{}
		bytes2 := []uint8{}
		if offset < len(file1.Data) {
			bytes1 = file1.Data[offset:end1]
		}
		if offset < len(file2.Data) {
			bytes2 = file2.Data[offset:end2]
		}

		// Determine diff type
		diffType := "equal"
		diffMask := []bool{}

		if len(bytes1) == 0 && len(bytes2) > 0 {
			diffType = "added"
		} else if len(bytes1) > 0 && len(bytes2) == 0 {
			diffType = "removed"
		} else if len(bytes1) > 0 && len(bytes2) > 0 {
			hasModification := false
			maxChunkLen := len(bytes1)
			if len(bytes2) > maxChunkLen {
				maxChunkLen = len(bytes2)
			}

			for i := 0; i < maxChunkLen; i++ {
				b1 := uint8(0)
				b2 := uint8(0)
				if i < len(bytes1) {
					b1 = bytes1[i]
				}
				if i < len(bytes2) {
					b2 = bytes2[i]
				}
				differs := b1 != b2
				diffMask = append(diffMask, differs)
				if differs {
					hasModification = true
				}
			}

			if hasModification {
				diffType = "modified"
			}
		}

		chunk := DiffChunk{
			Offset:   offset,
			Type:     diffType,
			Bytes1:   bytes1,
			Bytes2:   bytes2,
			DiffMask: diffMask,
		}
		chunks = append(chunks, chunk)
	}

	hasMore := endOffset < maxLen

	return c.JSON(http.StatusOK, StreamingDiffResponse{
		Chunks:     chunks,
		NextOffset: endOffset,
		HasMore:    hasMore,
		File1Size:  len(file1.Data),
		File2Size:  len(file2.Data),
	})
}

// ExportComparison exports diff results as JSON
func (h *Handler) ExportComparison(c echo.Context) error {
	file1ID := c.QueryParam("file1_id")
	file2ID := c.QueryParam("file2_id")

	if file1ID == "" || file2ID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Both file IDs required"})
	}

	// Create comparison and return as downloadable JSON
	req := BinaryDiffRequest{}
	json.Unmarshal([]byte(`{"file1_id":`+file1ID+`,"file2_id":`+file2ID+`}`), &req)

	// Re-use CompareBinaryFiles logic but return as attachment
	c.Response().Header().Set("Content-Disposition", "attachment; filename=comparison.json")
	return h.CompareBinaryFiles(c)
}

// ========== Multi-File Comparison API ==========

// MultiFileCompareRequest represents a request to compare multiple files
type MultiFileCompareRequest struct {
	FileIDs       []uint `json:"file_ids"`       // Minimum 2 files
	MinRegionSize int    `json:"min_region_size"` // Default: 4 bytes
	MaxRegions    int    `json:"max_regions"`     // Default: 1000
}

// CommonRegion represents a region common to all files
type CommonRegion struct {
	Offsets []int  `json:"offsets"` // Parallel arrays
	Sizes   []int  `json:"sizes"`
	FileIDs []uint `json:"file_ids"`
}

// MultiFileStats provides statistics about the comparison
type MultiFileStats struct {
	TotalFiles       int     `json:"total_files"`
	FileSizes        []int   `json:"file_sizes"`
	MinFileSize      int     `json:"min_file_size"`
	MaxFileSize      int     `json:"max_file_size"`
	CommonBytes      int     `json:"common_bytes"`
	PercentCommon    float64 `json:"percent_common"`
	LargestCommonRgn int     `json:"largest_common_rgn"`
}

// MultiFileCompareResponse contains comparison results and statistics
type MultiFileCompareResponse struct {
	CommonRegions []CommonRegion `json:"common_regions"`
	Stats         MultiFileStats `json:"stats"`
	FileNames     []string       `json:"file_names"`
	TotalRegions  int            `json:"total_regions"`
	Truncated     bool           `json:"truncated"`
}

// CompareMultipleFiles finds common byte regions across multiple files
func (h *Handler) CompareMultipleFiles(c echo.Context) error {
	var req MultiFileCompareRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Validate
	if len(req.FileIDs) < 2 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Minimum 2 files required"})
	}
	if req.MinRegionSize <= 0 {
		req.MinRegionSize = 4
	}
	if req.MaxRegions <= 0 {
		req.MaxRegions = 1000
	}

	// Performance warning
	if len(req.FileIDs) > 10 {
		c.Logger().Warn("Comparing more than 10 files may impact performance")
	}

	// Load all files from database
	files := make([]models.File, len(req.FileIDs))
	fileNames := make([]string, len(req.FileIDs))
	fileSizes := make([]int, len(req.FileIDs))

	for i, fileID := range req.FileIDs {
		if err := h.db.GormDB.First(&files[i], fileID).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": fmt.Sprintf("File not found with ID: %d", fileID),
			})
		}
		fileNames[i] = files[i].Name
		fileSizes[i] = len(files[i].Data)
	}

	// Find minimum file size (comparison limit)
	minSize := fileSizes[0]
	maxSize := fileSizes[0]
	for _, size := range fileSizes {
		if size < minSize {
			minSize = size
		}
		if size > maxSize {
			maxSize = size
		}
	}

	// Warn if files have different sizes
	if minSize != maxSize {
		c.Logger().Warn("Files have different sizes - comparison limited to minimum size")
	}

	// Sliding window algorithm to find common regions
	commonRegions := []CommonRegion{}
	currentRegionStart := -1
	totalCommonBytes := 0
	largestRegion := 0
	truncated := false

	for offset := 0; offset < minSize; offset++ {
		// Check if byte at this offset is identical in ALL files
		allMatch := true
		refByte := files[0].Data[offset]

		for j := 1; j < len(files); j++ {
			if files[j].Data[offset] != refByte {
				allMatch = false
				break
			}
		}

		if allMatch {
			// Start or continue current region
			if currentRegionStart == -1 {
				currentRegionStart = offset
			}
		} else {
			// End current region if it exists and meets minimum size
			if currentRegionStart != -1 {
				regionSize := offset - currentRegionStart
				if regionSize >= req.MinRegionSize {
					if len(commonRegions) >= req.MaxRegions {
						truncated = true
						break
					}

					// Create region with parallel arrays
					offsets := make([]int, len(files))
					sizes := make([]int, len(files))
					for j := range files {
						offsets[j] = currentRegionStart
						sizes[j] = regionSize
					}

					commonRegions = append(commonRegions, CommonRegion{
						Offsets: offsets,
						Sizes:   sizes,
						FileIDs: req.FileIDs,
					})

					totalCommonBytes += regionSize
					if regionSize > largestRegion {
						largestRegion = regionSize
					}
				}
				currentRegionStart = -1
			}
		}
	}

	// Handle final region
	if currentRegionStart != -1 && !truncated {
		regionSize := minSize - currentRegionStart
		if regionSize >= req.MinRegionSize {
			if len(commonRegions) < req.MaxRegions {
				offsets := make([]int, len(files))
				sizes := make([]int, len(files))
				for j := range files {
					offsets[j] = currentRegionStart
					sizes[j] = regionSize
				}

				commonRegions = append(commonRegions, CommonRegion{
					Offsets: offsets,
					Sizes:   sizes,
					FileIDs: req.FileIDs,
				})

				totalCommonBytes += regionSize
				if regionSize > largestRegion {
					largestRegion = regionSize
				}
			} else {
				truncated = true
			}
		}
	}

	// Calculate statistics
	percentCommon := 0.0
	if minSize > 0 {
		percentCommon = float64(totalCommonBytes) / float64(minSize) * 100
	}

	stats := MultiFileStats{
		TotalFiles:       len(files),
		FileSizes:        fileSizes,
		MinFileSize:      minSize,
		MaxFileSize:      maxSize,
		CommonBytes:      totalCommonBytes,
		PercentCommon:    percentCommon,
		LargestCommonRgn: largestRegion,
	}

	return c.JSON(http.StatusOK, MultiFileCompareResponse{
		CommonRegions: commonRegions,
		Stats:         stats,
		FileNames:     fileNames,
		TotalRegions:  len(commonRegions),
		Truncated:     truncated,
	})
}

// GenerateMultiFileDiffYamlRequest represents a request to generate YAML
type GenerateMultiFileDiffYamlRequest struct {
	FileIDs       []uint         `json:"file_ids"`
	CommonRegions []CommonRegion `json:"common_regions"`
	FileNames     []string       `json:"file_names"`
}

// GenerateMultiFileDiffYaml generates a YAML configuration with diff section
func (h *Handler) GenerateMultiFileDiffYaml(c echo.Context) error {
	var req GenerateMultiFileDiffYamlRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if len(req.CommonRegions) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No common regions provided"})
	}

	// Single color for all diff regions (light yellow for easy identification)
	diffColor := "#FFE082"

	// Build YAML content
	yaml := "# Multi-file binary diff configuration\n"
	yaml += "# Generated from comparison of:\n"
	for i, name := range req.FileNames {
		yaml += fmt.Sprintf("#   - %s", name)
		if i < len(req.FileIDs) {
			yaml += fmt.Sprintf(" (ID: %d)\n", req.FileIDs[i])
		} else {
			yaml += "\n"
		}
	}
	yaml += "\n"
	yaml += "diff:\n"

	for i, region := range req.CommonRegions {
		yaml += fmt.Sprintf("  common_region_%d:\n", i)

		// Format offsets as hex array
		yaml += "    offsets: ["
		for j, offset := range region.Offsets {
			if j > 0 {
				yaml += ", "
			}
			yaml += fmt.Sprintf("0x%04X", offset)
		}
		yaml += "]\n"

		// Format sizes as decimal array
		yaml += "    sizes: ["
		for j, size := range region.Sizes {
			if j > 0 {
				yaml += ", "
			}
			yaml += fmt.Sprintf("%d", size)
		}
		yaml += "]\n"

		// Add file names
		yaml += "    files: ["
		for j, name := range req.FileNames {
			if j > 0 {
				yaml += ", "
			}
			yaml += fmt.Sprintf("\"%s\"", name)
		}
		yaml += "]\n"

		// Use single color for all diff regions
		yaml += fmt.Sprintf("    color: \"%s\"\n", diffColor)

		if i < len(req.CommonRegions)-1 {
			yaml += "\n"
		}
	}

	return c.JSON(http.StatusOK, map[string]string{
		"yaml": yaml,
	})
}
