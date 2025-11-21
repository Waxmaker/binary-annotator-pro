#!/usr/bin/env bash

API="http://localhost:3003"

echo "🔍 1. Testing health endpoint..."
curl -s "$API/health"
echo -e "\n----------------------------------"

echo "📝 2. Testing index document endpoint..."
curl -s -X POST "$API/index/document" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "document",
    "title": "Test Document",
    "content": "This is a test document for the RAG service. It contains information about binary file analysis and ECG data processing. This content will be split into chunks and indexed for semantic search.",
    "source": "user:test",
    "metadata": {
      "user_id": "1",
      "file_type": ".txt"
    },
    "chunk_tokens": 256,
    "overlap_tokens": 50
  }'
echo -e "\n----------------------------------"

echo "🔎 3. Testing search endpoint..."
curl -s -X POST "$API/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is ECG data processing?",
    "max_results": 3,
    "min_score": 0.1
  }'
echo -e "\n----------------------------------"

echo "📋 4. Listing all documents..."
curl -s "$API/documents"
echo -e "\n----------------------------------"

echo "📊 5. Getting stats..."
curl -s "$API/stats"
echo -e "\n----------------------------------"

echo "🗑️ 6. Testing delete document endpoint..."
curl -s -X DELETE "$API/document/1"
echo -e "\n----------------------------------"

echo "✅ All endpoint tests completed!"
