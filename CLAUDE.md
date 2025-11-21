# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Binary Annotator Pro is a comprehensive ECG binary file analysis and annotation tool with AI-powered chat capabilities and MCP (Model Context Protocol) integration. The system enables reverse engineering of proprietary binary file formats through visual analysis, pattern matching, and AI assistance.

**Technology Stack:**
- **Backend:** Go 1.25.1 + Echo v4 + GORM + SQLite
- **Frontend:** React 18 + TypeScript + Vite + shadcn-ui + Tailwind CSS
- **MCP Server:** Python (stdio-based Model Context Protocol server)
- **Deployment:** Docker Compose with Ollama integration

## Development Commands

### Full Stack Development

```bash
# From project root using Makefile
make install              # Install all dependencies (frontend + backend)
make frontend-dev         # Start frontend dev server (localhost:5173)
make backend-dev          # Start backend dev server (localhost:3000)
make build               # Build both frontend and backend
make test                # Run all tests
make lint                # Lint both frontend and backend
make clean               # Clean build artifacts

# Check dependencies and status
make check-deps          # Verify all required tools are installed
make status              # Show status of all services and ports
```

### Backend Development

```bash
cd backend
go run main.go           # Run development server on :3000
go build -o bin/binary-annotator-pro .   # Build production binary
go test ./...            # Run tests
go mod tidy              # Clean up dependencies
```

### Frontend Development

```bash
cd frontend
yarn install             # Install dependencies
yarn run dev             # Dev server on localhost:5173
yarn run build           # Production build
yarn run build:dev       # Development build
yarn run lint            # ESLint check
yarn run preview         # Preview production build
```

### Docker Deployment

```bash
# Complete Docker setup
make docker-setup        # Setup environment files + build images
make docker-up           # Start all services
make docker-down         # Stop all services
make docker-logs         # View all logs
make docker-health       # Check health of all services

# Individual service logs
make docker-logs-backend
make docker-logs-frontend

# Database operations
make db-backup           # Backup Docker database
make db-restore DB=path  # Restore from backup
make db-docker-reset     # Reset database (destroys data!)

# MCP configuration
make mcp-check           # Verify MCP configuration
```

## Architecture

### System Overview

The application follows a three-tier architecture with MCP integration:

```
Frontend (React/Vite) :5173 or :8080
    ↓ REST API
Backend (Go/Echo) :3000
    ↓ SQLite + MCP Service
Data Layer (SQLite BLOB storage + MCP Servers)
    ↓ External
Ollama (LLM) :11434
```

### Backend Architecture

**Entry Point (`main.go`):**
- Initializes SQLite database with GORM auto-migration
- Loads MCP server configuration from `~/.mcp.json`
- Initializes MCP Service for connecting to external MCP servers
- Configures Echo with CORS, Logger, Recover middleware
- Registers all routes via `router.RegisterRoutes()`

**Key Packages:**
- `config/`: Database initialization and connection management
- `models/`: GORM models (File, YamlConfig, Tag, ChatSession, ChatMessage, AISettings)
- `handlers/`: HTTP request handlers for all endpoints
- `router/`: Route registration
- `services/`: Business logic (AI integration, MCP service, chat)
- `middleware/`: Auth middleware for JWT-based authentication
- `mcplib/`: MCP client library for stdio communication

**Data Storage:**
All binary files are stored as BLOBs in SQLite, not the filesystem. The database is located at `./data/ecg_data.db` by default (configurable via `DATABASE_PATH` env var).

### Frontend Architecture

**Routes (`App.tsx`):**
- `/login` - User authentication
- `/` - Main analysis interface (Index.tsx)
- `/ecg-viewer` - ECG signal viewer
- `/chat` - AI-powered chat interface
- `/documentation` - User documentation

**Key Features:**
- **Hex Viewer:** Multi-mode visualization (hex, ASCII, binary) with selection and annotation
- **YAML Editor:** Configure binary parsing rules with syntax highlighting
- **Pattern Search:** Find patterns using multiple data types (hex, strings, integers, floats, timestamps)
- **Advanced Visualizations:** Entropy graphs, byte histograms, bitmap views, digram analysis
- **Binary Diff:** Compare multiple binary files side-by-side
- **AI Chat:** WebSocket-based chat with context about binary files
- **MCP Settings:** Enable/disable MCP servers dynamically

**State Management:**
- React Query (`@tanstack/react-query`) for API calls and caching
- Custom hooks for hex selection, file operations, and settings

### MCP Integration

**Two MCP Components:**

1. **Binary Annotator MCP Server** (`backend/mcp-server/`)
   - Python-based MCP server exposing 17 tools for binary analysis
   - Tools: `list_binary_files`, `read_binary_bytes`, `search_pattern`, `get_file_info`, `analyze_structure`, etc.
   - Communicates with backend API via HTTP
   - Configured in Claude Desktop via `~/.mcp.json`

2. **MCP Docker Manager** (`mcp-docker-manager/`)
   - Go-based manager for running MCP servers in Docker containers
   - Solves stdio communication challenges via Docker attach API
   - REST API for starting/stopping MCP servers dynamically
   - Supports multiple MCP server images

**MCP Configuration:**
The backend loads MCP servers from `~/.mcp.json` at startup. Servers can be enabled/disabled via the Settings UI, which persists state to `backend/mcp_servers_config.json`.

### API Endpoints

**Binary Files:**
- `POST /upload/binary` - Upload binary file (multipart)
- `GET /get/list/binary` - List all binary files (excludes BLOB data)
- `GET /get/binary/:fileName` - Download by name
- `GET /get/binary-by-id/:id` - Download by ID
- `DELETE /delete/binary/:name` - Delete file
- `PUT /rename/binary/:name` - Rename file

**YAML Configurations:**
- `POST /upload/yaml` - Upload YAML (multipart/form/JSON)
- `GET /get/list/yaml` - List all configs
- `GET /get/yaml/:configName` - Get config by name
- `DELETE /delete/yaml/:name` - Delete config
- `PUT /update/yaml/:name` - Update config

**Search:**
- `POST /search` - Pattern search in binary files (supports 15+ data types)

**AI & Chat:**
- `POST /ai/settings/:userId` - Save AI provider settings (Ollama/OpenAI/Claude)
- `GET /ai/settings/:userId` - Get AI settings
- `POST /ai/test/:userId` - Test AI connection
- `GET /ws/chat` - WebSocket for AI chat with streaming responses
- `GET /chat/sessions/:userId` - Get chat history
- `DELETE /chat/session/:sessionId` - Delete chat session

**MCP:**
- `GET /mcp/status` - Get MCP service status
- `GET /mcp/servers/config` - Get server enable/disable states
- `PUT /mcp/servers/:name/toggle` - Enable/disable MCP server

**Auth:**
- `POST /auth/register` - Register user
- `POST /auth/login` - Login (returns JWT)
- `GET /auth/me` - Get current user (requires JWT)

### Database Models

**Core Models:**
- `File`: Binary files with BLOB data, vendor info, size (name is unique indexed)
- `YamlConfig`: Parsing configurations, optionally linked to a File
- `Tag`: Manual/YAML/detected annotations (offset, size, color, type, comment)
- `SearchResult`: Pattern matching results from search operations
- `Note`: Text annotations at specific file offsets
- `ExtractedBlock`: Extracted binary segments (e.g., ECG lead samples)

**User & Chat Models:**
- `AISettings`: Per-user AI provider configuration (Ollama/OpenAI/Claude URLs and keys)
- `ChatSession`: Chat conversations with auto-generated titles
- `ChatMessage`: Individual messages with role (user/assistant/system/tool) and optional tool calls

**Relationships:**
- `ChatSession.Messages` → One-to-many with `ChatMessage`
- `YamlConfig.FileID` → Optional foreign key to `File`
- All models use soft deletes (`gorm.DeletedAt`) except where explicitly excluded

## Important Patterns

### Upload Flexibility Pattern

The YAML upload endpoint demonstrates multi-source input handling:
```go
// Accepts: multipart file, form value "yaml", or JSON body
// Uses Echo context for internal state passing
```

### WebSocket Streaming Pattern

AI chat uses WebSocket with JSON message protocol:
```typescript
// Frontend sends: {type: "message", content: "...", context: {...}}
// Backend streams: {type: "chunk", content: "..."} or {type: "tool_call", ...}
```

### MCP Service Pattern

The MCP service is a singleton (`services.GetMCPService()`) that:
1. Initializes MCP servers from `~/.mcp.json`
2. Maintains persistent stdio connections to Python/Node MCP servers
3. Provides tool discovery and execution
4. Handles graceful shutdown

### Error Handling

- JSON error responses: `{"error": "message"}`
- HTTP status codes: 400 (bad request), 404 (not found), 409 (conflict), 500 (internal error)
- SQLite UNIQUE constraint violations are detected and returned as 409

### Frontend API Integration

- All API calls use React Query for caching and state management
- WebSocket connections are managed with reconnection logic
- File uploads use multipart form data with progress tracking

## Docker Deployment

**Services:**
- `backend`: Go API server (port 3000)
- `frontend`: Nginx serving static React build (port 8080)
- `mcp-server`: Python MCP server (stdio, no ports)

**Configuration:**
1. Copy `.env.example` to `.env` and configure `OLLAMA_URL` and `DATABASE_PATH`
2. Copy `.mcp.json.example` to `~/.mcp.json` and configure MCP servers
3. Run `make docker-setup` to build images
4. Run `make docker-up` to start all services

**Volumes:**
- `backend-data:/app/data` - SQLite database persistence
- `~/.mcp.json:/root/.mcp.json:ro` - MCP configuration (read-only)

**Health Checks:**
- Backend: `curl http://localhost:3000/health`
- Frontend: `curl http://localhost:8080`

## Testing

```bash
# Backend tests
cd backend && go test ./... -v

# Frontend tests
cd frontend && yarn test

# Docker deployment tests
make docker-health     # Check all services
make test             # Full test suite (if available)
```

## Key Components

**Frontend Highlights:**
- `HexViewer.tsx` - Core hex/ASCII/binary viewer with multi-byte selection
- `YamlEditor.tsx` - Monaco-based YAML editor with parsing rule configuration
- `PatternSearch.tsx` - Advanced search supporting 15+ data types
- `EntropyGraph.tsx` - Shannon entropy visualization using Recharts
- `BinaryDiffViewer.tsx` - Side-by-side binary comparison
- `Chat.tsx` - AI chat with streaming responses and MCP tool integration
- `SettingsMcp.tsx` - Dynamic MCP server enable/disable UI

**Backend Highlights:**
- `handlers/chat.go` - WebSocket chat with Ollama/OpenAI/Claude streaming
- `handlers/search.go` - Multi-type pattern search implementation
- `services/mcp_service.go` - MCP server lifecycle management
- `handlers/mcp_settings.go` - Dynamic MCP server configuration

## Common Development Tasks

**Adding a new API endpoint:**
1. Define handler method in appropriate `handlers/*.go` file
2. Register route in `router/router.go`
3. Add corresponding frontend API call in `frontend/src/services/` or hooks

**Adding a new MCP tool:**
1. Edit `backend/mcp-server/binary_annotator_mcp.py`
2. Add new `@server.tool()` decorated function
3. Update tool documentation in `backend/mcp-server/README.md`

**Adding a new data model:**
1. Define struct in `backend/models/models.go`
2. Database will auto-migrate on next backend startup
3. Add CRUD handlers in `backend/handlers/`

**Adding a new visualization:**
1. Create component in `frontend/src/components/`
2. Use Recharts for graphs, shadcn-ui for UI elements
3. Integrate with hex viewer selection via `useHexSelection` hook
