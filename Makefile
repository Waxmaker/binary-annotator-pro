.PHONY: help install dev build clean test docker-build docker-up docker-down docker-logs backend-dev frontend-dev backend-build frontend-build

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(BLUE)ECG Analysis Workbench - Development Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(GREEN)<target>$(NC)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install: ## Install dependencies for both frontend and backend
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	cd frontend && yarn install
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	cd backend && go mod download
	@echo "$(GREEN)✓ All dependencies installed$(NC)"

dev: ## Run both frontend and backend in development mode (requires tmux or separate terminals)
	@echo "$(YELLOW)Starting development servers...$(NC)"
	@echo "$(BLUE)Run 'make frontend-dev' in one terminal and 'make backend-dev' in another$(NC)"
	@echo "Or use: make dev-tmux"

dev-tmux: ## Run both services in tmux split panes
	@echo "$(BLUE)Starting services in tmux...$(NC)"
	tmux new-session -d -s ecg-dev \; \
		send-keys 'cd frontend && npm run dev' C-m \; \
		split-window -h \; \
		send-keys 'cd backend && go run main.go' C-m \; \
		attach-session -t ecg-dev

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
	cd backend && go build -o bin/server .
	@echo "$(GREEN)✓ Backend built to backend/bin/server$(NC)"

##@ Docker

docker-build: ## Build Docker images for both services
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker-compose build
	@echo "$(GREEN)✓ Docker images built$(NC)"

docker-up: ## Start services with Docker Compose
	@echo "$(BLUE)Starting Docker containers...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services running:$(NC)"
	@echo "  Frontend: $(BLUE)http://localhost:8080$(NC)"
	@echo "  Backend:  $(BLUE)http://localhost:3000$(NC)"

docker-down: ## Stop Docker containers
	@echo "$(YELLOW)Stopping Docker containers...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Containers stopped$(NC)"

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-restart: docker-down docker-up ## Restart Docker containers

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

##@ Database

db-reset: ## Reset the SQLite database
	@echo "$(YELLOW)Resetting database...$(NC)"
	rm -f backend/ecg_data.db
	@echo "$(GREEN)✓ Database reset (will be recreated on next run)$(NC)"

##@ Utilities

check-deps: ## Check if required tools are installed
	@echo "$(BLUE)Checking dependencies...$(NC)"
	@command -v node >/dev/null 2>&1 || { echo "$(RED)✗ Node.js not installed$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)✗ npm not installed$(NC)"; exit 1; }
	@command -v go >/dev/null 2>&1 || { echo "$(RED)✗ Go not installed$(NC)"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "$(RED)✗ Docker not installed$(NC)"; exit 1; }
	@echo "$(GREEN)✓ All required tools installed$(NC)"
	@echo "  Node: $$(node --version)"
	@echo "  npm:  $$(npm --version)"
	@echo "  Go:   $$(go version | awk '{print $$3}')"
	@echo "  Docker: $$(docker --version | awk '{print $$3}')"

status: ## Show status of services
	@echo "$(BLUE)Service Status:$(NC)"
	@docker-compose ps 2>/dev/null || echo "$(YELLOW)Docker services not running$(NC)"
	@echo ""
	@echo "$(BLUE)Port Status:$(NC)"
	@lsof -i :3000 -sTCP:LISTEN 2>/dev/null | grep LISTEN || echo "  Port 3000: $(YELLOW)Not in use$(NC)"
	@lsof -i :5173 -sTCP:LISTEN 2>/dev/null | grep LISTEN || echo "  Port 5173: $(YELLOW)Not in use$(NC)"
	@lsof -i :8080 -sTCP:LISTEN 2>/dev/null | grep LISTEN || echo "  Port 8080: $(YELLOW)Not in use$(NC)"
