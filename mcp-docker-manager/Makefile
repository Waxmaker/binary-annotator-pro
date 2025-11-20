.PHONY: help build build-manager build-filesystem build-binary-tools start stop restart logs clean test

# Default target
help:
	@echo "MCP Docker Manager - Available commands:"
	@echo ""
	@echo "  make build              - Build all Docker images"
	@echo "  make build-manager      - Build manager service image"
	@echo "  make build-filesystem   - Build filesystem MCP server image"
	@echo "  make build-binary-tools - Build binary-tools MCP server image"
	@echo "  make start              - Start the MCP manager service"
	@echo "  make stop               - Stop all services"
	@echo "  make restart            - Restart all services"
	@echo "  make logs               - View manager logs"
	@echo "  make test               - Test the manager API"
	@echo "  make clean              - Remove all containers and volumes"
	@echo ""

# Build all images
build: build-manager build-filesystem build-binary-tools
	@echo "✅ All images built successfully"

# Build manager service
build-manager:
	@echo "🔨 Building MCP manager service..."
	docker build -t mcp-manager:latest ./manager
	@echo "✅ Manager service built"

# Build filesystem MCP server
build-filesystem:
	@echo "🔨 Building filesystem MCP server..."
	docker build -t mcp/filesystem:latest ./servers/filesystem
	@echo "✅ Filesystem server built"

# Build binary-tools MCP server
build-binary-tools:
	@echo "🔨 Building binary-tools MCP server..."
	docker build -t mcp/binary-tools:latest ./servers/binary-tools
	@echo "✅ Binary-tools server built"

# Start services
start:
	@echo "🚀 Starting MCP Docker Manager..."
	docker-compose up -d
	@echo "✅ Services started"
	@echo ""
	@echo "Manager API available at: http://localhost:8080"
	@echo "Health check: http://localhost:8080/health"

# Stop services
stop:
	@echo "🛑 Stopping services..."
	docker-compose down
	@echo "✅ Services stopped"

# Restart services
restart: stop start

# View logs
logs:
	docker-compose logs -f mcp-manager

# Test the manager API
test:
	@echo "🧪 Testing MCP Manager API..."
	@echo ""
	@echo "1. Health check:"
	@curl -s http://localhost:8080/health | jq . || echo "Manager not running?"
	@echo ""
	@echo "2. List servers:"
	@curl -s http://localhost:8080/servers | jq . || echo "Manager not running?"
	@echo ""
	@echo "3. Start filesystem server:"
	@curl -s -X POST http://localhost:8080/servers/filesystem/start \
		-H "Content-Type: application/json" \
		-d '{"image": "mcp/filesystem:latest"}' | jq . || echo "Failed to start server"
	@echo ""
	@echo "4. List servers again:"
	@sleep 2
	@curl -s http://localhost:8080/servers | jq . || echo "Manager not running?"

# Clean up everything
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v
	docker rm -f $$(docker ps -aq --filter "label=managed-by=mcp-docker-manager") 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Development: Run manager locally (not in Docker)
dev:
	@echo "🔧 Running manager in development mode..."
	cd manager && go run main.go
