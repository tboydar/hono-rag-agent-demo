#!/usr/bin/env bash
# Demo script: exercise the API end-to-end.
BASE="${1:-http://localhost:8788}"

set -e
echo "== health =="
curl -s "$BASE/api/health" | jq .

echo -e "\n== docs =="
curl -s "$BASE/api/docs" | jq '.docs[] | {category, title}'

echo -e "\n== hybrid search: 特休有幾天 =="
curl -s -X POST "$BASE/api/search" -H 'content-type: application/json' \
  -d '{"q":"特休有幾天","topK":3}' | jq '.results[] | {doc: .docTitle, via, score}'

echo -e "\n== RAG chat (SSE) =="
curl -sN -X POST "$BASE/api/chat" -H 'content-type: application/json' \
  -d '{"q":"IntentFlow 的 webhook 重試機制是什麼？"}'

echo -e "\n\n== Agent (SSE) =="
curl -sN -X POST "$BASE/api/agent" -H 'content-type: application/json' \
  -d '{"q":"幫我查王小明的特休餘額，然後幫他送一張下週一到週三的特休假單"}'
echo
