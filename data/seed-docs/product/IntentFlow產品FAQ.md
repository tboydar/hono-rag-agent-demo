# IntentFlow 產品 FAQ

IntentFlow 是曜昇科技的 AI 工作流平台，讓企業用拖拉方式建立 AI Agent 流程：知識庫問答、文件摘要、表單審核、客服分流。

## 計費方式

- Starter（免費）：每月 1,000 次流程執行、1 個 workspace、社群支援
- Pro：每席每月 NT$1,200，含 50,000 次執行、SLA 8x5
- Enterprise：客製報價，含專屬部署（VPC/on-prem）、SSO、SLA 24x7

超量費用：Pro 每 1,000 次 NT$20，於次月結算。

## 支援的模型

- OpenAI GPT 系列、Anthropic Claude、Google Gemini（BYOK 或平台代付）
- 自架模型：支援 OpenAI-compatible endpoint（vLLM、Ollama、ArliAI）

## Webhook 與整合

- 對外整合：Slack、LINE、Google Calendar、Notion、Webhook（自訂 header + HMAC 簽章）
- Inbound webhook：每個流程可產生專屬 URL 觸發執行
- Webhook 重試機制：HTTP 5xx 或逾時會以指數退避重試 5 次（1m、5m、15m、1h、6h），全部失敗後寫入 dead-letter queue，可在後台手動重送
- Webhook 逾時時間：30 秒

## 資料存放

- 台灣 GCP（asia-east1）為主站；Enterprise 可選 on-prem
- 對話與文件預設保留 90 天，Enterprise 可調整
- 支援匯出（JSON/CSV）與完整刪除（GDPR/個資法）

## 常見問題

- 流程執行失敗看哪裡？ → 後台「執行紀錄」每個節點都有 input/output 與錯誤訊息
- 可以多人協作嗎？ → Pro 以上支援多人編輯與版本歷史
- AI 回覆亂講怎麼辦？ → 開啟「知識庫引用模式」強制附來源，並可設信心門檻，低於門檻轉人工
