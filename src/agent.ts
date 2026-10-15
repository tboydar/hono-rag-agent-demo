// AI Agent: pi-ai tool-calling loop over kb_search + mock HR/IT tools.
// Emits trace events so the UI can show each step (判斷 → 呼叫工具 → 結果).

import { contentText, type AssistantMessage, type Context } from "@earendil-works/pi-ai";
import { getChatModel, getModels } from "./llm.js";
import { runTool, tools } from "./tools.js";

const AGENT_PROMPT = `你是「曜昇科技」的企業內部 AI 助理「小意」。你可以呼叫工具來完成任務：
- kb_search：查公司制度、IT SOP、產品文件等知識庫內容
- employee_lookup：查員工通訊錄（部門、email、分機）
- leave_balance：查員工假勤餘額
- create_leave_request：送請假單
- create_it_ticket：開 IT 工單

規則：
1. 一律使用繁體中文回覆。
2. 需要即時資料（餘額、通訊錄）或執行動作（開單、請假）時，務必呼叫工具，不要憑印象回答。
3. 引用知識庫內容時標註文件來源名稱。
4. 需要但缺少必要資訊（例如員工姓名、日期）時，先問清楚再動作。
5. 完成工具呼叫後，用一段簡潔的總結回覆使用者：做了什麼、結果如何、相關單號。
6. 今天的日期：${new Date().toISOString().slice(0, 10)}（台北時間）。`;

export interface AgentEvent {
  type: "tool_call" | "tool_result" | "answer" | "error" | "round";
  round?: number;
  name?: string;
  args?: unknown;
  result?: string;
  text?: string;
  usage?: unknown;
}

const MAX_ROUNDS = 6;

export async function runAgent(question: string, emit: (e: AgentEvent) => void): Promise<string> {
  const models = getModels();
  const model = getChatModel();
  const context: Context = {
    systemPrompt: AGENT_PROMPT,
    messages: [{ role: "user", content: question, timestamp: Date.now() }],
    tools,
  };

  let answer = "";
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    emit({ type: "round", round });
    const msg: AssistantMessage = await models.complete(model, context);
    context.messages.push(msg);

    if (msg.stopReason === "error" || msg.errorMessage) {
      emit({ type: "error", text: msg.errorMessage ?? "LLM error" });
      break;
    }

    const calls = msg.content.filter((b) => b.type === "toolCall");
    if (calls.length === 0) {
      answer = contentText(msg.content);
      emit({ type: "answer", text: answer, usage: msg.usage });
      break;
    }

    for (const call of calls) {
      emit({ type: "tool_call", name: call.name, args: call.arguments });
      let result: string;
      let isError = false;
      try {
        result = await runTool(call.name, call.arguments as Record<string, unknown>);
      } catch (err) {
        isError = true;
        result = `工具執行失敗：${err instanceof Error ? err.message : String(err)}`;
      }
      emit({ type: "tool_result", name: call.name, result });
      context.messages.push({
        role: "toolResult",
        toolCallId: call.id,
        toolName: call.name,
        content: [{ type: "text", text: result }],
        isError,
        timestamp: Date.now(),
      });
    }
  }

  if (!answer) {
    answer = "（已達最大推理步數，請縮小問題範圍後重試。）";
    emit({ type: "answer", text: answer });
  }
  return answer;
}
