.PHONY: help install dev build clean test docker-build docker-up docker-down docker-logs backend-dev frontend-dev backend-build frontend-build setup-env docker-setup docker-restart docker-ps docker-health docker-shell-backend docker-shell-mcp docker-logs-backend docker-logs-mcp docker-logs-frontend mcp-check db-reset db-backup db-restore db-docker-reset check-deps status clean-docker lint

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(BLUE)Binary Annotator Pro - Development Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(GREEN)<target>$(NC)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install: ## Install dependencies for both frontend and backend
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	cd frontend && yarn install
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	cd backend && go mod download
	@echo "$(GREEN)✓ All dependencies installed$(NC)"

dev: ## Run both frontend and backend in development mode (requires separate terminals)
	@echo "$(YELLOW)Starting development servers...$(NC)"
	@echo "$(BLUE)Run 'make frontend-dev' in one terminal and 'make backend-dev' in another$(NC)"

frontend-dev: ## Run frontend development server
	@echo "$(BLUE)Starting frontend dev server on http://localhost:5173$(NC)"
	cd frontend && yarn run dev

backend-dev: ## Run backend development server
	@echo "$(BLUE)Starting backend dev server on http://localhost:3000$(NC)"
	cd backend && go run main.go

##@ Building

build: frontend-build backend-build ## Build both frontend and backend for production
	@echo "$(GREEN)✓ All builds completed$(NC)"

frontend-build: ## Build frontend for production
	@echo "$(BLUE)Building frontend...$(NC)"
	cd frontend && yarn run build
	@echo "$(GREEN)✓ Frontend built$(NC)"

backend-build: ## Build backend binary
	@echo "$(BLUE)Building backend...$(NC)"
	cd backend && go build -o bin/binary-annotator-pro .
	@echo "$(GREEN)✓ Backend built to backend/bin/binary-annotator-pro$(NC)"

##@ Docker

setup-env: ## Setup environment files (.env and .mcp.json)
	@echo "$(BLUE)Setting up environment files...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)✓ Created .env from .env.example$(NC)"; \
	else \
		echo "$(YELLOW)⚠ .env already exists, skipping$(NC)"; \
	fi
	@if [ ! -f ~/.mcp.json ]; then \
		cp .mcp.json.example ~/.mcp.json; \
		echo "$(GREEN)✓ Created ~/.mcp.json from .mcp.json.example$(NC)"; \
	else \
		echo "$(YELLOW)⚠ ~/.mcp.json already exists, skipping$(NC)"; \
	fi
	@echo "$(GREEN)✓ Environment setup complete$(NC)"

docker-setup: setup-env ## Complete Docker setup (env files + build)
	@echo "$(BLUE)Running complete Docker setup...$(NC)"
	@$(MAKE) docker-build
	@echo "$(GREEN)✓ Docker setup complete! Run 'make docker-up' to start$(NC)"

docker-build: ## Build Docker images for all services
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker-compose build
	@echo "$(GREEN)✓ Docker images built$(NC)"

docker-up: ## Start all services with Docker Compose
	@echo "$(BLUE)Starting Docker containers...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services running:$(NC)"
	@echo "  Frontend:   $(BLUE)http://localhost:8080$(NC)"
	@echo "  Backend:    $(BLUE)http://localhost:3000$(NC)"
	@echo "  Health:     $(BLUE)http://localhost:3000/health$(NC)"

docker-down: ## Stop Docker containers
	@echo "$(YELLOW)Stopping Docker containers...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Containers stopped$(NC)"

docker-restart: docker-down docker-up ## Restart Docker containers

docker-logs: ## View all Docker logs
	docker-compose logs -f

docker-logs-backend: ## View backend logs only
	docker-compose logs -f backend

docker-logs-frontend: ## View frontend logs only
	docker-compose logs -f frontend

docker-ps: ## Show running containers
	@docker-compose ps

docker-health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@docker-compose ps
	@echo ""
	@echo "$(BLUE)Backend health check:$(NC)"
	@curl -s http://localhost:3000/health | jq . || echo "$(RED)✗ Backend not responding$(NC)"

docker-shell-backend: ## Open shell in backend container
	docker exec -it binary-annotator-backend sh

docker-shell-mcp: ## Open shell in MCP server container
	docker exec -it binary-annotator-mcp sh

docker-shell-frontend: ## Open shell in frontend container
	docker exec -it binary-annotator-frontend sh

##@ Testing & Quality

test: ## Run all tests
	@echo "$(BLUE)Running backend tests...$(NC)"
	cd backend && go test ./... -v
	@echo "$(BLUE)Running frontend tests...$(NC)"
	cd frontend && yarn test

lint: ## Run linters
	@echo "$(BLUE)Linting frontend...$(NC)"
	cd frontend && yarn run lint
	@echo "$(BLUE)Linting backend...$(NC)"
	cd backend && go fmt ./...
	cd backend && go vet ./...

##@ Cleaning

clean: ## Clean build artifacts and dependencies
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf frontend/dist
	rm -rf frontend/node_modules
	rm -rf backend/bin
	rm -rf backend/tmp
	@echo "$(GREEN)✓ Cleaned$(NC)"

clean-docker: ## Remove Docker containers, images, and volumes
	@echo "$(RED)Removing Docker resources...$(NC)"
	docker-compose down -v --rmi all
	@echo "$(GREEN)✓ Docker resources removed$(NC)"

##@ MCP Server

mcp-check: ## Check MCP configuration
	@echo "$(BLUE)Checking MCP configuration...$(NC)"
	@if [ -f ~/.mcp.json ]; then \
		echo "$(GREEN)✓ ~/.mcp.json exists$(NC)"; \
		cat ~/.mcp.json | jq . || echo "$(RED)✗ Invalid JSON$(NC)"; \
	else \
		echo "$(RED)✗ ~/.mcp.json not found$(NC)"; \
		echo "$(YELLOW)Run 'make setup-env' to create it$(NC)"; \
	fi

##@ Database

db-reset: ## Reset the SQLite database (local dev)
	@echo "$(YELLOW)Resetting local database...$(NC)"
	rm -f backend/ecg_data.db
	@echo "$(GREEN)✓ Database reset (will be recreated on next run)$(NC)"

db-backup: ## Backup Docker database
	@echo "$(BLUE)Backing up database...$(NC)"
	@mkdir -p backups
	docker cp binary-annotator-backend:/app/data/ecg_data.db ./backups/ecg_data_$$(date +%Y%m%d_%H%M%S).db
	@echo "$(GREEN)✓ Database backed up to backups/$(NC)"

db-restore: ## Restore database from backup (use DB=path/to/backup.db)
	@if [ -z "$(DB)" ]; then \
		echo "$(RED)✗ Please specify DB=path/to/backup.db$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Restoring database from $(DB)...$(NC)"
	docker cp $(DB) binary-annotator-backend:/app/data/ecg_data.db
	docker-compose restart backend
	@echo "$(GREEN)✓ Database restored$(NC)"

db-docker-reset: ## Reset Docker database (⚠️ destroys all data)
	@echo "$(RED)⚠️  This will destroy all database data!$(NC)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	docker-compose down -v
	docker-compose up -d
	@echo "$(GREEN)✓ Database reset$(NC)"

##@ Utilities

check-deps: ## Check if required tools are installed
	@echo "$(BLUE)Checking dependencies...$(NC)"
	@command -v node >/dev/null 2>&1 || { echo "$(RED)✗ Node.js not installed$(NC)"; exit 1; }
	@command -v yarn >/dev/null 2>&1 || { echo "$(RED)✗ Yarn not installed$(NC)"; exit 1; }
	@command -v go >/dev/null 2>&1 || { echo "$(RED)✗ Go not installed$(NC)"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "$(RED)✗ Docker not installed$(NC)"; exit 1; }
	@command -v python3 >/dev/null 2>&1 || { echo "$(RED)✗ Python3 not installed$(NC)"; exit 1; }
	@echo "$(GREEN)✓ All required tools installed$(NC)"
	@echo "  Node:   $$(node --version)"
	@echo "  Yarn:   $$(yarn --version)"
	@echo "  Go:     $$(go version | awk '{print $$3}')"
	@echo "  Docker: $$(docker --version | awk '{print $$3}')"
	@echo "  Python: $$(python3 --version)"

status: ## Show status of all services
	@echo "$(BLUE)=== Docker Services ===$(NC)"
	@docker-compose ps 2>/dev/null || echo "$(YELLOW)Docker services not running$(NC)"
	@echo ""
	@echo "$(BLUE)=== Port Status ===$(NC)"
	@lsof -i :3000 -sTCP:LISTEN 2>/dev/null | grep LISTEN && echo "  Port 3000: $(GREEN)In use (Backend)$(NC)" || echo "  Port 3000: $(YELLOW)Not in use$(NC)"
	@lsof -i :5173 -sTCP:LISTEN 2>/dev/null | grep LISTEN && echo "  Port 5173: $(GREEN)In use (Frontend dev)$(NC)" || echo "  Port 5173: $(YELLOW)Not in use$(NC)"
	@lsof -i :8080 -sTCP:LISTEN 2>/dev/null | grep LISTEN && echo "  Port 8080: $(GREEN)In use (Frontend)$(NC)" || echo "  Port 8080: $(YELLOW)Not in use$(NC)"
	@echo ""
	@echo "$(BLUE)=== Health Checks ===$(NC)"
	@curl -s http://localhost:3000/health >/dev/null 2>&1 && echo "  Backend:  $(GREEN)Healthy$(NC)" || echo "  Backend:  $(RED)Not responding$(NC)"
	@curl -s http://localhost:8080 >/dev/null 2>&1 && echo "  Frontend: $(GREEN)Accessible$(NC)" || echo "  Frontend: $(RED)Not accessible$(NC)"

