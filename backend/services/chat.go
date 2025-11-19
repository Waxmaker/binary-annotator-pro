package services

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// ChatMessage represents a message in the conversation
type ChatMessageReq struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest represents a chat request
type ChatRequest struct {
	Model    string           `json:"model"`
	Messages []ChatMessageReq `json:"messages"`
	Stream   bool             `json:"stream"`
	Tools    []Tool           `json:"tools,omitempty"`
}

// Tool represents an MCP tool that can be called
type Tool struct {
	Type     string       `json:"type"`
	Function FunctionDef  `json:"function"`
}

// FunctionDef defines a function tool
type FunctionDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// StreamCallback is called for each chunk of streaming response
type StreamCallback func(chunk string) error

// ChatService handles chat operations with Ollama
type ChatService struct {
	OllamaURL string
}

// NewChatService creates a new chat service
func NewChatService(ollamaURL string) *ChatService {
	return &ChatService{
		OllamaURL: ollamaURL,
	}
}

// ToolCall represents a tool call from the model
type ToolCall struct {
	Function struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	} `json:"function"`
}

// StreamResponse contains the streaming response with potential tool calls
type StreamResponse struct {
	Content   string
	ToolCalls []ToolCall
	Done      bool
}

// StreamCallbackWithTools is called for each chunk of streaming response
type StreamCallbackWithTools func(resp StreamResponse) error

// StreamChatWithTools sends a chat request and streams the response, handling tool calls
func (s *ChatService) StreamChatWithTools(req ChatRequest, callback StreamCallbackWithTools) error {
	req.Stream = true

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.OllamaURL+"/api/chat", bytes.NewBuffer(jsonData))
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
		return fmt.Errorf("ollama error: %s - %s", resp.Status, string(body))
	}

	// Read streaming response line by line
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var streamResp struct {
			Model     string `json:"model"`
			CreatedAt string `json:"created_at"`
			Message   struct {
				Role      string     `json:"role"`
				Content   string     `json:"content"`
				ToolCalls []ToolCall `json:"tool_calls,omitempty"`
			} `json:"message"`
			Done bool `json:"done"`
		}

		if err := json.Unmarshal([]byte(line), &streamResp); err != nil {
			continue // Skip malformed lines
		}

		// Build response
		response := StreamResponse{
			Content:   streamResp.Message.Content,
			ToolCalls: streamResp.Message.ToolCalls,
			Done:      streamResp.Done,
		}

		// Send to callback
		if err := callback(response); err != nil {
			return err
		}

		if streamResp.Done {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read stream: %w", err)
	}

	return nil
}

// StreamChat sends a chat request and streams the response
func (s *ChatService) StreamChat(req ChatRequest, callback StreamCallback) error {
	req.Stream = true

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.OllamaURL+"/api/chat", bytes.NewBuffer(jsonData))
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
		return fmt.Errorf("ollama error: %s - %s", resp.Status, string(body))
	}

	// Read streaming response line by line
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var streamResp struct {
			Model     string `json:"model"`
			CreatedAt string `json:"created_at"`
			Message   struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"message"`
			Done bool `json:"done"`
		}

		if err := json.Unmarshal([]byte(line), &streamResp); err != nil {
			continue // Skip malformed lines
		}

		// Send chunk to callback
		if streamResp.Message.Content != "" {
			if err := callback(streamResp.Message.Content); err != nil {
				return err
			}
		}

		if streamResp.Done {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read stream: %w", err)
	}

	return nil
}

// Chat sends a non-streaming chat request
func (s *ChatService) Chat(req ChatRequest) (string, error) {
	req.Stream = false

	jsonData, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.OllamaURL+"/api/chat", bytes.NewBuffer(jsonData))
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
		return "", fmt.Errorf("ollama error: %s - %s", resp.Status, string(body))
	}

	var result struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return result.Message.Content, nil
}

// GenerateTitle generates a title from the first message
func (s *ChatService) GenerateTitle(firstMessage string) string {
	// Simple title generation - take first 50 chars or first sentence
	title := strings.TrimSpace(firstMessage)
	if len(title) > 50 {
		title = title[:50] + "..."
	}
	// Remove newlines
	title = strings.ReplaceAll(title, "\n", " ")
	return title
}
