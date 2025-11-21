# ECG Binary Annotator - RAG Knowledge Base System

## Vision

Transformer l'ECG Binary Annotator en un outil collaboratif où médecins, cardiologues et étudiants peuvent analyser des fichiers ECG binaires tout en **alimentant une base de connaissances partagée** via RAG (Retrieval Augmented Generation).

### Objectifs Principaux

1. **Démocratiser l'analyse des fichiers ECG binaires**
   - Formats propriétaires complexes (GE, Philips, Schiller, etc.)
   - Structures de données non documentées
   - Variations entre versions de firmware

2. **Créer une knowledge base communautaire**
   - Médecins annotent ce qu'ils trouvent
   - Patterns ECG connus (arythmies, QRS, ondes P/T, etc.)
   - Correspondance entre offsets binaires et significations médicales

3. **Assistance contextuelle intelligente**
   - "Ce pattern à 0x2000 ressemble à un segment ST élevé"
   - "Cette structure de 12 bytes est probablement un header de dérivation"
   - Suggestions basées sur analyses similaires

---

## Architecture Proposée

### Container Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - Binary Viewer  - Chat Interface  - Annotations UI    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                  Backend API (Go)                        │
│  - File Management  - WebSocket  - User Auth            │
└──┬──────────────┬──────────────┬────────────────────┬──┘
   │              │              │                    │
   │              │              │                    │
┌──▼───┐    ┌─────▼─────┐  ┌────▼─────┐      ┌──────▼──────┐
│ DB   │    │ MCP Docker│  │  Ollama  │      │ RAG Server  │
│(SQLite)   │  Manager  │  │ (LLM)    │      │ (NEW!)      │
└──────┘    └───────────┘  └──────────┘      └──────┬──────┘
                                                     │
                                              ┌──────▼──────┐
                                              │ Vector DB   │
                                              │ (ChromaDB)  │
                                              └─────────────┘
```

---

## Nouveau Container: RAG Server

### Technologies

- **Framework**: FastAPI (Python) ou Fiber (Go)
- **Vector Database**: ChromaDB (open source, facile à déployer)
- **Embeddings**:
  - Modèle local: `sentence-transformers/all-MiniLM-L6-v2`
  - Ou OpenAI embeddings pour meilleure qualité
- **Container**: Docker avec volume persistant

### Dockerfile Proposé

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    chromadb \
    sentence-transformers \
    pydantic \
    python-multipart

# Copy application
COPY rag-server/ .

# Expose port
EXPOSE 8081

# Run server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
```

### API Endpoints

```python
# Ingestion d'annotations
POST /annotations
{
  "file_name": "ecg_patient_123.bin",
  "offset": 8192,
  "length": 256,
  "medical_context": "QRS complex - Normal sinus rhythm",
  "binary_pattern": "0F A2 B3...",
  "tags": ["QRS", "normal", "derivation_II"],
  "author": "dr_cardio_42",
  "confidence": 0.95
}

# Recherche sémantique
POST /search
{
  "query": "What is this pattern at offset 0x2000?",
  "file_context": {
    "name": "ecg_patient_456.bin",
    "offset": 8192,
    "bytes": "0F A2 B3...",
    "surrounding_context": "..."
  },
  "top_k": 5
}

# Récupération de connaissances par similarité
POST /similar-patterns
{
  "binary_pattern": "0F A2 B3 C4...",
  "min_similarity": 0.7,
  "tags": ["QRS", "arrhythmia"]
}

# Contribution de documentation
POST /knowledge/formats
{
  "format_name": "GE MUSE XML v9",
  "structure": {
    "header": {"offset": 0, "size": 512, "description": "..."},
    "waveforms": {"offset": 512, "description": "12-lead data"}
  },
  "author": "dr_smith"
}
```

---

## Workflow Utilisateur

### 1. Analyse d'un fichier ECG

```
Médecin ouvre ecg_patient_123.bin
    ↓
Zoom sur offset 0x2000, trouve un pattern intéressant
    ↓
Clique "Ask AI" dans le chat
    ↓
Query: "What is this pattern? It looks like abnormal QRS"
    ↓
RAG Server:
  - Embed la query
  - Cherche patterns similaires dans ChromaDB
  - Trouve: "Dr. Martin a annoté un pattern similaire: Bloc de branche gauche"
  - Contexte: 3 autres cas similaires
    ↓
LLM (Ollama) génère réponse enrichie:
"Ce pattern à 0x2000 ressemble à un bloc de branche gauche (BBG).
Basé sur 3 cas similaires annotés:
- Dr. Martin: BBG complet, QRS > 120ms
- Dr. Lee: Pattern similaire en V1-V6
Recommandation: Vérifier la durée QRS complète"
```

### 2. Contribution de connaissances

```
Médecin annote un nouveau pattern
    ↓
Sélectionne offset 0x3000-0x3100
    ↓
Ajoute annotation: "Onde T inversée - Ischémie antérieure probable"
    ↓
Tags: ["onde_T", "ischémie", "dérivation_V2-V4"]
    ↓
Sauvegardé dans:
  1. Base de données locale (annotations persistantes)
  2. RAG Server (indexé pour recherche sémantique)
    ↓
Disponible pour tous les futurs utilisateurs
```

---

## Structure de la Base de Connaissances

### Collections ChromaDB

#### 1. **Annotations Médicales**
```python
{
  "id": "ann_12345",
  "embedding": [0.123, -0.456, ...],  # Vector 384-dim
  "metadata": {
    "file_name": "ecg_ge_muse.bin",
    "offset": 8192,
    "length": 256,
    "medical_term": "QRS complex",
    "interpretation": "Normal sinus rhythm, rate 72 bpm",
    "tags": ["QRS", "normal", "sinus"],
    "author": "dr_cardio_42",
    "timestamp": "2025-11-20T14:30:00Z",
    "confidence": 0.95,
    "verified_by": ["dr_smith", "dr_jones"]
  },
  "document": "Binary pattern at offset 0x2000: QRS complex showing normal conduction.
               Pattern: 0F A2 B3 C4... represents standard QRS morphology in lead II."
}
```

#### 2. **Format Specifications**
```python
{
  "id": "fmt_ge_muse_v9",
  "embedding": [...],
  "metadata": {
    "format": "GE MUSE XML v9",
    "vendor": "GE Healthcare",
    "version": "9.x",
    "year": 2020
  },
  "document": "GE MUSE XML v9 format structure:
               - Header: 0x0000-0x01FF (512 bytes)
                 - Magic: 'MUSE' at offset 0
                 - Version: offset 4-5
               - Waveform data: 0x0200-...
                 - 12 leads × 10 seconds @ 500 Hz
                 - 16-bit signed integers"
}
```

#### 3. **Pattern Library**
```python
{
  "id": "pat_afib_123",
  "embedding": [...],
  "metadata": {
    "pattern_type": "arrhythmia",
    "condition": "atrial_fibrillation",
    "frequency": "common",
    "clinical_significance": "high"
  },
  "document": "Atrial fibrillation pattern characteristics:
               - Irregular R-R intervals
               - Absent P waves
               - Narrow QRS complex
               Binary signature: Variable intervals between QRS complexes,
               no consistent pattern before QRS"
}
```

---

## Fonctionnalités RAG-Powered

### 1. Smart Search
```
User: "Show me all cases of left bundle branch block"
    ↓
RAG finds: 15 annotated patterns
    ↓
Display: Visual comparison view showing all 15 patterns
         with offsets, interpretations, and authors
```

### 2. Pattern Matching
```
User selects unknown pattern at offset 0x5000
    ↓
Click "Find Similar Patterns"
    ↓
RAG computes embedding of binary pattern
    ↓
Returns top 5 most similar with cosine similarity > 0.85
    ↓
Display: "This pattern matches 'Premature Ventricular Contraction'
         found by Dr. Lee in ecg_234.bin (similarity: 92%)"
```

### 3. Contexte-Aware Chat
```
User: "Is this dangerous?"
    ↓
Context:
  - Current file: ecg_patient_789.bin
  - Current offset: 0x3400
  - Visible pattern: ST segment elevation
    ↓
RAG retrieves:
  - 8 similar ST elevation cases
  - Clinical guidelines for ST elevation
  - Emergency protocols
    ↓
LLM response: "This ST elevation pattern suggests acute myocardial infarction.
               Based on 8 similar cases in the database:
               - 6 were confirmed STEMI
               - 2 were pericarditis
               Recommendation: Immediate clinical correlation and troponin check"
```

### 4. Learning Mode pour Étudiants
```
Student opens training file
    ↓
RAG suggests: "This file contains 5 interesting patterns.
               Try to identify them before revealing answers."
    ↓
Student annotates pattern
    ↓
RAG provides feedback: "Good identification! This is a classic
                        right bundle branch block. Compare with
                        Dr. Smith's annotation for subtle differences."
```

---

## Implémentation Progressive

### Phase 1: Infrastructure de Base
- [ ] Créer container RAG server (FastAPI + ChromaDB)
- [ ] API d'ingestion d'annotations
- [ ] API de recherche sémantique basique
- [ ] Integration avec backend Go
- [ ] Docker Compose setup

### Phase 2: Ingestion de Connaissances
- [ ] UI pour créer annotations depuis le viewer
- [ ] Système de tags médicaux
- [ ] Export/import d'annotations
- [ ] Validation par pairs (upvote/downvote)

### Phase 3: Recherche Intelligente
- [ ] Recherche par similarité de patterns binaires
- [ ] Recherche sémantique en langage naturel
- [ ] Filtres par tags, auteur, confidence
- [ ] Historique de recherches

### Phase 4: Chat Augmenté
- [ ] Integration RAG avec Ollama chat
- [ ] Contexte automatique (fichier + offset courant)
- [ ] Citations des sources (qui a annoté quoi)
- [ ] Mode "Expert" vs "Student"

### Phase 5: Features Avancées
- [ ] Détection automatique de patterns connus
- [ ] Suggestions d'annotations
- [ ] Graphes de connaissances (patterns liés)
- [ ] Export de rapports enrichis

---

## Exemple de Code: RAG Server (main.py)

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import uvicorn

app = FastAPI(title="ECG RAG Server")

# Initialize ChromaDB
chroma_client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_db"
))

# Collections
annotations_collection = chroma_client.get_or_create_collection(
    name="ecg_annotations",
    metadata={"description": "Medical annotations on ECG binary files"}
)

formats_collection = chroma_client.get_or_create_collection(
    name="ecg_formats",
    metadata={"description": "ECG file format specifications"}
)

# Embedding model
embedder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

# Models
class Annotation(BaseModel):
    file_name: str
    offset: int
    length: int
    medical_context: str
    binary_pattern: str
    tags: List[str]
    author: str
    confidence: float = 1.0

class SearchQuery(BaseModel):
    query: str
    file_context: Optional[dict] = None
    top_k: int = 5
    min_similarity: float = 0.5

# Endpoints
@app.post("/annotations")
async def add_annotation(annotation: Annotation):
    """Add a new medical annotation to the knowledge base"""

    # Create document text
    doc_text = f"""
    Medical Annotation:
    File: {annotation.file_name}
    Offset: 0x{annotation.offset:08X}
    Pattern: {annotation.binary_pattern}
    Interpretation: {annotation.medical_context}
    Tags: {', '.join(annotation.tags)}
    By: {annotation.author}
    """

    # Generate embedding
    embedding = embedder.encode(doc_text).tolist()

    # Store in ChromaDB
    annotation_id = f"ann_{annotation.file_name}_{annotation.offset}"

    annotations_collection.add(
        ids=[annotation_id],
        embeddings=[embedding],
        documents=[doc_text],
        metadatas=[{
            "file_name": annotation.file_name,
            "offset": annotation.offset,
            "length": annotation.length,
            "medical_context": annotation.medical_context,
            "tags": ",".join(annotation.tags),
            "author": annotation.author,
            "confidence": annotation.confidence
        }]
    )

    return {"status": "success", "id": annotation_id}

@app.post("/search")
async def search_knowledge(query: SearchQuery):
    """Semantic search across annotations"""

    # Enhance query with file context if provided
    full_query = query.query
    if query.file_context:
        full_query += f"\nFile context: {query.file_context.get('name', '')} at offset 0x{query.file_context.get('offset', 0):08X}"

    # Generate query embedding
    query_embedding = embedder.encode(full_query).tolist()

    # Search ChromaDB
    results = annotations_collection.query(
        query_embeddings=[query_embedding],
        n_results=query.top_k
    )

    # Format results
    search_results = []
    for i, (doc, metadata, distance) in enumerate(zip(
        results['documents'][0],
        results['metadatas'][0],
        results['distances'][0]
    )):
        similarity = 1 - distance  # Convert distance to similarity
        if similarity >= query.min_similarity:
            search_results.append({
                "rank": i + 1,
                "similarity": similarity,
                "document": doc,
                "metadata": metadata
            })

    return {
        "query": query.query,
        "results": search_results,
        "total_found": len(search_results)
    }

@app.post("/similar-patterns")
async def find_similar_patterns(
    binary_pattern: str,
    min_similarity: float = 0.7,
    tags: Optional[List[str]] = None
):
    """Find similar binary patterns in the knowledge base"""

    # Create search text from binary pattern
    search_text = f"Binary pattern: {binary_pattern}"
    if tags:
        search_text += f"\nTags: {', '.join(tags)}"

    embedding = embedder.encode(search_text).tolist()

    # Search with optional tag filter
    where_filter = None
    if tags:
        # ChromaDB metadata filtering
        where_filter = {"tags": {"$contains": tags[0]}}  # Simplified

    results = annotations_collection.query(
        query_embeddings=[embedding],
        n_results=10,
        where=where_filter
    )

    similar_patterns = []
    for doc, metadata, distance in zip(
        results['documents'][0],
        results['metadatas'][0],
        results['distances'][0]
    ):
        similarity = 1 - distance
        if similarity >= min_similarity:
            similar_patterns.append({
                "similarity": similarity,
                "file": metadata.get('file_name'),
                "offset": metadata.get('offset'),
                "context": metadata.get('medical_context'),
                "author": metadata.get('author')
            })

    return {"matches": similar_patterns}

@app.get("/stats")
async def get_stats():
    """Get knowledge base statistics"""
    return {
        "total_annotations": annotations_collection.count(),
        "total_formats": formats_collection.count()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
```

---

## Docker Compose Setup

```yaml
version: '3.8'

services:
  # Existing services
  frontend:
    # ... existing config

  backend:
    # ... existing config

  mcp-docker-manager:
    # ... existing config

  # NEW: RAG Server
  rag-server:
    build: ./rag-server
    container_name: ecg-rag-server
    ports:
      - "8081:8081"
    volumes:
      - ./rag-data:/app/chroma_db  # Persist vector database
    environment:
      - EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
      - CHROMA_PERSIST_DIR=/app/chroma_db
    networks:
      - ecg-network
    restart: unless-stopped

volumes:
  rag-data:
    driver: local

networks:
  ecg-network:
    driver: bridge
```

---

## Use Cases Médicaux Concrets

### 1. Formation des Internes
**Scenario**: Un interne en cardiologie analyse son premier ECG binaire

- Ouvre le fichier avec des artefacts
- Demande au chat: "What is this noise pattern?"
- RAG trouve 12 annotations sur les artefacts musculaires
- Affiche des exemples comparatifs
- Suggestion: "Probablement contractions musculaires - comparer avec écran du patient"

### 2. Recherche Clinique
**Scenario**: Cardiologue recherche tous les cas de Brugada syndrome

- Recherche: "Show all Brugada patterns"
- RAG retourne 23 cas annotés
- Permet export CSV avec offsets et fichiers
- Facilite l'étude statistique

### 3. Détection de Variations de Format
**Scenario**: Nouveau firmware GE MUSE détecté

- Format légèrement différent (header décalé)
- Médecin annote les changements
- RAG alerte futurs utilisateurs
- Knowledge base se met à jour automatiquement

### 4. Télé-expertise
**Scenario**: Médecin en zone rurale a un cas complexe

- Upload fichier ECG binaire
- Demande: "Is this ST elevation concerning?"
- RAG compare avec 150 cas similaires
- Génère rapport automatique pour cardiologue référent

---

## Métriques de Succès

### Quantitatives
- **Nombre d'annotations**: > 1000 patterns annotés la première année
- **Contributeurs actifs**: > 50 médecins/étudiants
- **Précision recherche**: > 85% de patterns pertinents trouvés
- **Temps d'analyse réduit**: -40% grâce aux suggestions RAG

### Qualitatives
- Validation par comité médical
- Publications académiques utilisant l'outil
- Adoption dans cursus universitaires
- Cas cliniques résolus grâce au RAG

---

## Roadmap Long Terme

### Q1 2026: Foundation
- Infrastructure RAG complète
- 100 premières annotations validées
- Interface d'annotation intuitive

### Q2 2026: Growth
- Integration multi-formats (GE, Philips, Schiller)
- API publique pour chercheurs
- Documentation médicale extensive

### Q3 2026: Intelligence
- Auto-détection de patterns connus
- Alertes sur anomalies critiques
- Système de recommandation

### Q4 2026: Community
- Marketplace d'annotations (payant/gratuit)
- Certifications pour contributeurs experts
- Integration avec PACS hospitaliers

---

## Considérations Éthiques et Légales

### RGPD / HIPAA Compliance
- **Anonymisation**: Aucune donnée patient dans RAG
- **Fichiers binaires seuls**: Pas de métadonnées identifiantes
- **Consentement**: Utilisateurs consentent au partage d'annotations
- **Droit à l'oubli**: Possibilité de retirer ses annotations

### Validation Médicale
- **Peer Review**: Annotations validées par ≥ 2 médecins
- **Disclaimer**: "Outil d'aide, pas de diagnostic"
- **Traçabilité**: Qui a annoté quoi, quand
- **Version Control**: Historique des modifications

### Propriété Intellectuelle
- **Licence ouverte**: Annotations sous CC-BY-SA
- **Attribution**: Créditer les contributeurs
- **Usage commercial**: Conditions spécifiques

---

## Conclusion

Le système RAG transformera l'ECG Binary Annotator en une **plateforme collaborative d'intelligence collective** pour l'analyse des fichiers ECG binaires.

**Bénéfices clés**:
- Démocratisation de l'accès aux formats propriétaires
- Réduction du temps d'apprentissage pour les étudiants
- Amélioration de la précision diagnostique
- Constitution d'une base de connaissances unique au monde

**Prochaine étape**: Développer le POC du RAG server avec ChromaDB et tester avec 20-30 annotations initiales sur des patterns ECG courants.

---

**Auteur**: Jonathan Milhas
**Date**: 20 Novembre 2025
**Version**: 1.0 - Vision Document
