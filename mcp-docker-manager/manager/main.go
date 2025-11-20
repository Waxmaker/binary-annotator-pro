package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// Tool represents an MCP tool with full details
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// MCPServer represents a running MCP server container
type MCPServer struct {
	Name         string
	Image        string
	Started      time.Time
	cmd          *exec.Cmd
	stdin        io.WriteCloser
	stdout       io.ReadCloser
	stderr       io.ReadCloser
	Tools        []Tool
	mu           sync.Mutex
	responseChan chan string   // Channel for JSON-RPC responses
	stopChan     chan struct{} // Channel to stop the reader goroutine
}

// MCPManager manages multiple MCP server containers
type MCPManager struct {
	servers map[string]*MCPServer
	mu      sync.RWMutex
}

// NewMCPManager creates a new MCP manager
func NewMCPManager() (*MCPManager, error) {
	return &MCPManager{
		servers: make(map[string]*MCPServer),
	}, nil
}

// StartServer starts an MCP server container using docker run -i
func (m *MCPManager) StartServer(ctx context.Context, name, image string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if already running
	if _, exists := m.servers[name]; exists {
		return fmt.Errorf("server %s already running", name)
	}

	log.Printf("Starting MCP server: %s (image: %s)", name, image)

	// Use docker run -i (NOT -it) to keep stdin open without TTY
	// TTY (-t) causes immediate exit when no terminal is attached
	cmd := exec.Command("docker", "run", "--rm", "-i",
		"--name", fmt.Sprintf("mcp-%s", name),
		"--label", fmt.Sprintf("mcp-server=%s", name),
		"--label", "managed-by=mcp-docker-manager",
		image)

	// Get stdin pipe
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdin pipe: %w", err)
	}

	// Get stdout pipe
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	// Get stderr pipe
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	// Start the container
	log.Printf("[%s] Starting container with docker run -i (stdin open, no TTY)...", name)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start container: %w", err)
	}

	log.Printf("[%s] Container started successfully", name)

	// Create server instance
	server := &MCPServer{
		Name:         name,
		Image:        image,
		Started:      time.Now(),
		cmd:          cmd,
		stdin:        stdin,
		stdout:       stdout,
		stderr:       stderr,
		responseChan: make(chan string, 10),
		stopChan:     make(chan struct{}),
	}

	// Start goroutine to read stderr (startup messages)
	go server.readStderrLoop()

	// Start goroutine to read stdout and filter JSON responses
	log.Printf("[%s] Launching output reader goroutine...", name)
	go server.readOutputLoop()

	// Wait a bit for startup messages to pass
	time.Sleep(500 * time.Millisecond)

	// Initialize MCP server
	if err := server.Initialize(); err != nil {
		server.Stop()
		return fmt.Errorf("failed to initialize MCP server: %w", err)
	}

	// List available tools
	if err := server.ListTools(); err != nil {
		log.Printf("Warning: failed to list tools for %s: %v", name, err)
		// Don't fail startup if we can't list tools - server may still work
	}

	m.servers[name] = server
	log.Printf("MCP server %s started successfully with %d tools", name, len(server.Tools))

	return nil
}

// StopServer stops an MCP server container
func (m *MCPManager) StopServer(ctx context.Context, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	server, exists := m.servers[name]
	if !exists {
		return fmt.Errorf("server %s not running", name)
	}

	log.Printf("Stopping MCP server: %s", name)

	server.Stop()

	delete(m.servers, name)
	log.Printf("MCP server %s stopped", name)

	return nil
}

// Stop stops the MCP server process
func (s *MCPServer) Stop() {
	// Stop the reader goroutines
	close(s.stopChan)

	// Close stdin to signal the container to exit
	if s.stdin != nil {
		s.stdin.Close()
	}

	// Kill the process if it doesn't exit gracefully
	if s.cmd != nil && s.cmd.Process != nil {
		// Wait a bit for graceful shutdown
		done := make(chan error, 1)
		go func() {
			done <- s.cmd.Wait()
		}()

		select {
		case <-time.After(5 * time.Second):
			log.Printf("[%s] Forcing process termination", s.Name)
			s.cmd.Process.Kill()
		case <-done:
			log.Printf("[%s] Process exited gracefully", s.Name)
		}
	}
}

// CallTool calls an MCP tool on a server
func (m *MCPManager) CallTool(name, toolName string, arguments map[string]interface{}) (interface{}, error) {
	m.mu.RLock()
	server, exists := m.servers[name]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("server %s not running", name)
	}

	return server.CallTool(toolName, arguments)
}

// ListServers returns all running servers
func (m *MCPManager) ListServers() []map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(m.servers))
	for _, server := range m.servers {
		result = append(result, map[string]interface{}{
			"name":         server.Name,
			"container_id": server.Image,
			"image":        server.Image,
			"started":      server.Started,
			"tools":        server.Tools,
		})
	}

	return result
}

// readStderrLoop reads stderr for logging purposes
func (s *MCPServer) readStderrLoop() {
	scanner := bufio.NewScanner(s.stderr)
	for scanner.Scan() {
		line := scanner.Text()
		log.Printf("[%s] STDERR: %s", s.Name, line)
	}
}

// readOutputLoop reads from stdout continuously and sends JSON lines to responseChan
func (s *MCPServer) readOutputLoop() {
	log.Printf("[%s] Output reader goroutine started", s.Name)
	scanner := bufio.NewScanner(s.stdout)

	for scanner.Scan() {
		select {
		case <-s.stopChan:
			log.Printf("[%s] Stopping output reader", s.Name)
			return
		default:
			line := scanner.Text()

			// Skip empty lines
			if len(line) == 0 {
				continue
			}

			// Skip lines with control characters (binary data)
			hasControlChar := false
			for _, ch := range line {
				if ch < 32 && ch != '\t' && ch != '\n' && ch != '\r' {
					hasControlChar = true
					break
				}
			}
			if hasControlChar {
				log.Printf("[%s] Skipping line with control characters", s.Name)
				continue
			}

			log.Printf("[%s] Read line: %s", s.Name, line)

			// Try to parse as JSON to filter out non-JSON lines
			var jsonTest map[string]interface{}
			if err := json.Unmarshal([]byte(line), &jsonTest); err != nil {
				// Not JSON, skip (likely a startup message)
				log.Printf("[%s] Skipping non-JSON line: %s", s.Name, line)
				continue
			}

			// Valid JSON, send to response channel
			log.Printf("[%s] Sending JSON response to channel", s.Name)
			select {
			case s.responseChan <- line:
				// Sent successfully
			case <-time.After(5 * time.Second):
				log.Printf("[%s] Warning: response channel full, dropping message", s.Name)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("[%s] Scanner error: %v", s.Name, err)
	}
	log.Printf("[%s] Output stream closed", s.Name)
}

// Initialize sends the initialize request to the MCP server
func (s *MCPServer) Initialize() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Send initialize request
	req := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]string{
				"name":    "mcp-docker-manager",
				"version": "1.0.0",
			},
		},
	}

	// Write request
	reqBytes, _ := json.Marshal(req)
	log.Printf("[%s] Sending initialize request: %s", s.Name, string(reqBytes))
	if _, err := s.stdin.Write(append(reqBytes, '\n')); err != nil {
		log.Printf("[%s] Failed to write initialize request: %v", s.Name, err)
		return err
	}

	// Wait for response from channel (goroutine filters out non-JSON)
	log.Printf("[%s] Waiting for initialize response from channel...", s.Name)
	var responseStr string
	select {
	case responseStr = <-s.responseChan:
		log.Printf("[%s] Received response from channel (%d bytes): %s", s.Name, len(responseStr), responseStr)
	case <-time.After(10 * time.Second):
		log.Printf("[%s] Timeout waiting for initialize response", s.Name)
		return fmt.Errorf("timeout waiting for initialize response")
	}

	// Parse the JSON response
	log.Printf("[%s] Attempting to unmarshal JSON response", s.Name)
	var resp map[string]interface{}
	if err := json.Unmarshal([]byte(responseStr), &resp); err != nil {
		log.Printf("[%s] Failed to unmarshal response: %v, response was: %q", s.Name, err, responseStr)
		// Print hex dump for debugging
		for i, b := range []byte(responseStr) {
			if i < 50 { // Only first 50 bytes
				log.Printf("[%s] Byte %d: 0x%02x (%c)", s.Name, i, b, b)
			}
		}
		return err
	}

	log.Printf("[%s] Successfully parsed initialize response: %+v", s.Name, resp)

	return nil
}

// ListTools retrieves the list of available tools from the MCP server
func (s *MCPServer) ListTools() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Send tools/list request
	req := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
		"params":  map[string]interface{}{},
	}

	// Write request
	reqBytes, _ := json.Marshal(req)
	log.Printf("[%s] Sending tools/list request: %s", s.Name, string(reqBytes))
	if _, err := s.stdin.Write(append(reqBytes, '\n')); err != nil {
		log.Printf("[%s] Failed to write tools/list request: %v", s.Name, err)
		return err
	}

	// Wait for response from channel
	log.Printf("[%s] Waiting for tools/list response from channel...", s.Name)
	var responseStr string
	select {
	case responseStr = <-s.responseChan:
		log.Printf("[%s] Received tools/list response (%d bytes): %s", s.Name, len(responseStr), responseStr)
	case <-time.After(10 * time.Second):
		log.Printf("[%s] Timeout waiting for tools/list response", s.Name)
		return fmt.Errorf("timeout waiting for tools/list response")
	}

	// Parse the JSON response
	var resp map[string]interface{}
	if err := json.Unmarshal([]byte(responseStr), &resp); err != nil {
		log.Printf("[%s] Failed to unmarshal tools/list response: %v", s.Name, err)
		return err
	}

	log.Printf("[%s] Successfully parsed tools/list response", s.Name)

	// Extract tools list from result.tools array
	if result, ok := resp["result"].(map[string]interface{}); ok {
		if tools, ok := result["tools"].([]interface{}); ok {
			s.Tools = make([]Tool, 0, len(tools))
			for _, toolData := range tools {
				if t, ok := toolData.(map[string]interface{}); ok {
					tool := Tool{
						Name:        getString(t, "name"),
						Description: getString(t, "description"),
						InputSchema: getMap(t, "inputSchema"),
					}
					s.Tools = append(s.Tools, tool)
				}
			}
			toolNames := make([]string, len(s.Tools))
			for i, t := range s.Tools {
				toolNames[i] = t.Name
			}
			log.Printf("[%s] Found %d tools: %v", s.Name, len(s.Tools), toolNames)
		}
	}

	return nil
}

// CallTool executes a tool on the MCP server
func (s *MCPServer) CallTool(toolName string, arguments map[string]interface{}) (interface{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Send tool call request
	req := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      time.Now().UnixNano(),
		"method":  "tools/call",
		"params": map[string]interface{}{
			"name":      toolName,
			"arguments": arguments,
		},
	}

	// Write request
	reqBytes, _ := json.Marshal(req)
	log.Printf("[%s] Calling tool %s: %s", s.Name, toolName, string(reqBytes))
	if _, err := s.stdin.Write(append(reqBytes, '\n')); err != nil {
		return nil, err
	}

	// Wait for response from channel
	var responseStr string
	select {
	case responseStr = <-s.responseChan:
		log.Printf("[%s] Received tool response from channel", s.Name)
	case <-time.After(30 * time.Second):
		return nil, fmt.Errorf("timeout waiting for tool response")
	}

	// Parse response
	var resp map[string]interface{}
	if err := json.Unmarshal([]byte(responseStr), &resp); err != nil {
		return nil, err
	}

	// Check for error
	if errObj, ok := resp["error"]; ok {
		return nil, fmt.Errorf("MCP error: %v", errObj)
	}

	return resp["result"], nil
}

// Helper functions to safely extract values from maps
func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func getMap(m map[string]interface{}, key string) map[string]interface{} {
	if val, ok := m[key].(map[string]interface{}); ok {
		return val
	}
	return make(map[string]interface{})
}

func main() {
	// Create manager
	manager, err := NewMCPManager()
	if err != nil {
		log.Fatalf("Failed to create MCP manager: %v", err)
	}

	// Setup Echo
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// List servers
	e.GET("/servers", func(c echo.Context) error {
		return c.JSON(http.StatusOK, manager.ListServers())
	})

	// Start server
	e.POST("/servers/:name/start", func(c echo.Context) error {
		name := c.Param("name")
		var req struct {
			Image string `json:"image"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
		}

		if err := manager.StartServer(c.Request().Context(), name, req.Image); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, map[string]string{"message": "server started", "name": name})
	})

	// Stop server
	e.POST("/servers/:name/stop", func(c echo.Context) error {
		name := c.Param("name")
		if err := manager.StopServer(c.Request().Context(), name); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, map[string]string{"message": "server stopped", "name": name})
	})

	// Call tool
	e.POST("/servers/:name/call", func(c echo.Context) error {
		name := c.Param("name")
		var req struct {
			Tool      string                 `json:"tool"`
			Arguments map[string]interface{} `json:"arguments"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
		}

		result, err := manager.CallTool(name, req.Tool, req.Arguments)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, map[string]interface{}{"result": result})
	})

	log.Println("MCP Docker Manager starting on :8080")
	if err := e.Start(":8080"); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
