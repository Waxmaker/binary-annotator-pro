#!/bin/sh

# MCP Server Entrypoint Wrapper
# This script ensures stdin stays open for MCP communication

# Suppress Node.js warnings
export NODE_NO_WARNINGS=1

# Log startup to stderr only (not stdout, to avoid polluting JSON-RPC)
echo "[MCP Filesystem Server] Starting on stdio..." >&2

# Run the MCP server
# The server will read JSON-RPC from stdin and write responses to stdout
# Some startup messages may appear on stdout - the Go manager filters these
exec npx -y @modelcontextprotocol/server-filesystem /data
