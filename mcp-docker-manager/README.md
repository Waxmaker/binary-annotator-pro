# MCP Docker Manager

Gestionnaire de serveurs MCP (Model Context Protocol) dans des conteneurs Docker.

## 🎯 Objectif

Ce système permet de gérer des serveurs MCP dans des conteneurs Docker isolés, en résolvant le défi principal de la communication stdio (stdin/stdout) entre le manager et les serveurs MCP.

## 🏗️ Architecture

Les serveurs MCP communiquent via **stdio** (stdin/stdout), ce qui pose des défis en Docker car les conteneurs s'arrêtent immédiatement sans stdin ouvert.

### Solution Implémentée: Keep stdin open + Container Attach

Notre approche utilise:
- Conteneurs créés avec `OpenStdin: true` et `StdinOnce: false`
- Attachement aux flux stdin/stdout du conteneur via l'API Docker
- Communication JSON-RPC 2.0 via les flux attachés
- Mutex pour assurer la thread-safety des communications

### Autres Solutions Possibles

**TCP Wrapper**:
- Wrapper autour du MCP server qui expose un port TCP
- Communication JSON-RPC via TCP
- Plus simple mais nécessite modification du serveur

**Docker Exec**:
- Container qui tourne en boucle infinie
- Communication via `docker exec` pour chaque requête
- Plus lent mais fonctionne avec tout serveur MCP standard

## 📁 Structure

```
mcp-docker-manager/
├── manager/              # Service Go qui gère les containers
│   ├── main.go          # Logique principale du manager
│   ├── Dockerfile       # Image Docker du manager
│   ├── go.mod / go.sum  # Dépendances Go
├── servers/             # Dockerfiles des serveurs MCP
│   └── filesystem/      # Serveur MCP filesystem
│       ├── Dockerfile
│       └── entrypoint.sh
├── docker-compose.yml   # Orchestration Docker
├── Makefile            # Commandes de build/run/test
├── test-mcp.sh         # Suite de tests automatisés
└── README.md           # Cette documentation
```

## 🚀 Quick Start

### Prérequis

- Docker et Docker Compose installés
- Make (optionnel mais recommandé)
- curl et jq pour les tests

### Démarrage Rapide

```bash
# 1. Build toutes les images
make build

# 2. Démarrer le manager
make start

# 3. Tester l'installation
make test
```

Le manager sera accessible sur `http://localhost:8080`.

### Commandes Make Disponibles

```bash
make help              # Affiche toutes les commandes disponibles
make build             # Build toutes les images Docker
make build-manager     # Build uniquement le manager
make build-filesystem  # Build uniquement le serveur filesystem
make start             # Démarre les services
make stop              # Arrête les services
make restart           # Redémarre les services
make logs              # Affiche les logs du manager
make test              # Lance la suite de tests
make clean             # Nettoie tout (containers, volumes)
make dev               # Lance le manager en mode dev (hors Docker)
```

## 🔌 API REST du Manager

### Health Check

```bash
GET /health
```

Exemple:
```bash
curl http://localhost:8080/health
# {"status": "ok"}
```

### Lister les Serveurs Actifs

```bash
GET /servers
```

Exemple:
```bash
curl http://localhost:8080/servers | jq
```

### Démarrer un Serveur MCP

```bash
POST /servers/:name/start
Content-Type: application/json

{
  "image": "mcp/filesystem:latest"
}
```

Exemple:
```bash
curl -X POST http://localhost:8080/servers/filesystem/start \
  -H "Content-Type: application/json" \
  -d '{"image": "mcp/filesystem:latest"}'
```

### Arrêter un Serveur

```bash
POST /servers/:name/stop
```

Exemple:
```bash
curl -X POST http://localhost:8080/servers/filesystem/stop
```

### Appeler un Tool MCP

```bash
POST /servers/:name/call
Content-Type: application/json

{
  "tool": "read_file",
  "arguments": {
    "path": "/data/example.txt"
  }
}
```

Exemple:
```bash
curl -X POST http://localhost:8080/servers/filesystem/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "list_directory",
    "arguments": {"path": "/data"}
  }' | jq
```

## 🧪 Tests

### Tests Automatisés

```bash
# Lancer la suite de tests complète
./test-mcp.sh

# Ou via Make
make test
```

Les tests vérifient:
1. ✓ Health check du manager
2. ✓ Démarrage d'un serveur MCP
3. ✓ Communication avec le serveur
4. ✓ Appel d'un tool MCP
5. ✓ Arrêt du serveur

### Tests Manuels

```bash
# 1. Vérifier le statut
curl http://localhost:8080/health

# 2. Démarrer le serveur filesystem
curl -X POST http://localhost:8080/servers/filesystem/start \
  -H "Content-Type: application/json" \
  -d '{"image": "mcp/filesystem:latest"}'

# 3. Lister les serveurs (devrait montrer filesystem)
curl http://localhost:8080/servers | jq

# 4. Appeler un tool
curl -X POST http://localhost:8080/servers/filesystem/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_directory", "arguments": {"path": "/data"}}' | jq

# 5. Arrêter le serveur
curl -X POST http://localhost:8080/servers/filesystem/stop
```

## 🔧 Développement

### Mode Développement (sans Docker)

```bash
# Installer les dépendances
cd manager
go mod download

# Lancer le manager localement
make dev

# Ou directement
cd manager && go run main.go
```

### Ajouter un Nouveau Serveur MCP

1. Créer un dossier dans `servers/` (ex: `servers/sqlite/`)
2. Créer le `Dockerfile`:

```dockerfile
FROM node:20-alpine

# Installer le serveur MCP
RUN npm install -g @modelcontextprotocol/server-sqlite

# Créer l'entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /data
ENTRYPOINT ["/entrypoint.sh"]
```

3. Créer `entrypoint.sh`:

```bash
#!/bin/sh
export NODE_NO_WARNINGS=1
echo "[MCP SQLite Server] Starting..." >&2
exec npx -y @modelcontextprotocol/server-sqlite /data
```

4. Ajouter la target dans le `Makefile`:

```makefile
build-sqlite:
	docker build -t mcp/sqlite:latest ./servers/sqlite
```

5. Démarrer via l'API:

```bash
curl -X POST http://localhost:8080/servers/sqlite/start \
  -H "Content-Type: application/json" \
  -d '{"image": "mcp/sqlite:latest"}'
```

## 🐛 Debugging

### Voir les Logs du Manager

```bash
make logs
# ou
docker-compose logs -f mcp-manager
```

### Voir les Logs d'un Serveur MCP

```bash
docker logs mcp-filesystem
```

### Lister les Conteneurs MCP

```bash
docker ps --filter "label=managed-by=mcp-docker-manager"
```

### Nettoyer Complètement

```bash
make clean
# Supprime tous les conteneurs, volumes et réseaux
```

## 📚 Protocole MCP

Le protocole MCP (Model Context Protocol) utilise JSON-RPC 2.0 sur stdio.

### Exemple d'Initialisation

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "mcp-docker-manager",
      "version": "1.0.0"
    }
  }
}
```

### Exemple d'Appel de Tool

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/data/example.txt"
    }
  }
}
```

## 🔐 Sécurité

- Le manager nécessite accès au socket Docker (`/var/run/docker.sock`)
- Les serveurs MCP tournent dans des conteneurs isolés
- Utiliser des volumes en lecture seule quand possible
- Limiter les paths accessibles (ex: `ALLOWED_PATHS=/data`)

## 🚧 TODO

- [ ] Support de configuration YAML pour les serveurs
- [ ] Gestion des volumes et variables d'environnement
- [ ] Interface web de monitoring
- [ ] Métriques et observabilité
- [ ] Support multi-architecture (ARM64)
- [ ] Tests unitaires Go
- [ ] CI/CD pipeline
