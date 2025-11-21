#!/bin/bash

# Test script for MCP Docker Manager
set -e

BASE_URL="http://localhost:8080"

echo "🧪 MCP Docker Manager Test Suite"
echo "================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "  Response: $body"
else
    echo -e "${RED}✗ Health check failed (HTTP $http_code)${NC}"
    exit 1
fi
echo ""

# Test 2: List servers (should be empty initially)
echo -e "${YELLOW}Test 2: List Servers (Initial)${NC}"
response=$(curl -s "$BASE_URL/servers")
echo "  Servers: $response"
echo ""

# Test 3: Start filesystem server
echo -e "${YELLOW}Test 3: Start Filesystem MCP Server${NC}"
response=$(curl -s -X POST "$BASE_URL/servers/filesystem/start" \
    -H "Content-Type: application/json" \
    -d '{"image": "mcp/filesystem:latest"}')
echo "  Response: $response"

if echo "$response" | grep -q "server started"; then
    echo -e "${GREEN}✓ Filesystem server started${NC}"
else
    echo -e "${RED}✗ Failed to start filesystem server${NC}"
    echo "  Response: $response"
    exit 1
fi
echo ""

# Wait for server to initialize
echo "⏳ Waiting for server initialization..."
sleep 3
echo ""

# Test 4: List servers again (should show filesystem)
echo -e "${YELLOW}Test 4: List Servers (After Start)${NC}"
response=$(curl -s "$BASE_URL/servers")
echo "  Servers: $response"

if echo "$response" | grep -q "filesystem"; then
    echo -e "${GREEN}✓ Filesystem server is listed${NC}"
else
    echo -e "${RED}✗ Filesystem server not found in list${NC}"
    exit 1
fi
echo ""

# Test 5: Call a tool (read_file)
echo -e "${YELLOW}Test 5: Call MCP Tool (read_file on /etc/hosts)${NC}"
response=$(curl -s -X POST "$BASE_URL/servers/filesystem/call" \
    -H "Content-Type: application/json" \
    -d '{
        "tool": "read_file",
        "arguments": {
            "path": "/data"
        }
    }')
echo "  Response: $response"

if echo "$response" | grep -q "result"; then
    echo -e "${GREEN}✓ Tool call succeeded${NC}"
else
    echo -e "${YELLOW}⚠ Tool call response (check manually):${NC}"
    echo "  $response"
fi
echo ""

# Test 6: Stop the server
echo -e "${YELLOW}Test 6: Stop Filesystem Server${NC}"
response=$(curl -s -X POST "$BASE_URL/servers/filesystem/stop")
echo "  Response: $response"

if echo "$response" | grep -q "server stopped"; then
    echo -e "${GREEN}✓ Server stopped successfully${NC}"
else
    echo -e "${RED}✗ Failed to stop server${NC}"
    exit 1
fi
echo ""

# Test 7: Verify server is removed
echo -e "${YELLOW}Test 7: Verify Server Removed${NC}"
sleep 2
response=$(curl -s "$BASE_URL/servers")
echo "  Servers: $response"

if [ "$response" = "[]" ] || [ "$response" = "null" ]; then
    echo -e "${GREEN}✓ Server list is empty${NC}"
else
    echo -e "${YELLOW}⚠ Servers still present (may be expected):${NC}"
    echo "  $response"
fi
echo ""

echo "================================="
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Manual test commands:"
echo "  - List servers:     curl http://localhost:8080/servers"
echo "  - Start server:     curl -X POST http://localhost:8080/servers/filesystem/start -H 'Content-Type: application/json' -d '{\"image\": \"mcp/filesystem:latest\"}'"
echo "  - Call tool:        curl -X POST http://localhost:8080/servers/filesystem/call -H 'Content-Type: application/json' -d '{\"tool\": \"read_file\", \"arguments\": {\"path\": \"/data\"}}'"
echo "  - Stop server:      curl -X POST http://localhost:8080/servers/filesystem/stop"
