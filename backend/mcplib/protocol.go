package mcplib

import "encoding/json"

// JSON-RPC 2.0 Protocol Implementation

// JSONRPCRequest represents a JSON-RPC 2.0 request
type JSONRPCRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response
type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

// RPCError represents a JSON-RPC 2.0 error
type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Initialize method parameters and result

// InitializeParams contains client information
type InitializeParams struct {
	ProtocolVersion string       `json:"protocolVersion"`
	Capabilities    Capabilities `json:"capabilities"`
	ClientInfo      ClientInfo   `json:"clientInfo"`
}

// Capabilities defines what the client supports
type Capabilities struct {
	Roots        *RootsCapability   `json:"roots,omitempty"`
	Sampling     *SamplingCapability `json:"sampling,omitempty"`
	Experimental map[string]interface{} `json:"experimental,omitempty"`
}

// RootsCapability indicates support for roots
type RootsCapability struct {
	ListChanged bool `json:"listChanged"`
}

// SamplingCapability indicates support for sampling
type SamplingCapability struct{}

// ClientInfo provides information about the client
type ClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// InitializeResult contains server capabilities and info
type InitializeResult struct {
	ProtocolVersion string           `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      ServerInfo       `json:"serverInfo"`
}

// ServerCapabilities defines what the server supports
type ServerCapabilities struct {
	Tools      *ToolsCapability      `json:"tools,omitempty"`
	Resources  *ResourcesCapability  `json:"resources,omitempty"`
	Prompts    *PromptsCapability    `json:"prompts,omitempty"`
	Logging    *LoggingCapability    `json:"logging,omitempty"`
}

// ToolsCapability indicates tool support
type ToolsCapability struct {
	ListChanged bool `json:"listChanged"`
}

// ResourcesCapability indicates resource support
type ResourcesCapability struct {
	Subscribe   bool `json:"subscribe"`
	ListChanged bool `json:"listChanged"`
}

// PromptsCapability indicates prompt support
type PromptsCapability struct {
	ListChanged bool `json:"listChanged"`
}

// LoggingCapability indicates logging support
type LoggingCapability struct{}

// ServerInfo provides information about the server
type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// Tools method parameters and result

// ToolsListParams is empty for now
type ToolsListParams struct{}

// ToolsListResult contains the list of available tools
type ToolsListResult struct {
	Tools []Tool `json:"tools"`
}

// Tool represents a tool exposed by the MCP server
type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"inputSchema"`
}

// InputSchema defines the tool's input parameters
type InputSchema struct {
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties,omitempty"`
	Required   []string               `json:"required,omitempty"`
}

// Tool call method parameters and result

// ToolCallParams contains the tool name and arguments
type ToolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

// ToolCallResult contains the tool execution result
type ToolCallResult struct {
	Content []ContentItem `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// ContentItem represents a piece of content in the result
type ContentItem struct {
	Type string `json:"type"` // "text", "image", "resource"
	Text string `json:"text,omitempty"`
	Data string `json:"data,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
}

// Helper functions to create requests

// NewInitializeRequest creates an initialize request
func NewInitializeRequest(id int, clientName, clientVersion string) *JSONRPCRequest {
	return &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  "initialize",
		Params: InitializeParams{
			ProtocolVersion: "2024-11-05",
			Capabilities: Capabilities{
				Roots: &RootsCapability{
					ListChanged: true,
				},
			},
			ClientInfo: ClientInfo{
				Name:    clientName,
				Version: clientVersion,
			},
		},
	}
}

// NewToolsListRequest creates a tools/list request
func NewToolsListRequest(id int) *JSONRPCRequest {
	return &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  "tools/list",
		Params:  ToolsListParams{},
	}
}

// NewToolCallRequest creates a tools/call request
func NewToolCallRequest(id int, toolName string, arguments map[string]interface{}) *JSONRPCRequest {
	return &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  "tools/call",
		Params: ToolCallParams{
			Name:      toolName,
			Arguments: arguments,
		},
	}
}

// ParseInitializeResult parses an initialize response
func ParseInitializeResult(response *JSONRPCResponse) (*InitializeResult, error) {
	data, err := json.Marshal(response.Result)
	if err != nil {
		return nil, err
	}

	var result InitializeResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ParseToolsListResult parses a tools/list response
func ParseToolsListResult(response *JSONRPCResponse) (*ToolsListResult, error) {
	data, err := json.Marshal(response.Result)
	if err != nil {
		return nil, err
	}

	var result ToolsListResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ParseToolCallResult parses a tools/call response
func ParseToolCallResult(response *JSONRPCResponse) (*ToolCallResult, error) {
	data, err := json.Marshal(response.Result)
	if err != nil {
		return nil, err
	}

	var result ToolCallResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return &result, nil
}
