# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Binary Annotator Pro is a full-stack ECG binary file analysis and annotation tool. The system consists of:

- **Backend** (this directory): Go-based REST API using Echo v4, GORM, and SQLite
- **Frontend** (parent directory): React + TypeScript + Vite application with shadcn-ui components

The backend manages binary ECG files stored as BLOBs in SQLite, along with YAML configuration files for parsing and analysis.

## Development Commands

### Backend (Go)

```bash
# Run the development server (from backend/ directory)
go run main.go
# Server starts on :3000

# Build the application
go build -o bin/server main.go

# Run tests (if/when test files are added)
go test ./...

# Install dependencies
go mod download
go mod tidy
```

### Frontend (from parent directory)

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Backend Structure

The backend follows a layered architecture:

- **`main.go`**: Entry point that initializes the database, configures Echo middleware (CORS, Logger, Recover), and starts the server
- **`config/db.go`**: Database initialization and migration. Wraps both GORM and raw sql.DB for graceful shutdown. Uses SQLite with conservative connection settings (1 max connection)
- **`models/models.go`**: GORM data models for all entities (File, YamlConfig, Tag, SearchResult, Note, ExtractedBlock)
- **`handlers/`**: HTTP request handlers
  - `handlers.go`: Core upload/download/list operations for binary files and YAML configs
  - `binary.go`: Binary file deletion handler
- **`router/router.go`**: Route registration using Echo

### Data Flow

1. Binary files are uploaded via multipart form and stored as BLOBs in the `File` model
2. YAML configuration files can be uploaded either as files or raw text strings
3. YamlConfig entries can optionally reference a File by ID
4. Additional models (Tag, SearchResult, Note, ExtractedBlock) are defined for future annotation features but not yet implemented in handlers

### Key Models

- **File**: Stores binary ECG files with vendor info, size, and BLOB data. Name is unique indexed
- **YamlConfig**: Stores YAML parsing configurations, optionally linked to a File
- **Tag**: Manual/YAML/detected annotations on binary files (offset, size, color, type)
- **SearchResult**: Pattern matching results from YAML rules
- **Note**: Text annotations at specific file offsets
- **ExtractedBlock**: Extracted binary segments (e.g., lead samples)

### API Endpoints

#### Upload
- `POST /upload/binary` - Upload binary file (multipart: file, name?, vendor?)
- `POST /upload/yaml` - Upload YAML config (multipart file OR form value OR JSON body)

#### List
- `GET /get/list/binary` - List all binary files (excludes BLOB data)
- `GET /get/list/yaml` - List all YAML configs

#### Download
- `GET /get/binary/:fileName` - Download binary file by name (returns octet-stream)
- `GET /get/binary-by-id/:id` - Download binary file by ID
- `GET /get/yaml/:configName` - Get YAML config by name (returns plain text)

#### Delete
- `DELETE /delete/binary/:name` - Delete binary file by name

#### Health
- `GET /health` - Health check endpoint

### Database

- **Type**: SQLite (file: `ecg_data.db`)
- **ORM**: GORM with auto-migration on startup
- **Connection**: Single connection (MaxOpenConns=1) for SQLite safety
- **Migrations**: Automatic via GORM AutoMigrate in `config.InitDB()`

## Important Patterns

### Handler Pattern
Handlers are methods on the `Handler` struct which holds a reference to the DB wrapper. Create new handlers by:
1. Adding methods to `Handler` in `handlers/` package
2. Registering routes in `router.RegisterRoutes()`

### Upload Flexibility
The YAML upload endpoint demonstrates flexible input handling:
- Accepts multipart file upload
- Falls back to form value "yaml"
- Falls back to JSON body with `{yaml, name, file_name}`
- Uses Echo context values for internal state passing

### Error Handling
- Returns JSON error responses with `{"error": "message"}` format
- Uses appropriate HTTP status codes (400, 404, 409, 500)
- Checks for SQLite UNIQUE constraint violations explicitly

### File Storage
All binary data is stored in SQLite BLOBs, not the filesystem. This simplifies deployment but may have performance implications for very large files.

## Frontend Integration

The frontend (React + Vite + TypeScript) in the parent directory communicates with this backend via REST API. When making changes:
- Frontend runs on Vite dev server (typically :5173)
- Backend runs on :3000
- CORS is enabled via Echo middleware
- Frontend likely uses `@tanstack/react-query` for API calls (based on dependencies)

## Technology Stack

- **Go 1.25.1**
- **Echo v4.13.4** - HTTP framework with middleware support
- **GORM v1.31.1** - ORM with SQLite driver
- **SQLite 3** - Embedded database
