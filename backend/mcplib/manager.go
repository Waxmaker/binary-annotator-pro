package mcplib

import (
	"context"
	"fmt"
	"sync"
)

// Manager manages multiple MCP server connections
type Manager struct {
	servers    map[string]*Server
	mu         sync.RWMutex
	clientName string
	clientVersion string
}

// NewManager creates a new MCP manager
func NewManager() *Manager {
	return &Manager{
		servers:       make(map[string]*Server),
		clientName:    "binary-annotator-pro",
		clientVersion: "1.0.0",
	}
}

// SetClientInfo sets the client name and version
func (m *Manager) SetClientInfo(name, version string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clientName = name
	m.clientVersion = version
}

// AddServer adds a server to the manager
func (m *Manager) AddServer(name, command string, args []string, env map[string]string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.servers[name] = NewServer(name, command, args, env)
}

// RemoveServer removes a server from the manager
func (m *Manager) RemoveServer(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	server, exists := m.servers[name]
	if !exists {
		return fmt.Errorf("server %s not found", name)
	}

	// Disconnect if connected
	if server.IsConnected() {
		if err := server.Disconnect(); err != nil {
			return fmt.Errorf("failed to disconnect server %s: %w", name, err)
		}
	}

	delete(m.servers, name)
	return nil
}

// GetServer returns a server by name
func (m *Manager) GetServer(name string) (*Server, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	server, exists := m.servers[name]
	if !exists {
		return nil, fmt.Errorf("server %s not found", name)
	}

	return server, nil
}

// ListServers returns all server names
func (m *Manager) ListServers() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	names := make([]string, 0, len(m.servers))
	for name := range m.servers {
		names = append(names, name)
	}
	return names
}

// ConnectedServersCount returns the number of connected servers
func (m *Manager) ConnectedServersCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := 0
	for _, server := range m.servers {
		if server.IsConnected() {
			count++
		}
	}
	return count
}

// ConnectAll connects to all servers
func (m *Manager) ConnectAll(ctx context.Context) error {
	m.mu.RLock()
	servers := make([]*Server, 0, len(m.servers))
	for _, server := range m.servers {
		servers = append(servers, server)
	}
	m.mu.RUnlock()

	// Connect to all servers in parallel
	var wg sync.WaitGroup
	errCh := make(chan error, len(servers))

	for _, server := range servers {
		wg.Add(1)
		go func(s *Server) {
			defer wg.Done()

			// Connect to server
			if err := s.Connect(ctx); err != nil {
				errCh <- fmt.Errorf("failed to connect to %s: %w", s.Name(), err)
				return
			}

			// Initialize server
			if err := s.Initialize(ctx, m.clientName, m.clientVersion); err != nil {
				errCh <- fmt.Errorf("failed to initialize %s: %w", s.Name(), err)
				return
			}

			// List tools
			if _, err := s.ListTools(ctx); err != nil {
				errCh <- fmt.Errorf("failed to list tools for %s: %w", s.Name(), err)
				return
			}
		}(server)
	}

	wg.Wait()
	close(errCh)

	// Check for errors
	var errors []error
	for err := range errCh {
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("errors connecting to servers: %v", errors)
	}

	return nil
}

// DisconnectAll disconnects from all servers
func (m *Manager) DisconnectAll() error {
	m.mu.RLock()
	servers := make([]*Server, 0, len(m.servers))
	for _, server := range m.servers {
		servers = append(servers, server)
	}
	m.mu.RUnlock()

	var errors []error
	for _, server := range servers {
		if err := server.Disconnect(); err != nil {
			errors = append(errors, fmt.Errorf("failed to disconnect %s: %w", server.Name(), err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("errors disconnecting from servers: %v", errors)
	}

	return nil
}

// ListAllTools returns all tools from all connected servers
func (m *Manager) ListAllTools(ctx context.Context) ([]ToolInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var allTools []ToolInfo
	for _, server := range m.servers {
		if !server.IsInitialized() {
			continue
		}

		tools := server.GetTools()
		for _, tool := range tools {
			allTools = append(allTools, ToolInfo{
				ServerName:  server.Name(),
				Tool:        tool,
			})
		}
	}

	return allTools, nil
}

// ToolsCount returns the total number of tools across all servers
func (m *Manager) ToolsCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := 0
	for _, server := range m.servers {
		if server.IsInitialized() {
			count += len(server.GetTools())
		}
	}
	return count
}

// CallTool calls a tool on a specific server
func (m *Manager) CallTool(ctx context.Context, serverName, toolName string, arguments map[string]interface{}) (*ToolCallResult, error) {
	server, err := m.GetServer(serverName)
	if err != nil {
		return nil, err
	}

	if !server.IsInitialized() {
		return nil, fmt.Errorf("server %s not initialized", serverName)
	}

	return server.CallTool(ctx, toolName, arguments)
}

// FindTool finds a tool by name across all servers
func (m *Manager) FindTool(toolName string) (*ToolInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, server := range m.servers {
		if !server.IsInitialized() {
			continue
		}

		tools := server.GetTools()
		for _, tool := range tools {
			if tool.Name == toolName {
				return &ToolInfo{
					ServerName: server.Name(),
					Tool:       tool,
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("tool %s not found", toolName)
}

// GetServerStatus returns status information for all servers
func (m *Manager) GetServerStatus() []ServerStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	statuses := make([]ServerStatus, 0, len(m.servers))
	for _, server := range m.servers {
		status := ServerStatus{
			Name:        server.Name(),
			Connected:   server.IsConnected(),
			Initialized: server.IsInitialized(),
			ToolsCount:  len(server.GetTools()),
		}

		if server.IsInitialized() {
			info := server.GetServerInfo()
			if info != nil {
				status.ServerInfo = *info
			}
		}

		statuses = append(statuses, status)
	}

	return statuses
}

// ToolInfo combines a tool with its server name
type ToolInfo struct {
	ServerName string
	Tool       Tool
}

// ServerStatus contains status information for a server
type ServerStatus struct {
	Name        string
	Connected   bool
	Initialized bool
	ToolsCount  int
	ServerInfo  ServerInfo
}
