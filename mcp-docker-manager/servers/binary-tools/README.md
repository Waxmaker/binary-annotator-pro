# Binary Annotator Pro - MCP Server

Ce serveur MCP (Model Context Protocol) expose les fonctionnalités de Binary Annotator Pro comme des outils utilisables par des LLMs (Claude, GPT, etc.).

## Installation

```bash
# Installer les dépendances
pip install mcp httpx

# Ou avec uv (recommandé)
uv pip install mcp httpx
```

## Configuration

Le serveur MCP se connecte à l'API Binary Annotator Pro. Par défaut, il utilise `http://localhost:3000`.

Pour changer l'URL :
```bash
export BINARY_ANNOTATOR_API_URL=http://your-api-url:3000
```

## Utilisation

### Lancer le serveur MCP

```bash
python binary-annotator-mcp.py
```

Ou avec uv :
```bash
uvx --from mcp --from httpx binary-annotator-mcp.py
```

### Configuration dans Claude Desktop

Ajouter dans `~/Library/Application Support/Claude/claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "binary-annotator": {
      "command": "python",
      "args": [
        "/path/to/binary-annotator-pro/mcp-server/binary-annotator-mcp.py"
      ],
      "env": {
        "BINARY_ANNOTATOR_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Ou avec uv :
```json
{
  "mcpServers": {
    "binary-annotator": {
      "command": "uvx",
      "args": [
        "--from",
        "mcp",
        "--from",
        "httpx",
        "/path/to/binary-annotator-pro/mcp-server/binary-annotator-mcp.py"
      ],
      "env": {
        "BINARY_ANNOTATOR_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Outils Disponibles

### 1. `list_binary_files`
Liste tous les fichiers binaires disponibles.

**Exemple d'utilisation dans Claude:**
> "Liste tous les fichiers binaires disponibles"

### 2. `read_binary_bytes`
Lit des bytes à un offset spécifique dans un fichier binaire.

**Paramètres:**
- `file_name` (requis): Nom du fichier
- `offset` (optionnel): Offset de départ (défaut: 0)
- `length` (optionnel): Nombre de bytes à lire (défaut: 256)

**Exemple:**
> "Lis les 128 premiers bytes du fichier ecg_data.bin"

### 3. `search_pattern`
Recherche un pattern dans un fichier binaire.

**Paramètres:**
- `file_name` (requis): Nom du fichier
- `value` (requis): Valeur à rechercher
- `search_type` (optionnel): Type de recherche (défaut: "hex")

**Types de recherche supportés:**
- `hex`: Pattern hexadécimal (ex: "FF 00 AA")
- `string-ascii`: Chaîne ASCII
- `string-utf8`: Chaîne UTF-8
- `int8`, `uint8`: Entiers 8 bits
- `int16le`, `int16be`: Entiers 16 bits (little/big endian)
- `uint16le`, `uint16be`: Entiers non signés 16 bits
- `int32le`, `int32be`: Entiers 32 bits
- `uint32le`, `uint32be`: Entiers non signés 32 bits
- `float32le`, `float32be`: Flottants 32 bits
- `float64le`, `float64be`: Flottants 64 bits
- `timestamp-unix32`, `timestamp-unix64`: Timestamps Unix

**Exemple:**
> "Cherche le pattern hex 'FF FF' dans ecg_data.bin"
> "Cherche la chaîne 'DICM' dans le fichier"
> "Trouve toutes les occurrences du nombre 500 (int16le)"

### 4. `get_file_info`
Obtient des informations détaillées sur un fichier binaire.

**Paramètres:**
- `file_name` (requis): Nom du fichier

**Retourne:**
- Taille du fichier
- Entropie de Shannon
- Analyse de fréquence des bytes
- Bytes les plus communs
- Preview du header

**Exemple:**
> "Donne-moi des infos sur ecg_data.bin"

### 5. `analyze_structure`
Analyse la structure d'un fichier binaire en détectant les patterns et l'entropie.

**Paramètres:**
- `file_name` (requis): Nom du fichier
- `block_size` (optionnel): Taille des blocs à analyser (défaut: 16)

**Retourne:**
- Magic bytes (4 premiers bytes)
- Carte d'entropie par blocs
- Analyse structurelle

**Exemple:**
> "Analyse la structure de ecg_data.bin"

### 6. `list_yaml_configs`
Liste toutes les configurations YAML disponibles.

**Exemple:**
> "Liste les configs YAML disponibles"

### 7. `get_yaml_config`
Récupère le contenu d'une configuration YAML.

**Paramètres:**
- `config_name` (requis): Nom de la configuration

**Exemple:**
> "Montre-moi la config YAML 'schiller_format'"

## Exemples d'Interactions

### Analyse complète d'un fichier
```
User: Analyse le fichier ecg_data.bin et dis-moi ce que tu en penses

Claude utilisera:
1. get_file_info("ecg_data.bin") - Pour les stats de base
2. analyze_structure("ecg_data.bin") - Pour la structure
3. read_binary_bytes("ecg_data.bin", 0, 512) - Pour voir le header
```

### Reverse engineering d'un format propriétaire
```
User: Je cherche des timestamps dans ce fichier ECG

Claude utilisera:
1. search_pattern("ecg.bin", "current_timestamp", "timestamp-unix32")
2. search_pattern("ecg.bin", "current_timestamp", "timestamp-unix64")
3. read_binary_bytes("ecg.bin", offset_trouvé, 64) - Pour le contexte
```

### Travail avec des configs YAML
```
User: Crée une config YAML pour parser ce fichier

Claude utilisera:
1. get_file_info("file.bin") - Analyser le fichier
2. analyze_structure("file.bin") - Détecter la structure
3. list_yaml_configs() - Voir les configs existantes comme exemples
```

## Architecture

```
┌─────────────────────┐
│   Claude Desktop    │
│   (ou autre LLM)    │
└──────────┬──────────┘
           │ MCP Protocol
┌──────────▼──────────┐
│  binary-annotator   │
│    MCP Server       │
│  (Python/stdio)     │
└──────────┬──────────┘
           │ HTTP REST API
┌──────────▼──────────┐
│  Binary Annotator   │
│    Backend API      │
│   (Go/Echo/SQLite)  │
└─────────────────────┘
```

## Développement

### Tester le serveur MCP

```bash
# Lancer le backend
cd backend
go run main.go

# Dans un autre terminal, tester le MCP server
cd mcp-server
python binary-annotator-mcp.py
```

### Ajouter un nouvel outil

1. Créer la fonction d'implémentation `_my_tool()`
2. L'enregistrer avec `@app.tool()` ou `@server.tool()`
3. Ajouter la documentation dans ce README

## Dépannage

### Le serveur ne se connecte pas à l'API
- Vérifier que le backend tourne sur le bon port
- Vérifier la variable d'environnement `BINARY_ANNOTATOR_API_URL`
- Tester l'API manuellement : `curl http://localhost:3000/health`

### Claude ne voit pas les outils
- Vérifier la configuration dans `claude_desktop_config.json`
- Relancer Claude Desktop
- Vérifier les logs dans `~/Library/Logs/Claude/`

### Erreurs Python
- Vérifier que `mcp` et `httpx` sont installés
- Utiliser Python 3.11+
- Essayer avec `uv` pour une meilleure gestion des dépendances

## Licence

Fait partie de Binary Annotator Pro
