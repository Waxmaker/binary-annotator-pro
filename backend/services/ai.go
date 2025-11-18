package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// AIProvider represents the AI service provider
type AIProvider string

const (
	ProviderOllama AIProvider = "ollama"
	ProviderOpenAI AIProvider = "openai"
	ProviderClaude AIProvider = "claude"
)

// AIRequest represents an AI generation request
type AIRequest struct {
	Provider      AIProvider `json:"provider"`
	Prompt        string     `json:"prompt"`
	Stream        bool       `json:"stream,omitempty"`
	FileAnalysis  *FileAnalysis `json:"file_analysis,omitempty"`
}

// FileAnalysis contains binary file analysis data
type FileAnalysis struct {
	FileName           string              `json:"file_name"`
	FileSize           int                 `json:"file_size"`
	FirstBytes         []byte              `json:"first_bytes"`
	Entropy            float64             `json:"entropy"`
	Patterns           []PatternInfo       `json:"patterns,omitempty"`
	PeriodicStructures []PeriodicStructure `json:"periodic_structures,omitempty"`
}

type PatternInfo struct {
	Offset      int    `json:"offset"`
	Bytes       []byte `json:"bytes"`
	Occurrences int    `json:"occurrences"`
}

type PeriodicStructure struct {
	Period     int     `json:"period"`
	Confidence float64 `json:"confidence"`
}

// AIResponse represents the AI response
type AIResponse struct {
	Success bool   `json:"success"`
	Data    string `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

// AIService handles AI provider interactions
type AIService struct {
	OllamaURL   string
	OllamaModel string
	OpenAIKey   string
	OpenAIModel string
	ClaudeKey   string
	ClaudeModel string
}

// NewAIService creates a new AI service from environment variables
func NewAIService() *AIService {
	return &AIService{
		OllamaURL:   getEnv("OLLAMA_URL", "http://localhost:11434"),
		OllamaModel: getEnv("OLLAMA_MODEL", "llama2"),
		OpenAIKey:   os.Getenv("OPENAI_API_KEY"),
		OpenAIModel: getEnv("OPENAI_MODEL", "gpt-4"),
		ClaudeKey:   os.Getenv("CLAUDE_API_KEY"),
		ClaudeModel: getEnv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Generate handles AI text generation
func (s *AIService) Generate(req AIRequest) (*AIResponse, error) {
	switch req.Provider {
	case ProviderOllama:
		return s.generateOllama(req.Prompt)
	case ProviderOpenAI:
		return s.generateOpenAI(req.Prompt)
	case ProviderClaude:
		return s.generateClaude(req.Prompt)
	default:
		return &AIResponse{Success: false, Error: "unknown provider"}, fmt.Errorf("unknown provider: %s", req.Provider)
	}
}

// generateOllama calls Ollama API
func (s *AIService) generateOllama(prompt string) (*AIResponse, error) {
	if s.OllamaURL == "" {
		return &AIResponse{Success: false, Error: "Ollama URL not configured"}, nil
	}

	reqBody := map[string]interface{}{
		"model":  s.OllamaModel,
		"prompt": prompt,
		"stream": false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return &AIResponse{Success: false, Error: "marshal request"}, err
	}

	resp, err := http.Post(s.OllamaURL+"/api/generate", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return &AIResponse{Success: false, Error: fmt.Sprintf("Ollama connection failed: %v", err)}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &AIResponse{Success: false, Error: fmt.Sprintf("Ollama error: %s", resp.Status)}, nil
	}

	var result struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return &AIResponse{Success: false, Error: "decode response"}, err
	}

	return &AIResponse{Success: true, Data: result.Response}, nil
}

// generateOpenAI calls OpenAI API
func (s *AIService) generateOpenAI(prompt string) (*AIResponse, error) {
	if s.OpenAIKey == "" {
		return &AIResponse{Success: false, Error: "OpenAI API key not configured"}, nil
	}

	reqBody := map[string]interface{}{
		"model": s.OpenAIModel,
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": "You are an expert in binary file analysis and reverse engineering. Provide concise, technical responses.",
			},
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": 0.3,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return &AIResponse{Success: false, Error: "marshal request"}, err
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return &AIResponse{Success: false, Error: "create request"}, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.OpenAIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &AIResponse{Success: false, Error: fmt.Sprintf("OpenAI request failed: %v", err)}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &AIResponse{Success: false, Error: fmt.Sprintf("OpenAI error: %s - %s", resp.Status, string(body))}, nil
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return &AIResponse{Success: false, Error: "decode response"}, err
	}

	if len(result.Choices) == 0 {
		return &AIResponse{Success: false, Error: "no response from OpenAI"}, nil
	}

	return &AIResponse{Success: true, Data: result.Choices[0].Message.Content}, nil
}

// generateClaude calls Claude API
func (s *AIService) generateClaude(prompt string) (*AIResponse, error) {
	if s.ClaudeKey == "" {
		return &AIResponse{Success: false, Error: "Claude API key not configured"}, nil
	}

	reqBody := map[string]interface{}{
		"model":      s.ClaudeModel,
		"max_tokens": 4096,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"system": "You are an expert in binary file analysis and reverse engineering. Provide concise, technical responses.",
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return &AIResponse{Success: false, Error: "marshal request"}, err
	}

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return &AIResponse{Success: false, Error: "create request"}, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.ClaudeKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &AIResponse{Success: false, Error: fmt.Sprintf("Claude request failed: %v", err)}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &AIResponse{Success: false, Error: fmt.Sprintf("Claude error: %s - %s", resp.Status, string(body))}, nil
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return &AIResponse{Success: false, Error: "decode response"}, err
	}

	if len(result.Content) == 0 {
		return &AIResponse{Success: false, Error: "no response from Claude"}, nil
	}

	return &AIResponse{Success: true, Data: result.Content[0].Text}, nil
}

// GenerateYAMLTags generates YAML tags from file analysis
func (s *AIService) GenerateYAMLTags(provider AIProvider, analysis *FileAnalysis) (*AIResponse, error) {
	if analysis == nil {
		return &AIResponse{Success: false, Error: "file analysis required"}, nil
	}

	prompt := s.buildYAMLPrompt(analysis)
	response, err := s.Generate(AIRequest{Provider: provider, Prompt: prompt})

	if err == nil && response.Success && response.Data != "" {
		// Clean markdown code blocks from response
		response.Data = cleanYAMLResponse(response.Data)
	}

	return response, err
}

// cleanYAMLResponse removes markdown code block markers
func cleanYAMLResponse(text string) string {
	text = strings.TrimSpace(text)

	// Remove opening code fence (```yaml or ```)
	if strings.HasPrefix(text, "```yaml") {
		text = strings.TrimPrefix(text, "```yaml")
		text = strings.TrimSpace(text)
	} else if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSpace(text)
	}

	// Remove closing code fence (```)
	if strings.HasSuffix(text, "```") {
		text = strings.TrimSuffix(text, "```")
		text = strings.TrimSpace(text)
	}

	return text
}

// buildYAMLPrompt constructs the prompt for YAML generation
func (s *AIService) buildYAMLPrompt(analysis *FileAnalysis) string {
	var sb strings.Builder

	// Convert first bytes to hex
	hexFirst := make([]string, 0, len(analysis.FirstBytes))
	for _, b := range analysis.FirstBytes {
		hexFirst = append(hexFirst, fmt.Sprintf("%02x", b))
	}

	sb.WriteString("You are an expert in binary file reverse engineering. Analyze this binary file and generate YAML tags for a hex viewer annotation system.\n\n")
	sb.WriteString("FILE INFORMATION:\n")
	sb.WriteString(fmt.Sprintf("- Name: %s\n", analysis.FileName))
	sb.WriteString(fmt.Sprintf("- Size: %d bytes (%.1f KB)\n", analysis.FileSize, float64(analysis.FileSize)/1024.0))
	sb.WriteString(fmt.Sprintf("- Entropy: %.3f bits\n", analysis.Entropy))

	if len(hexFirst) > 0 {
		sb.WriteString(fmt.Sprintf("- First %d bytes (hex): %s\n", len(hexFirst), strings.Join(hexFirst, " ")))
	}
	sb.WriteString("\n")

	// Patterns
	if len(analysis.Patterns) > 0 {
		sb.WriteString("DETECTED PATTERNS:\n")
		for i, p := range analysis.Patterns {
			if i >= 5 {
				break
			}
			hexPattern := make([]string, 0, len(p.Bytes))
			for j, b := range p.Bytes {
				if j >= 16 {
					break
				}
				hexPattern = append(hexPattern, fmt.Sprintf("%02x", b))
			}
			sb.WriteString(fmt.Sprintf("%d. At offset 0x%x: %s (%d occurrences)\n", i+1, p.Offset, strings.Join(hexPattern, " "), p.Occurrences))
		}
		sb.WriteString("\n")
	}

	// Periodic structures
	if len(analysis.PeriodicStructures) > 0 {
		sb.WriteString("PERIODIC STRUCTURES:\n")
		for i, ps := range analysis.PeriodicStructures {
			sb.WriteString(fmt.Sprintf("%d. Period: %d bytes (%.0f%% confidence)\n", i+1, ps.Period, ps.Confidence*100))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(`YOUR TASK:
Generate a complete YAML configuration for this binary file with TWO sections:
1. "search:" - Text/hex patterns to highlight throughout the file
2. "tags:" - Offset-based regions marking file structure sections

YAML FORMAT EXAMPLE:
` + "```yaml" + `
search:
  # Magic bytes / signatures
  magic_bytes:
    value: "DICM"
    color: "#FF6B6B"

  # Sync markers / delimiters
  sync_marker:
    value: "FF FF"
    color: "#4ECDC4"

  # Device identifiers (if found in first bytes)
  device_id:
    value: "NK"
    color: "#95E1D3"

tags:
  # File header
  file_header:
    offset: 0x0000
    size: 256
    color: "#95E1D3"
    # Contains: magic bytes, version, device info

  # Patient metadata
  patient_metadata:
    offset: 0x0100
    size: 512
    color: "#AA96DA"
    # Patient name, ID, DOB, acquisition params

  # Lead I ECG data (16-bit samples)
  lead_i_data:
    offset: 0x1000
    size: 10000
    color: "#FFD93D"
    # 5000 samples at 500 Hz = 10 seconds

  # Data checksum
  data_checksum:
    offset: 0x8530
    size: 4
    color: "#FF6B9D"
` + "```" + `

INSTRUCTIONS:

**For "search:" section:**
1. Look in the first bytes for recognizable patterns:
   - Magic bytes (file signatures like "DICM", "SCH", "NK", etc.)
   - Common delimiters (FF FF, 00 00, etc.)
   - ASCII device names or manufacturer IDs
2. Include 3-8 search patterns
3. Use descriptive names (magic_bytes, sync_marker, device_id, etc.)
4. Values can be:
   - ASCII text: "DICM"
   - Hex bytes (space-separated): "FF FF"
   - Hex bytes (no spaces): "FFFF"
5. Use varied colors for visual distinction

**For "tags:" section:**
1. Identify file structure sections:
   - Header (magic bytes, version, device info)
   - Metadata (patient info, acquisition parameters, timestamps)
   - Lead configuration (sample rate, gains, filters)
   - ECG data blocks (one per lead/channel)
   - Checksums/CRC sections
   - Padding (null bytes)
2. Use hex offsets (0x0000 format) and size in bytes
3. Add descriptive comments explaining each section
4. Use appropriate colors:
   - #95E1D3, #AA96DA, #FCBAD3 for headers/metadata
   - #FFD93D, #6BCF7F, #4D96FF for data channels
   - #FF6B9D for checksums
   - #6b7280 for padding
5. Make sure offsets are within file size (` + fmt.Sprintf("%d", analysis.FileSize) + ` bytes)
6. Tags should NOT overlap
7. Generate 5-15 meaningful tags

**Important:**
- Return ONLY the YAML code with both "search:" and "tags:" sections
- No explanations before or after
- Start with "search:" then "tags:"
- Use proper YAML indentation (2 spaces)
- Add helpful inline comments with #`)

	return sb.String()
}
