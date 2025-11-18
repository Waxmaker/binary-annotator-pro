package handlers

import (
	"binary-annotator-pro/config"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

type SearchHandler struct {
	db *config.DB
}

func NewSearchHandler(db *config.DB) *SearchHandler {
	return &SearchHandler{db: db}
}

// SearchRequest represents a search request
type SearchRequest struct {
	FileName string `json:"file_name"`
	Value    string `json:"value"`
	Type     string `json:"type"` // hex, string-ascii, string-utf8, int8, uint8, int16le, etc.
}

// SearchResult represents a search result
type SearchResult struct {
	Offset int    `json:"offset"`
	Length int    `json:"length"`
	Value  string `json:"value,omitempty"`
}

// SearchResponse represents the search response
type SearchResponse struct {
	Matches []SearchResult `json:"matches"`
	Count   int            `json:"count"`
}

// Search performs a search based on type
func (sh *SearchHandler) Search(c echo.Context) error {
	var req SearchRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	// Read binary file
	data, err := sh.db.ReadBinaryFile(req.FileName)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "file not found"})
	}

	// Perform search based on type
	var results []SearchResult

	switch req.Type {
	case "hex":
		results, err = searchHex(data, req.Value)
	case "string-ascii":
		results, err = searchStringASCII(data, req.Value)
	case "string-utf8":
		results, err = searchStringUTF8(data, req.Value)
	case "int8":
		results, err = searchInt8(data, req.Value)
	case "uint8":
		results, err = searchUint8(data, req.Value)
	case "int16le":
		results, err = searchInt16LE(data, req.Value)
	case "int16be":
		results, err = searchInt16BE(data, req.Value)
	case "uint16le":
		results, err = searchUint16LE(data, req.Value)
	case "uint16be":
		results, err = searchUint16BE(data, req.Value)
	case "int32le":
		results, err = searchInt32LE(data, req.Value)
	case "int32be":
		results, err = searchInt32BE(data, req.Value)
	case "uint32le":
		results, err = searchUint32LE(data, req.Value)
	case "uint32be":
		results, err = searchUint32BE(data, req.Value)
	case "float32le":
		results, err = searchFloat32LE(data, req.Value)
	case "float32be":
		results, err = searchFloat32BE(data, req.Value)
	case "float64le":
		results, err = searchFloat64LE(data, req.Value)
	case "float64be":
		results, err = searchFloat64BE(data, req.Value)
	case "timestamp-unix32":
		results, err = searchTimestampUnix32(data, req.Value)
	case "timestamp-unix64":
		results, err = searchTimestampUnix64(data, req.Value)
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "unsupported search type"})
	}

	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, SearchResponse{
		Matches: results,
		Count:   len(results),
	})
}

// Search functions

func searchHex(data []byte, hexPattern string) ([]SearchResult, error) {
	// Remove spaces and convert to uppercase
	cleanHex := strings.ReplaceAll(hexPattern, " ", "")
	cleanHex = strings.ToUpper(cleanHex)

	// Decode hex string to bytes
	pattern, err := hex.DecodeString(cleanHex)
	if err != nil {
		return nil, fmt.Errorf("invalid hex pattern: %v", err)
	}

	var results []SearchResult
	patternLen := len(pattern)

	for i := 0; i <= len(data)-patternLen; i++ {
		match := true
		for j := 0; j < patternLen; j++ {
			if data[i+j] != pattern[j] {
				match = false
				break
			}
		}
		if match {
			results = append(results, SearchResult{
				Offset: i,
				Length: patternLen,
			})
		}
	}

	return results, nil
}

func searchStringASCII(data []byte, value string) ([]SearchResult, error) {
	pattern := []byte(value)
	var results []SearchResult
	patternLen := len(pattern)

	for i := 0; i <= len(data)-patternLen; i++ {
		match := true
		for j := 0; j < patternLen; j++ {
			if data[i+j] != pattern[j] {
				match = false
				break
			}
		}
		if match {
			results = append(results, SearchResult{
				Offset: i,
				Length: patternLen,
			})
		}
	}

	return results, nil
}

func searchStringUTF8(data []byte, value string) ([]SearchResult, error) {
	// UTF-8 is the same as ASCII for basic characters
	return searchStringASCII(data, value)
}

func searchInt8(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseInt(value, 10, 8)
	if err != nil {
		return nil, fmt.Errorf("invalid int8 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i < len(data); i++ {
		if int8(data[i]) == int8(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 1,
			})
		}
	}

	return results, nil
}

func searchUint8(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseUint(value, 10, 8)
	if err != nil {
		return nil, fmt.Errorf("invalid uint8 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i < len(data); i++ {
		if data[i] == uint8(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 1,
			})
		}
	}

	return results, nil
}

func searchInt16LE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseInt(value, 10, 16)
	if err != nil {
		return nil, fmt.Errorf("invalid int16 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-2; i++ {
		val := int16(binary.LittleEndian.Uint16(data[i:]))
		if val == int16(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 2,
			})
		}
	}

	return results, nil
}

func searchInt16BE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseInt(value, 10, 16)
	if err != nil {
		return nil, fmt.Errorf("invalid int16 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-2; i++ {
		val := int16(binary.BigEndian.Uint16(data[i:]))
		if val == int16(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 2,
			})
		}
	}

	return results, nil
}

func searchUint16LE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseUint(value, 10, 16)
	if err != nil {
		return nil, fmt.Errorf("invalid uint16 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-2; i++ {
		val := binary.LittleEndian.Uint16(data[i:])
		if val == uint16(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 2,
			})
		}
	}

	return results, nil
}

func searchUint16BE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseUint(value, 10, 16)
	if err != nil {
		return nil, fmt.Errorf("invalid uint16 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-2; i++ {
		val := binary.BigEndian.Uint16(data[i:])
		if val == uint16(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 2,
			})
		}
	}

	return results, nil
}

func searchInt32LE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseInt(value, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid int32 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-4; i++ {
		val := int32(binary.LittleEndian.Uint32(data[i:]))
		if val == int32(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 4,
			})
		}
	}

	return results, nil
}

func searchInt32BE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseInt(value, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid int32 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-4; i++ {
		val := int32(binary.BigEndian.Uint32(data[i:]))
		if val == int32(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 4,
			})
		}
	}

	return results, nil
}

func searchUint32LE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseUint(value, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid uint32 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-4; i++ {
		val := binary.LittleEndian.Uint32(data[i:])
		if val == uint32(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 4,
			})
		}
	}

	return results, nil
}

func searchUint32BE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseUint(value, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid uint32 value: %v", err)
	}

	var results []SearchResult
	for i := 0; i <= len(data)-4; i++ {
		val := binary.BigEndian.Uint32(data[i:])
		if val == uint32(target) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 4,
			})
		}
	}

	return results, nil
}

func searchFloat32LE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseFloat(value, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid float32 value: %v", err)
	}

	var results []SearchResult
	tolerance := float32(0.0001) // Small tolerance for float comparison

	for i := 0; i <= len(data)-4; i++ {
		bits := binary.LittleEndian.Uint32(data[i:])
		val := math.Float32frombits(bits)
		if math.Abs(float64(val-float32(target))) < float64(tolerance) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 4,
			})
		}
	}

	return results, nil
}

func searchFloat32BE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseFloat(value, 32)
	if err != nil {
		return nil, fmt.Errorf("invalid float32 value: %v", err)
	}

	var results []SearchResult
	tolerance := float32(0.0001)

	for i := 0; i <= len(data)-4; i++ {
		bits := binary.BigEndian.Uint32(data[i:])
		val := math.Float32frombits(bits)
		if math.Abs(float64(val-float32(target))) < float64(tolerance) {
			results = append(results, SearchResult{
				Offset: i,
				Length: 4,
			})
		}
	}

	return results, nil
}

func searchFloat64LE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid float64 value: %v", err)
	}

	var results []SearchResult
	tolerance := 0.0001

	for i := 0; i <= len(data)-8; i++ {
		bits := binary.LittleEndian.Uint64(data[i:])
		val := math.Float64frombits(bits)
		if math.Abs(val-target) < tolerance {
			results = append(results, SearchResult{
				Offset: i,
				Length: 8,
			})
		}
	}

	return results, nil
}

func searchFloat64BE(data []byte, value string) ([]SearchResult, error) {
	target, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid float64 value: %v", err)
	}

	var results []SearchResult
	tolerance := 0.0001

	for i := 0; i <= len(data)-8; i++ {
		bits := binary.BigEndian.Uint64(data[i:])
		val := math.Float64frombits(bits)
		if math.Abs(val-target) < tolerance {
			results = append(results, SearchResult{
				Offset: i,
				Length: 8,
			})
		}
	}

	return results, nil
}

func searchTimestampUnix32(data []byte, value string) ([]SearchResult, error) {
	// Parse the timestamp string (supports various formats)
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		// Try parsing as date only
		t, err = time.Parse("2006-01-02", value)
		if err != nil {
			return nil, fmt.Errorf("invalid timestamp format: %v", err)
		}
	}

	target := uint32(t.Unix())
	var results []SearchResult

	for i := 0; i <= len(data)-4; i++ {
		val := binary.LittleEndian.Uint32(data[i:])
		if val == target {
			results = append(results, SearchResult{
				Offset: i,
				Length: 4,
			})
		}
	}

	return results, nil
}

func searchTimestampUnix64(data []byte, value string) ([]SearchResult, error) {
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t, err = time.Parse("2006-01-02", value)
		if err != nil {
			return nil, fmt.Errorf("invalid timestamp format: %v", err)
		}
	}

	target := uint64(t.Unix())
	var results []SearchResult

	for i := 0; i <= len(data)-8; i++ {
		val := binary.LittleEndian.Uint64(data[i:])
		if val == target {
			results = append(results, SearchResult{
				Offset: i,
				Length: 8,
			})
		}
	}

	return results, nil
}
