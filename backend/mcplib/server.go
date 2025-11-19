package mcplib

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"sync/atomic"
)

// Server represents a connection to an MCP server process
type Server struct {
	name    string
	command string
	args    []string
	env     map[string]string

	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	stderr io.ReadCloser

	scanner *bufio.Scanner
	mu      sync.Mutex
	nextID  atomic.Int32

	// Cached server info
	serverInfo   *ServerInfo
	capabilities *ServerCapabilities
	tools        []Tool
	initialized  bool
}

// NewServer creates a new MCP server instance
func NewServer(name, command string, args []string, env map[string]string) *Server {
	return &Server{
		name:    name,
		command: command,
		args:    args,
		env:     env,
	}
}

// Name returns the server name
func (s *Server) Name() string {
	return s.name
}

// IsConnected returns whether the server is connected
func (s *Server) IsConnected() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cmd != nil && s.cmd.Process != nil
}

// IsInitialized returns whether the server has been initialized
func (s *Server) IsInitialized() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.initialized
}

// Connect spawns the MCP server process and sets up stdio pipes
func (s *Server) Connect(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cmd != nil {
		return fmt.Errorf("server already connected")
	}

	// Create command with context
	s.cmd = exec.CommandContext(ctx, s.command, s.args...)

	// Add environment variables
	if len(s.env) > 0 {
		s.cmd.Env = make([]string, 0, len(s.env))
		for k, v := range s.env {
			s.cmd.Env = append(s.cmd.Env, fmt.Sprintf("%s=%s", k, v))
		}
	}

	// Set up stdin pipe
	stdin, err := s.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}
	s.stdin = stdin

	// Set up stdout pipe
	stdout, err := s.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	s.stdout = stdout

	// Set up stderr pipe
	stderr, err := s.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	s.stderr = stderr

	// Start the process
	if err := s.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start server process: %w", err)
	}

	// Create scanner for reading responses
	s.scanner = bufio.NewScanner(s.stdout)

	// Start goroutine to log stderr
	go s.logStderr()

	return nil
}

// Disconnect stops the MCP server process
func (s *Server) Disconnect() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	// Close stdin to signal the process to exit
	if s.stdin != nil {
		s.stdin.Close()
	}

	// Wait for process to exit
	if err := s.cmd.Wait(); err != nil {
		// Process may have already exited
		return fmt.Errorf("error waiting for process: %w", err)
	}

	s.cmd = nil
	s.stdin = nil
	s.stdout = nil
	s.stderr = nil
	s.scanner = nil
	s.initialized = false

	return nil
}

// Initialize sends the initialize request to the server
func (s *Server) Initialize(ctx context.Context, clientName, clientVersion string) error {
	if !s.IsConnected() {
		return fmt.Errorf("server not connected")
	}

	req := NewInitializeRequest(int(s.nextID.Add(1)), clientName, clientVersion)
	resp, err := s.sendRequest(req)
	if err != nil {
		return fmt.Errorf("initialize failed: %w", err)
	}

	if resp.Error != nil {
		return fmt.Errorf("initialize error: %s", resp.Error.Message)
	}

	result, err := ParseInitializeResult(resp)
	if err != nil {
		return fmt.Errorf("failed to parse initialize result: %w", err)
	}

	s.mu.Lock()
	s.serverInfo = &result.ServerInfo
	s.capabilities = &result.Capabilities
	s.initialized = true
	s.mu.Unlock()

	return nil
}

// ListTools retrieves the list of available tools from the server
func (s *Server) ListTools(ctx context.Context) ([]Tool, error) {
	if !s.IsInitialized() {
		return nil, fmt.Errorf("server not initialized")
	}

	req := NewToolsListRequest(int(s.nextID.Add(1)))
	resp, err := s.sendRequest(req)
	if err != nil {
		return nil, fmt.Errorf("list tools failed: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("list tools error: %s", resp.Error.Message)
	}

	result, err := ParseToolsListResult(resp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse tools list result: %w", err)
	}

	s.mu.Lock()
	s.tools = result.Tools
	s.mu.Unlock()

	return result.Tools, nil
}

// CallTool executes a tool on the server
func (s *Server) CallTool(ctx context.Context, toolName string, arguments map[string]interface{}) (*ToolCallResult, error) {
	if !s.IsInitialized() {
		return nil, fmt.Errorf("server not initialized")
	}

	req := NewToolCallRequest(int(s.nextID.Add(1)), toolName, arguments)
	resp, err := s.sendRequest(req)
	if err != nil {
		return nil, fmt.Errorf("call tool failed: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("call tool error: %s", resp.Error.Message)
	}

	result, err := ParseToolCallResult(resp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse tool call result: %w", err)
	}

	return result, nil
}

// GetServerInfo returns cached server information
func (s *Server) GetServerInfo() *ServerInfo {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.serverInfo
}

// GetCapabilities returns cached server capabilities
func (s *Server) GetCapabilities() *ServerCapabilities {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.capabilities
}

// GetTools returns cached tools list
func (s *Server) GetTools() []Tool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.tools
}

// sendRequest sends a request and waits for the response
func (s *Server) sendRequest(req *JSONRPCRequest) (*JSONRPCResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Serialize request
	data, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Send request to stdin
	if _, err := s.stdin.Write(append(data, '\n')); err != nil {
		return nil, fmt.Errorf("failed to write request: %w", err)
	}

	// Read response from stdout
	if !s.scanner.Scan() {
		if err := s.scanner.Err(); err != nil {
			return nil, fmt.Errorf("failed to read response: %w", err)
		}
		return nil, fmt.Errorf("no response received")
	}

	// Parse response
	var resp JSONRPCResponse
	if err := json.Unmarshal(s.scanner.Bytes(), &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Verify response ID matches request ID
	if resp.ID != req.ID {
		return nil, fmt.Errorf("response ID mismatch: expected %d, got %d", req.ID, resp.ID)
	}

	return &resp, nil
}

// logStderr logs stderr output from the server
func (s *Server) logStderr() {
	scanner := bufio.NewScanner(s.stderr)
	for scanner.Scan() {
		// For now, just ignore stderr
		// In production, you might want to log this
		_ = scanner.Text()
	}
}
