# hono-rag-agent-demo

企業內部 AI 助理 demo —— 用 **Hono + pi-ai + ArliAI** 打造的 **Hybrid RAG 知識庫問答** 與 **Tool-calling AI Agent**。

> 靈感來自企業 AI 導入職缺的核心需求：RAG 檢索增強生成、AI Agent 開發、LLM 應用串接、企業知識管理。
> 所有資料皆為虛構公司「曜昇科技」的測試資料（15 份制度文件 + mock HR 系統）。

## Demo 兩大功能

| 模式 | 說明 | 技術點 |
|---|---|---|
| **RAG 知識庫問答** | 對公司制度 / IT SOP / 產品文件提問，回答附引用來源 | Hybrid retrieval：向量語意（BGE-small-zh）+ BM25 關鍵字（CJK bigram）→ RRF 融合；SSE 逐字串流 |
| **AI Agent「小意」** | 查假勤餘額、送請假單、開 IT 工單、查通訊錄、搜知識庫 | pi-ai tool calling + 多輪推理迴圈 + 執行追蹤（trace） |

## 架構

```
public/index.html          靜態前端（GitHub Pages）── 離線 canned 模式備援
       │  POST /api/chat (SSE)      POST /api/agent (SSE)
       ▼
src/server.ts              Hono router + CORS + SSE
       │
       ├─ src/rag.ts       檢索 → context 組裝 → 引用格式
       │     └─ src/store.ts        node:sqlite + 向量 cosine + BM25 + RRF
       │          ├─ src/embeddings.ts   fastembed · BAAI/bge-small-zh-v1.5（本地 ONNX）
       │          ├─ src/bm25.ts        Okapi BM25
       │          └─ src/tokenizer.ts   CJK unigram+bigram / latin word
       │
       ├─ src/agent.ts     tool-calling loop（最多 6 輪，事件追蹤）
       │     └─ src/tools.ts        kb_search / employee_lookup / leave_balance /
       │                           create_leave_request / create_it_ticket
       │
       └─ src/llm.ts       @earendil-works/pi-ai
                              └─ ArliAI (OpenAI-compatible) ─ DeepSeek-V4-Flash-0731
```

## Quickstart

```bash
npm install
cp .env.example .env          # 填入 ARLIAI_API_KEY（https://arliai.com 取得）
npm run seed                  # 建立向量索引（首次會下載約 100MB 的 embedding 模型）
npm run dev                   # http://localhost:8788
```

開啟 http://localhost:8788 即是完整 demo UI；也可跑 `npm run demo` 用 curl 看 SSE 輸出。

### 常用指令

| 指令 | 用途 |
|---|---|
| `npm run seed` | 重建知識庫索引（chunk → embed → sqlite） |
| `npm run eval` | 檢索品質評估（recall@5，目前 8/8） |
| `npm run canned` | 產生 `public/canned.json`（GitHub Pages 離線展示用） |
| `npm run demo` | curl 巡一遍所有 endpoint |

## API

| Method | Path | 說明 |
|---|---|---|
| GET | `/api/health` | 狀態（模型、文件數、chunk 數） |
| GET | `/api/config` | demo 問題清單與模型名稱 |
| GET | `/api/docs` | 已索引文件列表 |
| POST | `/api/search` | `{q, topK}` → hybrid 檢索結果（含 via 標記） |
| POST | `/api/chat` | `{q, messages?}` → SSE：`sources` → `token`* → `done` |
| POST | `/api/agent` | `{q}` → SSE：`round`/`tool_call`/`tool_result` → `answer` → `done` |
| POST | `/api/reindex` | 重新建立索引 |

## 部署

- **GitHub Pages**：`public/` 為純靜態前端，push 到 `main` 由 Actions 自動發佈。前端會依序嘗試 `?api=` 參數 → localStorage → 本機 `localhost:8788`；連不上則進入**離線展示模式**（播放 canned.json 預錄問答）。
- **後端（任何 Docker 主機）**：`docker build -t demo . && docker run -e ARLIAI_API_KEY=xxx -p 8080:8080 demo`，支援 Zeabur / Render / Fly.io。
- **臨時公開 demo**：`cloudflared tunnel --url http://localhost:8788` 取得 `*.trycloudflare.com` 網址，貼到前端 API base 即可。

## 為什麼這樣設計

- **Hybrid retrieval 而非純向量**：制度文件常有精確名詞（統編、SLA、P0），BM25 補向量模型的盲點；CJK 用 bigram tokenizer 避免分詞器落差。
- **本地 embeddings**：知識庫向量不經外部 API，呼應「企業資料不出內網」的導入場景；只有最終回答走 LLM。
- **pi-ai 作為 LLM 抽象層**：換 provider 只需改一個 model id，同一套程式碼可切到 OpenAI / Anthropic / Groq / 自架 vLLM。
- **Agent 與 RAG 分層**：RAG 是只讀問答；Agent 才賦予寫入權（開單、請假），並保留完整 tool-call 追蹤供稽核。
