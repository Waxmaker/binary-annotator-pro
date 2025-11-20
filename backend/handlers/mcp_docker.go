package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
)

// MCPDockerHandler handles MCP Docker Manager operations
type MCPDockerHandler struct {
	managerURL string
}

// NewMCPDockerHandler creates a new MCP Docker Manager handler
func NewMCPDockerHandler() *MCPDockerHandler {
	managerURL := os.Getenv("MCP_MANAGER_URL")
	if managerURL == "" {
		managerURL = "http://localhost:8080"
	}
	return &MCPDockerHandler{
		managerURL: managerURL,
	}
}

// proxyRequest forwards a request to the MCP Docker Manager
func (h *MCPDockerHandler) proxyRequest(method, path string, body interface{}) (map[string]interface{}, error) {
	url := h.managerURL + path

	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resp.StatusCode >= 400 {
		if errMsg, ok := result["error"].(string); ok {
			return nil, fmt.Errorf("manager error: %s", errMsg)
		}
		return nil, fmt.Errorf("manager returned status %d", resp.StatusCode)
	}

	return result, nil
}

// ListMCPServers lists all running MCP servers
func (h *MCPDockerHandler) ListMCPServers(c echo.Context) error {
	url := h.managerURL + "/servers"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer resp.Body.Close()

	// Decode as array since /servers returns an array
	var servers []interface{}
	if err := json.NewDecoder(resp.Body).Decode(&servers); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, servers)
}

// StartMCPServer starts an MCP server
func (h *MCPDockerHandler) StartMCPServer(c echo.Context) error {
	serverName := c.Param("name")

	var req struct {
		Image string `json:"image"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	result, err := h.proxyRequest("POST", "/servers/"+serverName+"/start", req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, result)
}

// StopMCPServer stops an MCP server
func (h *MCPDockerHandler) StopMCPServer(c echo.Context) error {
	serverName := c.Param("name")

	result, err := h.proxyRequest("POST", "/servers/"+serverName+"/stop", nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, result)
}

// CallMCPTool calls a tool on an MCP server
func (h *MCPDockerHandler) CallMCPTool(c echo.Context) error {
	serverName := c.Param("name")

	var req struct {
		Tool      string                 `json:"tool"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	result, err := h.proxyRequest("POST", "/servers/"+serverName+"/call", req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, result)
}

// GetMCPManagerHealth checks the health of the MCP Docker Manager
func (h *MCPDockerHandler) GetMCPManagerHealth(c echo.Context) error {
	result, err := h.proxyRequest("GET", "/health", nil)
	if err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"status": "unavailable",
			"error":  err.Error(),
		})
	}
	return c.JSON(http.StatusOK, result)
}

// GetMCPDockerStats returns aggregated statistics about MCP servers
func (h *MCPDockerHandler) GetMCPDockerStats(c echo.Context) error {
	url := h.managerURL + "/servers"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":       err.Error(),
			"serverCount": 0,
			"totalTools":  0,
		})
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":       err.Error(),
			"serverCount": 0,
			"totalTools":  0,
		})
	}
	defer resp.Body.Close()

	var servers []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&servers); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":       err.Error(),
			"serverCount": 0,
			"totalTools":  0,
		})
	}

	// Count total tools across all servers
	totalTools := 0
	serverDetails := make([]map[string]interface{}, 0)

	for _, server := range servers {
		toolCount := 0
		if tools, ok := server["tools"].([]interface{}); ok {
			toolCount = len(tools)
		}
		totalTools += toolCount

		serverDetails = append(serverDetails, map[string]interface{}{
			"name":      server["name"],
			"image":     server["image"],
			"started":   server["started"],
			"toolCount": toolCount,
			"running":   true,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"serverCount": len(servers),
		"totalTools":  totalTools,
		"servers":     serverDetails,
		"managerUrl":  h.managerURL,
	})
}

// ToggleMCPDockerServer toggles a server on or off
func (h *MCPDockerHandler) ToggleMCPDockerServer(c echo.Context) error {
	serverName := c.Param("name")

	var req struct {
		Action string `json:"action"` // "start" or "stop"
		Image  string `json:"image"`  // required for start
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	if req.Action == "start" {
		if req.Image == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "image is required for start action"})
		}
		result, err := h.proxyRequest("POST", "/servers/"+serverName+"/start", map[string]string{"image": req.Image})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, result)
	} else if req.Action == "stop" {
		result, err := h.proxyRequest("POST", "/servers/"+serverName+"/stop", nil)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, result)
	}

	return c.JSON(http.StatusBadRequest, map[string]string{"error": "action must be 'start' or 'stop'"})
}
