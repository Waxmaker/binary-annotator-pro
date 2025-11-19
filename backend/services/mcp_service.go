package services

import (
	"binary-annotator-pro/mcplib"
	"context"
	"fmt"
	"log"
	"sync"
)

// MCPService manages MCP server connections
type MCPService struct {
	manager *mcplib.Manager
	mu      sync.RWMutex
	ctx     context.Context
}

var (
	mcpServiceInstance *MCPService
	mcpServiceOnce     sync.Once
)

// GetMCPService returns the singleton MCP service instance
func GetMCPService() *MCPService {
	mcpServiceOnce.Do(func() {
		mcpServiceInstance = &MCPService{
			manager: mcplib.NewManager(),
			ctx:     context.Background(),
		}
	})
	return mcpServiceInstance
}

// Initialize loads MCP servers from config and connects to them
func (s *MCPService) Initialize(configPath string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Set client info
	s.manager.SetClientInfo("binary-annotator-pro", "1.0.0")

	// Load servers from config
	log.Printf("Loading MCP servers from %s...", configPath)
	if err := s.manager.LoadFromConfig(configPath); err != nil {
		return fmt.Errorf("failed to load MCP config: %w", err)
	}

	servers := s.manager.ListServers()
	log.Printf("Loaded %d MCP server(s): %v", len(servers), servers)

	// Connect to all servers
	log.Println("Connecting to all MCP servers...")
	if err := s.manager.ConnectAll(s.ctx); err != nil {
		return fmt.Errorf("failed to connect to MCP servers: %w", err)
	}

	log.Printf("Successfully connected to %d MCP server(s)", s.manager.ConnectedServersCount())
	log.Printf("Total tools available: %d", s.manager.ToolsCount())

	return nil
}

// Shutdown disconnects from all MCP servers
func (s *MCPService) Shutdown() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Println("Shutting down MCP connections...")
	return s.manager.DisconnectAll()
}

// GetConnectedCount returns the number of connected MCP servers
func (s *MCPService) GetConnectedCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.manager.ConnectedServersCount()
}

// GetToolsCount returns the total number of available tools
func (s *MCPService) GetToolsCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.manager.ToolsCount()
}

// ListAllTools returns all available tools from all servers
func (s *MCPService) ListAllTools() ([]mcplib.ToolInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.manager.ListAllTools(s.ctx)
}

// CallTool calls a tool on a specific server
func (s *MCPService) CallTool(serverName, toolName string, arguments map[string]interface{}) (*mcplib.ToolCallResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.manager.CallTool(s.ctx, serverName, toolName, arguments)
}

// FindTool finds a tool by name across all servers
func (s *MCPService) FindTool(toolName string) (*mcplib.ToolInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.manager.FindTool(toolName)
}

// GetServerStatus returns status information for all servers
func (s *MCPService) GetServerStatus() []mcplib.ServerStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.manager.GetServerStatus()
}

// ListServers returns all server names
func (s *MCPService) ListServers() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.manager.ListServers()
}
