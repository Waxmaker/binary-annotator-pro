#!/bin/sh

# Binary Annotator MCP Server Entrypoint
# This script ensures stdin stays open for MCP communication

# Suppress Python warnings
export PYTHONUNBUFFERED=1

# Log startup to stderr only (not stdout, to avoid polluting JSON-RPC)
echo "[MCP Binary Annotator Server] Starting on stdio..." >&2
echo "[MCP Binary Annotator Server] API URL: ${BINARY_ANNOTATOR_API_URL}" >&2

# Run the MCP server
# The server will read JSON-RPC from stdin and write responses to stdout
exec python /app/binary_annotator_mcp.py
