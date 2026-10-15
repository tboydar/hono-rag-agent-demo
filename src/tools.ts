// Agent tools: knowledge-base search + mock HR/IT systems.
// In a real deployment these would call the actual HRIS / ITSM APIs;
// here they read mock JSON and write into local SQLite so the demo is stateful.

import { Type, type Tool } from "@earendil-works/pi-ai";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getDb, listDocs, retrieve } from "./store.js";

interface Employee {
  name: string;
  dept: string;
  title: string;
  email: string;
  ext: string;
  joinDate: string;
}
interface LeaveBalance {
  name: string;
  annual: number;
  sick: number;
  personal: number;
  comp: number;
}

const employees = JSON.parse(readFileSync("data/mock/employees.json", "utf8")) as Employee[];
const leaveBalances = JSON.parse(readFileSync("data/mock/leave-balances.json", "utf8")) as LeaveBalance[];

export const tools: Tool[] = [
  {
    name: "kb_search",
    description: "搜尋企業知識庫（公司制度、IT SOP、產品文件）。輸入自然語言查詢，回傳最相關的文件片段。",
    parameters: Type.Object({
      query: Type.String({ description: "查詢內容，例如：特休申請流程、VPN 設定步驟" }),
    }),
  },
  {
    name: "employee_lookup",
    description: "查詢員工通訊錄：部門、職稱、email、分機。可用姓名或部門名稱查詢。",
    parameters: Type.Object({
      query: Type.String({ description: "員工姓名或部門名稱" }),
    }),
  },
  {
    name: "leave_balance",
    description: "查詢員工假勤餘額（特休、病假、事假、補休的剩餘天數）。",
    parameters: Type.Object({
      name: Type.String({ description: "員工姓名" }),
    }),
  },
  {
    name: "create_leave_request",
    description: "送出請假申請單。需要員工姓名、假別、起訖日期與事由。回傳假單編號。",
    parameters: Type.Object({
      name: Type.String({ description: "員工姓名" }),
      type: Type.String({ description: "假別：特休/病假/事假/補休" }),
      start: Type.String({ description: "開始日期 YYYY-MM-DD" }),
      end: Type.String({ description: "結束日期 YYYY-MM-DD" }),
      reason: Type.Optional(Type.String({ description: "請假事由" })),
    }),
  },
  {
    name: "create_it_ticket",
    description: "建立 IT/系統工單（例如報修、權限申請、問題追蹤）。回傳工單編號。",
    parameters: Type.Object({
      title: Type.String({ description: "工單標題" }),
      description: Type.String({ description: "問題描述" }),
      priority: Type.Optional(Type.String({ description: "優先級 P0/P1/P2/P3，預設 P2" })),
    }),
  },
];

function findEmployee(name: string): Employee | undefined {
  return employees.find((e) => e.name === name || e.name.includes(name) || name.includes(e.name));
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "kb_search": {
      const hits = await retrieve(String(args.query), 4);
      if (hits.length === 0) return "（知識庫沒有相關資料）";
      return hits.map((h, i) => `〔${i + 1}〕《${h.docTitle}》${h.heading ? `—${h.heading}` : ""}\n${h.text}`).join("\n\n");
    }
    case "employee_lookup": {
      const q = String(args.query);
      const byDept = employees.filter((e) => e.dept.includes(q));
      const one = findEmployee(q);
      const list = byDept.length > 0 ? byDept : one ? [one] : [];
      return list.length
        ? JSON.stringify(list, null, 1)
        : `找不到符合「${q}」的員工。通訊錄共 ${employees.length} 人。`;
    }
    case "leave_balance": {
      const emp = findEmployee(String(args.name));
      const bal = emp && leaveBalances.find((b) => b.name === emp.name);
      if (!emp) return `查無員工「${args.name}」。`;
      if (!bal) return `${emp.name} 沒有假勤資料。`;
      return JSON.stringify({ ...bal, dept: emp.dept }, null, 1);
    }
    case "create_leave_request": {
      const emp = findEmployee(String(args.name));
      if (!emp) return `查無員工「${args.name}」，假單未建立。`;
      const bal = leaveBalances.find((b) => b.name === emp.name);
      const typeMap: Record<string, keyof LeaveBalance> = { 特休: "annual", 病假: "sick", 事假: "personal", 補休: "comp" };
      const key = typeMap[String(args.type)];
      const id = `LV-${randomUUID().slice(0, 8).toUpperCase()}`;
      const days = daysBetween(String(args.start), String(args.end));
      if (bal && key && days > Number(bal[key])) {
        return `建立失敗：${emp.name} 的${args.type}餘額只有 ${bal[key]} 天，本次申請 ${days} 天。`;
      }
      getDb()
        .prepare("INSERT INTO leave_requests (id, employee, type, start, end, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, emp.name, String(args.type), String(args.start), String(args.end), String(args.reason ?? ""), "待主管核准", new Date().toISOString());
      if (bal && key) (bal[key] as number) -= days;
      return `假單已建立：${id}\n員工：${emp.name}（${emp.dept}）\n假別：${args.type}\n期間：${args.start} ~ ${args.end}（${days} 天）\n狀態：待主管核准`;
    }
    case "create_it_ticket": {
      const id = `IT-${randomUUID().slice(0, 8).toUpperCase()}`;
      const priority = String(args.priority ?? "P2");
      getDb()
        .prepare("INSERT INTO tickets (id, title, description, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, String(args.title), String(args.description), priority, "Open", new Date().toISOString());
      return `工單已建立：${id}\n標題：${args.title}\n優先級：${priority}\n狀態：Open（IT 團隊會在 SLA 內回覆）`;
    }
    default:
      return `未知工具：${name}`;
  }
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
  return Math.round((b - a) / 86_400_000) + 1;
}

export { employees, leaveBalances };
