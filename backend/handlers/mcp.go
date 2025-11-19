package handlers

import (
	"binary-annotator-pro/services"
	"net/http"

	"github.com/labstack/echo/v4"
)

// MCPHandler handles MCP-related endpoints
type MCPHandler struct{}

// NewMCPHandler creates a new MCP handler
func NewMCPHandler() *MCPHandler {
	return &MCPHandler{}
}

// MCPStatusResponse represents the MCP status response
type MCPStatusResponse struct {
	ConnectedServers int                 `json:"connected_servers"`
	TotalTools       int                 `json:"total_tools"`
	Servers          []ServerStatusInfo  `json:"servers"`
}

// ServerStatusInfo contains information about a server
type ServerStatusInfo struct {
	Name        string `json:"name"`
	Connected   bool   `json:"connected"`
	Initialized bool   `json:"initialized"`
	ToolsCount  int    `json:"tools_count"`
	Version     string `json:"version,omitempty"`
}

// GetMCPStatus returns the current MCP connection status
func (mh *MCPHandler) GetMCPStatus(c echo.Context) error {
	mcpService := services.GetMCPService()

	statuses := mcpService.GetServerStatus()
	servers := make([]ServerStatusInfo, len(statuses))

	for i, status := range statuses {
		servers[i] = ServerStatusInfo{
			Name:        status.Name,
			Connected:   status.Connected,
			Initialized: status.Initialized,
			ToolsCount:  status.ToolsCount,
			Version:     status.ServerInfo.Version,
		}
	}

	response := MCPStatusResponse{
		ConnectedServers: mcpService.GetConnectedCount(),
		TotalTools:       mcpService.GetToolsCount(),
		Servers:          servers,
	}

	return c.JSON(http.StatusOK, response)
}
