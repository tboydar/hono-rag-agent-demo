// Hono server: RAG chat + AI Agent, SSE streaming, static demo UI.

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { Context } from "@earendil-works/pi-ai";
import { config, DEMO_QUESTIONS } from "./config.js";
import { getChatModel, getModels, hasApiKey } from "./llm.js";
import { buildRag, RAG_SYSTEM_PROMPT } from "./rag.js";
import { docCount, listDocs, retrieve } from "./store.js";
import { runAgent } from "./agent.js";
import { seedIndex } from "./seed.js";

const app = new Hono();

app.use("/api/*", cors({ origin: "*" }));

interface HistoryMsg {
  role: "user" | "assistant";
  content: string;
}

function toContextMessages(history: HistoryMsg[]): Context["messages"] {
  return history.slice(-10).map((m) =>
    m.role === "user"
      ? { role: "user" as const, content: m.content, timestamp: Date.now() }
      : {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: m.content }],
          api: "openai-completions" as const,
          provider: "arliai",
          model: config.chatModel,
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          stopReason: "stop" as const,
          timestamp: Date.now(),
        },
  );
}

app.get("/api/health", (c) => c.json({ ok: true, model: config.chatModel, hasKey: hasApiKey(), ...docCount() }));

app.get("/api/config", (c) => c.json({ model: config.chatModel, hasKey: hasApiKey(), questions: DEMO_QUESTIONS }));

app.get("/api/docs", (c) => c.json({ docs: listDocs() }));

app.post("/api/search", async (c) => {
  const { q, topK } = await c.req.json<{ q: string; topK?: number }>();
  if (!q) return c.json({ error: "missing q" }, 400);
  return c.json({ q, results: await retrieve(q, topK ?? config.topK) });
});

app.post("/api/chat", async (c) => {
  const body = await c.req.json<{ q?: string; messages?: HistoryMsg[] }>();
  const history = body.messages ?? [];
  const q = body.q ?? [...history].reverse().find((m) => m.role === "user")?.content;
  if (!q) return c.json({ error: "missing q or messages" }, 400);
  if (!hasApiKey()) return c.json({ error: "ARLIAI_API_KEY not set" }, 503);

  return streamSSE(c, async (stream) => {
    const { sources, augmentedQuestion } = await buildRag(q);
    await stream.writeSSE({
      event: "sources",
      data: JSON.stringify(
        sources.map((s) => ({ doc: s.docTitle, heading: s.heading, score: s.score, via: s.via, snippet: s.text.slice(0, 200) })),
      ),
    });

    const ctx: Context = {
      systemPrompt: RAG_SYSTEM_PROMPT,
      messages: [...toContextMessages(history.slice(0, -1)), { role: "user", content: augmentedQuestion, timestamp: Date.now() }],
    };

    const s = getModels().stream(getChatModel(), ctx);
    let hadError = false;
    try {
      for await (const ev of s) {
        if (ev.type === "text_delta") await stream.writeSSE({ event: "token", data: JSON.stringify({ text: ev.delta }) });
        if (ev.type === "error") {
          hadError = true;
          await stream.writeSSE({ event: "error", data: JSON.stringify({ message: ev.error?.errorMessage ?? "stream error" }) });
        }
      }
      const final = await s.result();
      await stream.writeSSE({ event: "done", data: JSON.stringify({ usage: final.usage ?? null, stopReason: final.stopReason ?? null }) });
    } catch (err) {
      if (!hadError)
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: err instanceof Error ? err.message : String(err) }) });
    }
  });
});

app.post("/api/agent", async (c) => {
  const { q } = await c.req.json<{ q?: string }>();
  if (!q) return c.json({ error: "missing q" }, 400);
  if (!hasApiKey()) return c.json({ error: "ARLIAI_API_KEY not set" }, 503);

  return streamSSE(c, async (stream) => {
    try {
      const answer = await runAgent(q, (e) => {
        void stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
      });
      await stream.writeSSE({ event: "done", data: JSON.stringify({ answer }) });
    } catch (err) {
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: err instanceof Error ? err.message : String(err) }) });
    }
  });
});

app.post("/api/reindex", async (c) => {
  const stats = await seedIndex();
  return c.json({ ok: true, ...stats });
});

app.use("/*", serveStatic({ root: "./public" }));

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`hono-rag-agent-demo → http://localhost:${info.port}  (model: ${config.chatModel}, key: ${hasApiKey() ? "set" : "MISSING"})`);
});
