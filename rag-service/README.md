# RAG Service - Binary Annotator Pro

Service de Retrieval-Augmented Generation (RAG) pour améliorer l'analyse des binaires avec recherche sémantique et indexation de documentation.

## 🎯 Fonctionnalités

- **Indexation Automatique**: Indexe automatiquement les documents (Markdown, YAML, analyses)
- **Embeddings Ollama**: Utilise l'API Ollama pour générer des embeddings de haute qualité
- **Recherche Sémantique**: Recherche par similarité vectorielle avec scores
- **Types de Documents**:
  - Markdown (documentation)
  - YAML (configurations)
  - Analysis (résultats d'analyse)
  - Compression (résultats de compression)
  - Chat (historique de conversation)
  - Pattern (patterns détectés)

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP REST
       ▼
┌─────────────────────┐
│   RAG Service       │
│   (Port 8081)       │
├─────────────────────┤
│ • Indexer           │
│ • Vector Store      │
│ • Search Engine     │
└──────┬──────┬───────┘
       │      │
       ▼      ▼
  ┌────────┐  ┌─────────┐
  │ Ollama │  │ SQLite  │
  │ API    │  │ DB      │
  └────────┘  └─────────┘
```

## 📦 Installation

### Prérequis

- Go 1.23+
- Ollama installé et démarré
- Modèle d'embedding (`nomic-embed-text`)

### Installer le modèle d'embedding

```bash
ollama pull nomic-embed-text
```

### Build

```bash
cd rag-service
go mod download
go build -o bin/rag-service
```

### Configuration

Variables d'environnement:

```bash
# Port du service (défaut: 8081)
export RAG_PORT=8081

# Chemin de la base de données (défaut: ./data/rag.db)
export RAG_DB_PATH=./data/rag.db

# Répertoire de données (défaut: ./data)
export RAG_DATA_DIR=./data

# URL d'Ollama (défaut: http://localhost:11434)
export OLLAMA_BASE_URL=http://localhost:11434

# Modèle d'embedding (défaut: nomic-embed-text)
export OLLAMA_EMBED_MODEL=nomic-embed-text
```

## 🚀 Utilisation

### Démarrer le service

```bash
./bin/rag-service
```

Le service écoute sur `http://localhost:8081`

### API Endpoints

#### Health Check
```bash
GET /health
```

#### Indexer un document
```bash
POST /index/document
Content-Type: application/json

{
  "type": "markdown",
  "title": "ECG File Format Documentation",
  "content": "The ECG file format...",
  "source": "docs/ecg-format.md",
  "metadata": {
    "version": "1.0",
    "author": "team"
  }
}
```

#### Indexer un YAML
```bash
POST /index/yaml
Content-Type: application/json

{
  "title": "ECG Configuration",
  "content": "search:\n  pattern_name:...",
  "source": "configs/ecg.yaml",
  "metadata": {
    "file_type": "config"
  }
}
```

#### Indexer une analyse
```bash
POST /index/analysis
Content-Type: application/json

{
  "title": "Compression Analysis - file.bin",
  "content": "Analysis results: Found gzip compression...",
  "source": "analysis/12345",
  "metadata": {
    "file_id": "123",
    "compression": "gzip"
  }
}
```

#### Indexer en batch
```bash
POST /index/batch
Content-Type: application/json

{
  "documents": [
    {
      "type": "markdown",
      "title": "Doc 1",
      "content": "..."
    },
    {
      "type": "yaml",
      "title": "Config 1",
      "content": "..."
    }
  ]
}
```

#### Rechercher
```bash
POST /search
Content-Type: application/json

{
  "query": "How to decompress gzip files?",
  "type": ["markdown", "analysis"],
  "max_results": 10,
  "min_score": 0.5
}
```

Réponse:
```json
{
  "query": "How to decompress gzip files?",
  "results": [
    {
      "document_id": 1,
      "chunk_id": 5,
      "type": "analysis",
      "title": "Compression Analysis",
      "content": "Gzip compression detected...",
      "source": "analysis/123",
      "score": 0.89
    }
  ],
  "count": 1
}
```

#### Lister les documents
```bash
GET /documents?type=markdown&limit=10&offset=0
```

#### Obtenir un document
```bash
GET /documents/:id
```

#### Supprimer un document
```bash
DELETE /documents/:id
```

#### Effacer l'index
```bash
POST /clear
```

#### Obtenir les statistiques
```bash
GET /stats
```

Réponse:
```json
{
  "total_documents": 150,
  "total_chunks": 450,
  "documents_by_type": {
    "markdown": 50,
    "yaml": 60,
    "analysis": 40
  },
  "storage_size_bytes": 1048576
}
```

## 🔧 Intégration Backend

Le service RAG peut être intégré au backend principal:

```go
// Dans le backend principal
resp, err := http.Post("http://localhost:8081/search", "application/json", body)
```

## 📊 Performance

- **Chunking**: 512 caractères par chunk avec 50 de chevauchement
- **Embeddings**: Générés via Ollama (nomic-embed-text)
- **Similarité**: Cosine similarity pour la recherche
- **Storage**: SQLite avec BLOB pour les vecteurs

## 🛠️ Développement

### Structure du Projet

```
rag-service/
├── api/           # Handlers HTTP
├── indexer/       # Logique d'indexation
├── models/        # Modèles de données
├── storage/       # Vector store et DB
├── main.go        # Point d'entrée
└── go.mod         # Dépendances
```

### Tests

```bash
go test ./...
```

## 📝 TODO

- [ ] Support pour d'autres modèles d'embedding
- [ ] Cache pour les embeddings
- [ ] Métriques et monitoring
- [ ] Support pour les images (OCR + embedding)
- [ ] Recherche hybride (keyword + semantic)
- [ ] Filtres avancés (date, metadata)
- [ ] API de mise à jour de documents
- [ ] Export/import de l'index

## 📄 License

Propriétaire - Binary Annotator Pro
