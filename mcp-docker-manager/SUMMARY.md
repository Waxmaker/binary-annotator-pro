# MCP Docker Manager - Summary

## Problème Identifié

Le serveur MCP fonctionne parfaitement, mais l'implémentation Go utilisant l'API Docker (`ContainerCreate`, `ContainerAttach`, `ContainerStart`) ne permet pas au conteneur de rester actif avec stdin/stdout comme `docker run -it`.

## Preuve de Concept

Le script Python `test_concept.py` démontre que le concept proposé par l'utilisateur fonctionne parfaitement:
- Utilise `docker run -i` via subprocess
- Thread dédiée pour lire stdout
- Filtre automatique des messages non-JSON
- Communication JSON-RPC réussie avec le serveur MCP

## Solution Recommandée

**Option 1 (RECOMMANDÉE):** Utiliser `exec.Command("docker", "run", "-i", ...)` en Go au lieu de l'API Docker
- Plus simple et plus fiable
- Se comporte exactement comme le test Python qui fonctionne
- Pas de problèmes de multiplexage de streams

**Option 2:** Continuer à débugger l'API Docker Go
- Plus complexe
- Nécessite de comprendre les subtilités de TTY/stdin/multiplexing
- Problèmes mystérieux avec les logs qui n'apparaissent pas

## Prochaines Étapes

1. Refactoriser `manager/main.go` pour utiliser `os/exec` au lieu de l'API Docker
2. Implémenter une goroutine par serveur MCP (comme la thread Python)
3. Filtrer les messages non-JSON dans la goroutine
4. Utiliser des channels pour les réponses JSON

## Test Réussi

```bash
$ python3 test_concept.py
✅ SUCCESS! Le concept fonctionne!
```

Le serveur MCP répond correctement à la requête initialize via `docker run -i`.
