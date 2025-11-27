package services

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

// GeminiService handles chat operations with Google Gemini API
type GeminiService struct {
	APIKey string
}

// NewGeminiService creates a new Gemini service
func NewGeminiService(apiKey string) *GeminiService {
	return &GeminiService{
		APIKey: apiKey,
	}
}

// GeminiMessage represents a message in Gemini format
type GeminiMessage struct {
	Role  string              `json:"role"`  // "user" or "model"
	Parts []GeminiContentPart `json:"parts"`
}

// GeminiContentPart represents content in a message
type GeminiContentPart struct {
	Text string `json:"text"`
}

// GeminiRequest represents a request to Gemini API
type GeminiRequest struct {
	Contents []GeminiMessage `json:"contents"`
}

// GeminiResponse represents the Gemini API response
type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
			Role string `json:"role"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
}

// GeminiStreamResponse represents a single chunk in the stream
type GeminiStreamResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// ConvertToGeminiMessages converts ChatMessageReq to Gemini format
func ConvertToGeminiMessages(messages []ChatMessageReq) []GeminiMessage {
	var geminiMessages []GeminiMessage

	for _, msg := range messages {
		// Skip system messages - Gemini doesn't support them directly
		// We'll prepend system message to first user message instead
		if msg.Role == "system" {
			continue
		}

		role := msg.Role
		// Convert "assistant" to "model" for Gemini
		if role == "assistant" {
			role = "model"
		}
		// Convert "tool" to "user" for Gemini (tool results come back as user messages)
		if role == "tool" {
			role = "user"
		}

		geminiMessages = append(geminiMessages, GeminiMessage{
			Role: role,
			Parts: []GeminiContentPart{
				{Text: msg.Content},
			},
		})
	}

	// Prepend system message to first user message if exists
	var systemPrompt string
	for _, msg := range messages {
		if msg.Role == "system" {
			systemPrompt = msg.Content
			break
		}
	}

	if systemPrompt != "" && len(geminiMessages) > 0 {
		// Find first user message
		for i, msg := range geminiMessages {
			if msg.Role == "user" {
				geminiMessages[i].Parts[0].Text = systemPrompt + "\n\n" + msg.Parts[0].Text
				break
			}
		}
	}

	return geminiMessages
}

// StreamChatWithTools sends a chat request to Gemini and streams the response
func (g *GeminiService) StreamChatWithTools(model string, messages []ChatMessageReq, callback StreamCallbackWithTools) error {
	// Convert messages to Gemini format
	geminiMessages := ConvertToGeminiMessages(messages)

	req := GeminiRequest{
		Contents: geminiMessages,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	// Gemini streaming endpoint
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s",
		model, g.APIKey)

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gemini error: %s - %s", resp.Status, string(body))
	}

	log.Printf("Gemini responded with status %d, starting to read stream...", resp.StatusCode)

	// Read SSE stream
	scanner := bufio.NewScanner(resp.Body)
	lineNum := 0
	for scanner.Scan() {
		line := scanner.Text()
		lineNum++

		// SSE format: "data: {...}"
		if len(line) > 6 && line[:6] == "data: " {
			jsonData := line[6:]

			var streamResp GeminiStreamResponse
			if err := json.Unmarshal([]byte(jsonData), &streamResp); err != nil {
				log.Printf("Failed to parse Gemini stream line %d: %v", lineNum, err)
				continue
			}

			// Extract text from response
			if len(streamResp.Candidates) > 0 && len(streamResp.Candidates[0].Content.Parts) > 0 {
				text := streamResp.Candidates[0].Content.Parts[0].Text

				if text != "" {
					log.Printf("Received content chunk: %d chars", len(text))

					// Send to callback
					response := StreamResponse{
						Content:   text,
						ToolCalls: []ToolCall{}, // Gemini doesn't support tool calls in the same way
						Done:      false,
					}

					if err := callback(response); err != nil {
						return err
					}
				}
			}
		}
	}

	log.Printf("Finished reading Gemini stream. Total lines read: %d", lineNum)

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read stream: %w", err)
	}

	// Send done signal
	callback(StreamResponse{Done: true})

	return nil
}

// Chat sends a non-streaming chat request to Gemini
func (g *GeminiService) Chat(model string, messages []ChatMessageReq) (string, error) {
	// Convert messages to Gemini format
	geminiMessages := ConvertToGeminiMessages(messages)

	req := GeminiRequest{
		Contents: geminiMessages,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	// Gemini generate endpoint
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		model, g.APIKey)

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini error: %s - %s", resp.Status, string(body))
	}

	var result GeminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response from Gemini")
	}

	return result.Candidates[0].Content.Parts[0].Text, nil
}
