package mcplib

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Config represents the MCP configuration file structure
type Config struct {
	MCPServers map[string]ServerConfig `json:"mcpServers"`
}

// ServerConfig represents a single server configuration
type ServerConfig struct {
	Command string            `json:"command"`
	Args    []string          `json:"args"`
	Env     map[string]string `json:"env,omitempty"`
}

// LoadConfig loads the MCP configuration from a file
func LoadConfig(path string) (*Config, error) {
	// Expand ~ to home directory
	if strings.HasPrefix(path, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home directory: %w", err)
		}
		path = filepath.Join(home, path[1:])
	}

	// Read config file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Parse JSON
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// LoadFromConfig loads servers from a configuration file into the manager
func (m *Manager) LoadFromConfig(path string) error {
	config, err := LoadConfig(path)
	if err != nil {
		return err
	}

	for name, serverConfig := range config.MCPServers {
		m.AddServer(name, serverConfig.Command, serverConfig.Args, serverConfig.Env)
	}

	return nil
}

// SaveConfig saves the current manager configuration to a file
func (m *Manager) SaveConfig(path string) error {
	// Expand ~ to home directory
	if strings.HasPrefix(path, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("failed to get home directory: %w", err)
		}
		path = filepath.Join(home, path[1:])
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	// Build config structure
	config := Config{
		MCPServers: make(map[string]ServerConfig),
	}

	for name, server := range m.servers {
		config.MCPServers[name] = ServerConfig{
			Command: server.command,
			Args:    server.args,
			Env:     server.env,
		}
	}

	// Marshal to JSON with indentation
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write to file
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}
