# IntentFlow API 與整合

## API 概覽

- REST API：`https://api.intentflow.example.com/v1`
- 認證：`Authorization: Bearer <API Key>`，金鑰於後台「開發者設定」產生，可設定 scope（read / run / admin）
- 速率限制：Starter 60 req/min、Pro 600 req/min、Enterprise 3000 req/min；超過回傳 429 + Retry-After

## 常用端點

- `POST /v1/workflows/{id}/run`：觸發流程，支援同步（等待結果）與非同步（回傳 run_id）
- `GET /v1/runs/{run_id}`：查詢執行狀態與每節點輸出
- `POST /v1/kb/collections/{id}/documents`：上傳文件至知識庫（markdown、pdf、docx）
- `POST /v1/chat`：對指定 Agent 發送訊息（SSE 串流回覆）

## Webhooks

- 訂閱事件：`run.finished`、`run.failed`、`kb.document.indexed`
- 簽章：Header `X-IF-Signature` = HMAC-SHA256(body, secret)，請務必驗證
- 重試：5xx/逾時以 1m、5m、15m、1h、6h 重試共 5 次，失敗進入 DLQ

## SDK

- 官方 SDK：`@intentflow/sdk`（npm）、`intentflow`（PyPI）
- 範例：`npm i @intentflow/sdk`，`client.workflows.run(id, {input})`

## 錯誤碼

- 400 參數錯誤、401 金鑰無效、403 scope 不足、404 資源不存在、429 超過速率、500 平台錯誤
- 所有錯誤回傳 `{error: {code, message, trace_id}}`，除錯請附 trace_id
