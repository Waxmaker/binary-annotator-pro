package handlers

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/models"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// Handler holds DB reference
type Handler struct {
	db *config.DB
}

func NewHandler(db *config.DB) *Handler {
	return &Handler{db: db}
}

// UploadBinary: multipart form with file field "file" and optional "name" and "vendor"
func (h *Handler) UploadBinary(c echo.Context) error {
	f, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing file field 'file'"})
	}

	src, err := f.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "open uploaded file"})
	}
	defer src.Close()

	buf, err := io.ReadAll(src)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "read uploaded file"})
	}

	name := c.FormValue("name")
	if name == "" {
		name = f.Filename
	}
	vendor := c.FormValue("vendor")

	file := models.File{
		Name:   name,
		Vendor: vendor,
		Size:   int64(len(buf)),
		Data:   buf,
	}

	if err := h.db.GormDB.Create(&file).Error; err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return c.JSON(http.StatusConflict, map[string]string{"error": "file with that name already exists"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db create file"})
	}

	return c.JSON(http.StatusCreated, map[string]any{"id": file.ID, "name": file.Name, "size": file.Size})
}

// UploadYaml: accept either multipart file "file" (yaml file) or form value "yaml" and optional file_name and name
func (h *Handler) UploadYaml(c echo.Context) error {
	// Try file upload first
	var yamlContent []byte
	if f, err := c.FormFile("file"); err == nil && f != nil {
		src, err := f.Open()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "open yaml file"})
		}
		defer src.Close()
		buf, err := io.ReadAll(src)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "read yaml file"})
		}
		yamlContent = buf
	}

	// fallback to form value
	if len(yamlContent) == 0 {
		v := c.FormValue("yaml")
		if v == "" {
			// try JSON body
			type Req struct {
				Yaml     string `json:"yaml"`
				Name     string `json:"name"`
				FileName string `json:"file_name"`
			}
			var r Req
			if err := c.Bind(&r); err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "no yaml provided"})
			}
			yamlContent = []byte(r.Yaml)
			if r.Name != "" {
				c.Set("_name", r.Name)
			}
			if r.FileName != "" {
				c.Set("_fileName", r.FileName)
			}
		} else {
			yamlContent = []byte(v)
		}
	}

	if len(yamlContent) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no yaml provided"})
	}

	name := c.FormValue("name")
	if name == "" {
		if v := c.Get("_name"); v != nil {
			name = v.(string)
		}
	}
	if name == "" {
		name = fmt.Sprintf("config-%d", timeNowUnix())
	}

	// try to associate with file by name if provided
	var fileID *uint = nil
	if fileName := c.FormValue("file_name"); fileName != "" {
		var f models.File
		if err := h.db.GormDB.Where("name = ?", fileName).First(&f).Error; err == nil {
			fileID = &f.ID
		}
	} else if v := c.Get("_fileName"); v != nil {
		if fileName, ok := v.(string); ok && fileName != "" {
			var f models.File
			if err := h.db.GormDB.Where("name = ?", fileName).First(&f).Error; err == nil {
				fileID = &f.ID
			}
		}
	}

	yc := models.YamlConfig{
		Name:   name,
		FileID: fileID,
		Yaml:   string(yamlContent),
	}

	if err := h.db.GormDB.Create(&yc).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db create yaml"})
	}

	return c.JSON(http.StatusCreated, map[string]any{"id": yc.ID, "name": yc.Name, "file_id": yc.FileID})
}

// ListYaml
func (h *Handler) ListYaml(c echo.Context) error {
	var configs []models.YamlConfig
	if err := h.db.GormDB.Order("created_at desc").Find(&configs).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db list yaml"})
	}
	return c.JSON(http.StatusOK, configs)
}

// ListBinaries
func (h *Handler) ListBinaries(c echo.Context) error {
	var files []models.File
	if err := h.db.GormDB.Order("created_at desc").Select("id, name, vendor, size, created_at, updated_at").Find(&files).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db list files"})
	}
	return c.JSON(http.StatusOK, files)
}

// GetBinaryByName: returns the binary file as attachment (supports HTTP Range requests for chunked loading)
func (h *Handler) GetBinaryByName(c echo.Context) error {
	fileName := c.Param("fileName")
	if fileName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing file name"})
	}
	var f models.File
	if err := h.db.GormDB.Where("name = ?", fileName).First(&f).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "file not found"})
	}

	// Support HTTP Range requests for chunked loading
	rangeHeader := c.Request().Header.Get("Range")
	if rangeHeader != "" {
		return h.handleRangeRequest(c, f.Data, rangeHeader, f.Name)
	}

	// stream the blob
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"%s\"", filepath.Base(f.Name)))
	c.Response().Header().Set(echo.HeaderContentType, "application/octet-stream")
	c.Response().Header().Set("Accept-Ranges", "bytes")
	return c.Blob(http.StatusOK, "application/octet-stream", f.Data)
}

// handleRangeRequest handles HTTP range requests for partial content
func (h *Handler) handleRangeRequest(c echo.Context, data []byte, rangeHeader string, fileName string) error {
	fileSize := int64(len(data))

	// Parse range header (format: "bytes=start-end")
	var start, end int64
	if _, err := fmt.Sscanf(rangeHeader, "bytes=%d-%d", &start, &end); err != nil {
		// Try format "bytes=start-"
		if _, err := fmt.Sscanf(rangeHeader, "bytes=%d-", &start); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid range header",
			})
		}
		end = fileSize - 1
	}

	// Validate range
	if start < 0 || start >= fileSize || end >= fileSize || start > end {
		c.Response().Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
		return c.NoContent(http.StatusRequestedRangeNotSatisfiable)
	}

	// Set headers for partial content
	contentLength := end - start + 1
	c.Response().Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	c.Response().Header().Set("Content-Length", fmt.Sprintf("%d", contentLength))
	c.Response().Header().Set("Accept-Ranges", "bytes")
	c.Response().Header().Set("Content-Type", "application/octet-stream")
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"%s\"", filepath.Base(fileName)))

	fmt.Printf("Range request: %s bytes %d-%d/%d (%d bytes)\n", fileName, start, end, fileSize, contentLength)

	// Send partial content
	return c.Blob(http.StatusPartialContent, "application/octet-stream", data[start:end+1])
}

// GetBinaryByID: helper
func (h *Handler) GetBinaryByID(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}
	var f models.File
	if err := h.db.GormDB.First(&f, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "file not found"})
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"%s\"", filepath.Base(f.Name)))
	c.Response().Header().Set(echo.HeaderContentType, "application/octet-stream")
	return c.Blob(http.StatusOK, "application/octet-stream", f.Data)
}

// GetYamlByName: return YAML text
func (h *Handler) GetYamlByName(c echo.Context) error {
	name := c.Param("configName")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing config name"})
	}
	var yc models.YamlConfig
	if err := h.db.GormDB.Where("name = ?", name).First(&yc).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "yaml config not found"})
	}
	return c.String(http.StatusOK, yc.Yaml)
}

// DeleteYamlConfig: delete YAML config by name
func (h *Handler) DeleteYamlConfig(c echo.Context) error {
	name := c.Param("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing config name"})
	}

	res := h.db.GormDB.Where("name = ?", name).Delete(&models.YamlConfig{})
	if res.Error != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": res.Error.Error()})
	}

	if res.RowsAffected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "config not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "yaml config deleted", "name": name})
}

// UpdateYamlConfig: update YAML config by name
func (h *Handler) UpdateYamlConfig(c echo.Context) error {
	name := c.Param("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing config name"})
	}

	// Parse request body
	type UpdateReq struct {
		Yaml     string `json:"yaml"`
		NewName  string `json:"new_name"`
		FileName string `json:"file_name"`
	}
	var req UpdateReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.Yaml == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "yaml content required"})
	}

	// Find existing config
	var yc models.YamlConfig
	if err := h.db.GormDB.Where("name = ?", name).First(&yc).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "config not found"})
	}

	// Update fields
	yc.Yaml = req.Yaml
	if req.NewName != "" && req.NewName != name {
		yc.Name = req.NewName
	}

	// Handle file association
	if req.FileName != "" {
		var f models.File
		if err := h.db.GormDB.Where("name = ?", req.FileName).First(&f).Error; err == nil {
			yc.FileID = &f.ID
		}
	}

	if err := h.db.GormDB.Save(&yc).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update config"})
	}

	return c.JSON(http.StatusOK, map[string]any{"id": yc.ID, "name": yc.Name, "file_id": yc.FileID})
}

// ParseCSV: parse CSV data and return processed samples
func (h *Handler) ParseCSV(c echo.Context) error {
	// Get CSV data from request body
	csvData, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to read request body"})
	}

	if len(csvData) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "empty CSV data"})
	}

	// Parse CSV content
	reader := csv.NewReader(strings.NewReader(string(csvData)))
	records, err := reader.ReadAll()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid CSV format: " + err.Error()})
	}

	if len(records) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "CSV file is empty"})
	}

	// Check if it's multi-lead format (Lead_0, Lead_1, etc.)
	if len(records) > 0 && len(records[0]) > 0 && strings.Contains(records[0][0], "Lead_") {
		return parseMultiLeadCSV(records, c)
	}

	// Check if it's timestamp,value format
	if len(records) > 0 && (strings.Contains(strings.ToLower(records[0][0]), "timestamp") ||
		(len(records[0]) >= 2 && strings.Contains(strings.ToLower(records[0][0]), "time"))) {
		return parseTimestampValueCSV(records, c)
	}

	// Default: treat as simple value columns
	return parseSimpleCSV(records, c)
}

// parseMultiLeadCSV handles multi-lead CSV data
func parseMultiLeadCSV(records [][]string, c echo.Context) error {
	if len(records) < 2 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "multi-lead CSV must have header and at least one data row"})
	}

	// Parse header to get lead names
	leadNames := make([]string, len(records[0]))
	for i, name := range records[0] {
		leadNames[i] = strings.TrimSpace(name)
	}

	// Initialize leads array
	leads := make([][]float64, len(leadNames))
	for i := range leads {
		leads[i] = make([]float64, 0, len(records)-1)
	}

	// Parse data lines
	for i := 1; i < len(records); i++ {
		if len(records[i]) != len(leadNames) {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("invalid multi-lead CSV format on line %d. Expected %d columns, got %d",
					i+1, len(leadNames), len(records[i])),
			})
		}

		for j, valueStr := range records[i] {
			value, err := strconv.ParseFloat(strings.TrimSpace(valueStr), 64)
			if err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": fmt.Sprintf("invalid value on line %d, column %s: \"%s\"", i+1, leadNames[j], valueStr),
				})
			}
			leads[j] = append(leads[j], value)
		}
	}

	// Check if we have any data
	if len(leads[0]) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no valid samples found in multi-lead CSV"})
	}

	// Create timestamps (0, 1, 2, ...) for multi-lead data
	timestamps := make([]float64, len(leads[0]))
	for i := range timestamps {
		timestamps[i] = float64(i)
	}

	// Return processed data
	response := map[string]interface{}{
		"type":       "multi-lead",
		"leadNames":  leadNames,
		"leads":      leads,
		"samples":    leads[0], // Default to first lead for backward compatibility
		"timestamps": timestamps,
		"count":      len(leads[0]),
	}

	return c.JSON(http.StatusOK, response)
}

// parseTimestampValueCSV handles timestamp,value CSV data
func parseTimestampValueCSV(records [][]string, c echo.Context) error {
	// Skip header if present
	startIdx := 0
	if len(records) > 0 && (strings.Contains(strings.ToLower(records[0][0]), "timestamp") ||
		strings.Contains(strings.ToLower(records[0][0]), "time")) {
		startIdx = 1
	}

	samples := make([]float64, 0, len(records)-startIdx)
	timestamps := make([]float64, 0, len(records)-startIdx)

	for i := startIdx; i < len(records); i++ {
		if len(records[i]) < 2 {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("invalid CSV format on line %d. Expected 2 columns, got %d", i+1, len(records[i])),
			})
		}

		timestamp, err := strconv.ParseFloat(strings.TrimSpace(records[i][0]), 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("invalid timestamp on line %d: \"%s\"", i+1, records[i][0]),
			})
		}

		value, err := strconv.ParseFloat(strings.TrimSpace(records[i][1]), 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("invalid value on line %d: \"%s\"", i+1, records[i][1]),
			})
		}

		timestamps = append(timestamps, timestamp)
		samples = append(samples, value)
	}

	if len(samples) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no valid samples found in CSV"})
	}

	response := map[string]interface{}{
		"type":       "timestamp-value",
		"samples":    samples,
		"timestamps": timestamps,
		"count":      len(samples),
	}

	return c.JSON(http.StatusOK, response)
}

// parseSimpleCSV handles simple CSV data (values only)
func parseSimpleCSV(records [][]string, c echo.Context) error {
	samples := make([]float64, 0, len(records))

	for i, row := range records {
		if len(row) == 0 {
			continue // Skip empty rows
		}

		// Take first column as sample value
		value, err := strconv.ParseFloat(strings.TrimSpace(row[0]), 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("invalid value on line %d: \"%s\"", i+1, row[0]),
			})
		}

		samples = append(samples, value)
	}

	if len(samples) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no valid samples found in CSV"})
	}

	response := map[string]interface{}{
		"type":    "simple",
		"samples": samples,
		"count":   len(samples),
	}

	return c.JSON(http.StatusOK, response)
}

// ConvertECGData: convert raw ECG data using Python script
func (h *Handler) ConvertECGData(c echo.Context) error {
	// Parse request body
	type ConvertReq struct {
		CSVData  string  `json:"csvData"`
		ADCBits  int     `json:"adcBits"`
		ADCRange float64 `json:"adcRange"`
	}
	var req ConvertReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.CSVData == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "csvData is required"})
	}

	// Set default values if not provided
	if req.ADCBits == 0 {
		req.ADCBits = 12
	}
	if req.ADCRange == 0 {
		req.ADCRange = 10.0
	}

	// Create temporary files
	inputFile := "/tmp/input_ecg.csv"
	outputFile := "/tmp/output_ecg.csv"

	// Write input CSV data to temporary file
	if err := os.WriteFile(inputFile, []byte(req.CSVData), 0644); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create input file"})
	}
	defer os.Remove(inputFile)
	defer os.Remove(outputFile)

	// Run Python conversion script using venv
	scriptPath := "python_tools/Conversion.py"

	// Try to detect the correct Python path (Docker vs local)
	venvPython := "/app/venv/bin/python3"
	localVenvPython := "python_tools/venv/bin/python3"

	// Check if local venv exists, use it if available
	if _, err := os.Stat(localVenvPython); err == nil {
		venvPython = localVenvPython
	}

	cmd := exec.Command(venvPython, scriptPath, inputFile, outputFile, "--adc_bits", strconv.Itoa(req.ADCBits), "--adc_range", fmt.Sprintf("%.1f", req.ADCRange))
	cmd.Dir = "." // Run from backend directory

	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":      "failed to run conversion script: " + err.Error(),
			"output":     string(output),
			"script":     scriptPath,
			"python":     venvPython,
			"inputFile":  inputFile,
			"outputFile": outputFile,
			"args":       []string{scriptPath, inputFile, outputFile, "--adc_bits", strconv.Itoa(req.ADCBits), "--adc_range", fmt.Sprintf("%.1f", req.ADCRange)},
		})
	}

	// Read the converted CSV data
	convertedData, err := os.ReadFile(outputFile)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read output file"})
	}

	// Parse the converted CSV to return structured data
	reader := csv.NewReader(strings.NewReader(string(convertedData)))
	records, err := reader.ReadAll()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to parse converted CSV: " + err.Error()})
	}

	// Check if it's multi-lead format
	if len(records) > 0 && len(records[0]) > 0 && strings.Contains(records[0][0], "Lead_") {
		return parseMultiLeadCSV(records, c)
	}

	// Check if it's timestamp,value format
	if len(records) > 0 && (strings.Contains(strings.ToLower(records[0][0]), "timestamp") ||
		(len(records[0]) >= 2 && strings.Contains(strings.ToLower(records[0][0]), "time"))) {
		return parseTimestampValueCSV(records, c)
	}

	// Default: treat as simple value columns
	return parseSimpleCSV(records, c)
}

// small helper to avoid importing time in this file
func timeNowUnix() int64 {
	return 0 // placeholder - replaced at build (we keep simple)
}
