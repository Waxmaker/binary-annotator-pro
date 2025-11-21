# Docker Deployment Guide

## 📦 Quick Start

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Ollama running on your host machine (port 11434)
- At least 4GB RAM available

### 1. Configuration

**Copy and configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and adjust if needed:
```bash
# If Ollama runs on a different port or host
OLLAMA_URL=http://host.docker.internal:11434

# If your .mcp.json is in a different location
MCP_CONFIG_PATH=~/.mcp.json
```

**Create or copy your MCP configuration:**

```bash
# Option 1: Use the example
cp .mcp.json.example ~/.mcp.json

# Option 2: If you already have a .mcp.json, make sure it's at ~/.mcp.json
```

### 2. Build and Start

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Access the Application

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

### 4. Stop the Application

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ will delete database)
docker-compose down -v
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Network: binary-annotator-network                    │
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────┐ │
│  │   Frontend   │      │   Backend    │      │ MCP Server │ │
│  │  (React)     │─────▶│   (Go)       │◀────▶│  (Python)  │ │
│  │  Port: 8080  │      │  Port: 3000  │      │   stdio    │ │
│  └──────────────┘      └──────┬───────┘      └─────┬──────┘ │
│                               │                     │        │
│                               ▼                     ▼        │
│                        ┌─────────────┐      ┌──────────────┐│
│                        │  SQLite DB  │      │ .mcp.json    ││
│                        │   (Volume)  │      │  (Volume)    ││
│                        └─────────────┘      └──────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │  Ollama (Host)       │
                    │  Port: 11434         │
                    └──────────────────────┘
```

## 🔧 Services

### Backend (Go)

- **Image:** Built from `./backend/Dockerfile`
- **Port:** 3000
- **Volumes:**
  - `backend-data:/app/data` - SQLite database persistence
  - `~/.mcp.json:/root/.mcp.json:ro` - MCP configuration (read-only)
- **Environment:**
  - `OLLAMA_URL` - Ollama server URL
  - `DATABASE_PATH` - SQLite database path

### MCP Server (Python)

- **Image:** Built from `./mcp-server/Dockerfile`
- **Access:** stdio (no ports exposed)
- **Volumes:**
  - `~/.mcp.json:/root/.mcp.json:ro` - MCP configuration (read-only)
- **Environment:**
  - `BINARY_ANNOTATOR_API_URL` - Backend API URL
  - `OLLAMA_URL` - Ollama server URL
- **Tools:** 17 MCP tools for binary analysis

### Frontend (React)

- **Image:** Built from `./frontend/Dockerfile`
- **Port:** 8080
- **Environment:**
  - `VITE_API_URL` - Backend API URL

## 📝 MCP Configuration

The `.mcp.json` file configures available MCP servers. Example:

```json
{
  "mcpServers": {
    "binary-annotator": {
      "command": "python",
      "args": ["/app/binary_annotator_mcp.py"],
      "env": {
        "BINARY_ANNOTATOR_API_URL": "http://backend:3000"
      }
    }
  }
}
```

**Docker-specific paths:**
- Inside containers, the MCP server is at `/app/binary_annotator_mcp.py`
- Python is available as `python` or `/usr/local/bin/python`

## 🔍 Troubleshooting

### MCP Server Not Connecting

```bash
# Check MCP server logs
docker-compose logs mcp-server

# Verify .mcp.json is mounted
docker exec binary-annotator-backend ls -la /root/.mcp.json
```

### Ollama Not Accessible

```bash
# Test from container
docker exec binary-annotator-backend wget -qO- http://host.docker.internal:11434/api/tags

# Make sure Ollama is running on host
curl http://localhost:11434/api/tags
```

### Database Issues

```bash
# Check database volume
docker volume inspect binary-annotator-pro_backend-data

# Backup database
docker cp binary-annotator-backend:/app/data/ecg_data.db ./backup.db

# Reset database (⚠️ destroys data)
docker-compose down -v
docker-compose up -d
```

### View All Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f mcp-server
docker-compose logs -f frontend
```

## 🚀 Production Deployment

### Recommended Changes

1. **Use reverse proxy (nginx/traefik)**
2. **Enable HTTPS**
3. **Set proper resource limits**
4. **Use secrets for sensitive data**
5. **Enable automatic backups**

### Example Production docker-compose.override.yml

```yaml
version: '3.8'

services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 512M
    environment:
      - LOG_LEVEL=info

  frontend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

## 📊 Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:3000/health

# Check all container health
docker-compose ps
```

### Resource Usage

```bash
# Container stats
docker stats

# Specific container
docker stats binary-annotator-backend
```

## 🔄 Updates

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Update MCP Tools

```bash
# Rebuild MCP server only
docker-compose build mcp-server
docker-compose up -d mcp-server
```

## 🗄️ Backup and Restore

### Backup

```bash
# Backup database
docker cp binary-annotator-backend:/app/data/ecg_data.db ./backup-$(date +%Y%m%d).db

# Backup MCP config
cp ~/.mcp.json ./mcp-backup.json
```

### Restore

```bash
# Restore database
docker cp ./backup.db binary-annotator-backend:/app/data/ecg_data.db

# Restart backend
docker-compose restart backend
```

## 🧪 Development

### Run in Development Mode

```bash
# Start with logs visible
docker-compose up

# Rebuild after code changes
docker-compose build backend
docker-compose restart backend
```

### Access Container Shell

```bash
# Backend shell
docker exec -it binary-annotator-backend sh

# MCP server shell
docker exec -it binary-annotator-mcp sh
```

### Test MCP Tools

```bash
# From inside backend container
docker exec -it binary-annotator-backend sh
# Then test MCP library
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Ollama Docker Setup](https://ollama.ai/blog/ollama-docker)
- [MCP Protocol](https://modelcontextprotocol.io)
