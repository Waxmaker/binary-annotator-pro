# MCP Library

Custom MCP (Model Context Protocol) library for Binary Annotator Pro.

## MCP Protocol Overview

MCP uses JSON-RPC 2.0 over stdio to communicate between client and server:

```
Client (Go) <--stdin/stdout--> MCP Server (Python/Node/etc)
```

### Key Concepts

1. **Initialization**: Client sends `initialize` request with client info
2. **Tools Discovery**: Client calls `tools/list` to get available tools
3. **Tool Execution**: Client calls `tools/call` with tool name and arguments
4. **Resources**: Servers can expose resources (files, data sources, etc.)
5. **Prompts**: Servers can provide prompt templates

### Message Format

All messages follow JSON-RPC 2.0 format:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search_binary",
        "description": "Search for patterns in binary files",
        "inputSchema": {
          "type": "object",
          "properties": {
            "file_name": {"type": "string"},
            "pattern": {"type": "string"}
          }
        }
      }
    ]
  }
}
```

## Library Features

Our custom library provides:

- ✅ **Server Management**: Connect/disconnect MCP servers
- ✅ **Tool Discovery**: List all available tools from all servers
- ✅ **Tool Execution**: Call tools with type-safe parameters
- ✅ **Status Monitoring**: Track server health and connection status
- ✅ **Configuration**: Load servers from `~/.mcp.json`
- ✅ **Ollama Integration**: Use tools with Ollama function calling

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Library (Go)                      │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Server 1   │  │   Server 2   │  │   Server N   │  │
│  │   Manager    │  │   Manager    │  │   Manager    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │ stdin/stdout     │                  │
          ▼                  ▼                  ▼
    ┌──────────┐       ┌──────────┐      ┌──────────┐
    │  Python  │       │   Node   │      │   Go     │
    │   MCP    │       │   MCP    │      │   MCP    │
    │  Server  │       │  Server  │      │  Server  │
    └──────────┘       └──────────┘      └──────────┘
```

## Usage Example

```go
package main

import (
    "context"
    "fmt"
    "test/mcplib"
)

func main() {
    ctx := context.Background()

    // Create MCP manager
    manager := mcplib.NewManager()

    // Load servers from config
    err := manager.LoadFromConfig("~/.mcp.json")
    if err != nil {
        panic(err)
    }

    // Connect to all servers
    err = manager.ConnectAll(ctx)
    if err != nil {
        panic(err)
    }
    defer manager.DisconnectAll()

    // List all available tools
    tools, err := manager.ListAllTools(ctx)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Found %d tools:\n", len(tools))
    for _, tool := range tools {
        fmt.Printf("  - %s: %s\n", tool.Name, tool.Description)
    }

    // Call a tool
    result, err := manager.CallTool(ctx, "binary-annotator", "list_binary_files", nil)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Result: %v\n", result)
}
```

## Implementation Status

### Phase 1: Core Protocol ✅ COMPLETED
- [x] JSON-RPC 2.0 message format (`protocol.go`)
- [x] Process management (spawn MCP servers) (`server.go`)
- [x] stdio communication with pipes
- [x] Request/response matching

### Phase 2: Server Management ✅ COMPLETED
- [x] Config file parsing (`config.go`)
- [x] Multiple server connections (`manager.go`)
- [x] Server status tracking
- [x] Parallel connection/initialization

### Phase 3: Tool System ✅ COMPLETED
- [x] Tool discovery (list tools from servers)
- [x] Tool execution with arguments
- [x] Find tools across servers
- [x] Count tools and servers

### Phase 4: Ollama Integration (Next)
- [ ] Function calling bridge for Ollama
- [ ] Custom context injection
- [ ] Streaming support
- [ ] Conversation state management

## Library Features

### Core Components

1. **Protocol Layer** (`protocol.go`)
   - JSON-RPC 2.0 message structures
   - Initialize, ListTools, CallTool methods
   - Type-safe request/response parsing

2. **Server Management** (`server.go`)
   - Spawn MCP server as subprocess
   - Manage stdin/stdout pipes
   - Initialize and communicate with server
   - Cache server info and capabilities

3. **Manager** (`manager.go`)
   - Manage multiple MCP servers
   - Connect/disconnect all servers in parallel
   - List all tools across servers
   - Find and call tools
   - Get server status

4. **Configuration** (`config.go`)
   - Load from `~/.mcp.json`
   - Save configuration
   - Expand home directory paths

### Key Methods

**Manager:**
- `NewManager()` - Create new manager
- `LoadFromConfig(path)` - Load servers from config file
- `ConnectAll(ctx)` - Connect to all servers
- `DisconnectAll()` - Disconnect from all servers
- `ListServers()` - Get all server names
- `ConnectedServersCount()` - Count connected servers
- `ListAllTools(ctx)` - Get all tools from all servers
- `ToolsCount()` - Count total tools
- `CallTool(ctx, server, tool, args)` - Execute a tool
- `FindTool(name)` - Find a tool by name
- `GetServerStatus()` - Get status of all servers

**Server:**
- `Connect(ctx)` - Start server process
- `Disconnect()` - Stop server process
- `Initialize(ctx, client, version)` - Initialize MCP protocol
- `ListTools(ctx)` - Get available tools
- `CallTool(ctx, name, args)` - Execute a tool
- `IsConnected()` - Check connection status
- `IsInitialized()` - Check initialization status
