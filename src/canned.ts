// Generate public/canned.json: run the real pipeline on the demo questions and
// record answers + sources + agent traces. Powers the offline demo mode on
// GitHub Pages when the backend isn't reachable.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { contentText, type Context } from "@earendil-works/pi-ai";
import { DEMO_QUESTIONS, config } from "./config.js";
import { getChatModel, getModels } from "./llm.js";
import { buildRag, RAG_SYSTEM_PROMPT } from "./rag.js";
import { runAgent, type AgentEvent } from "./agent.js";
import { seedIndex } from "./seed.js";
import { docCount } from "./store.js";

async function cannedChat(q: string) {
  const { sources, augmentedQuestion } = await buildRag(q);
  const ctx: Context = { systemPrompt: RAG_SYSTEM_PROMPT, messages: [{ role: "user", content: augmentedQuestion, timestamp: Date.now() }] };
  const msg = await getModels().complete(getChatModel(), ctx);
  return {
    q,
    answer: contentText(msg.content),
    sources: sources.map((s) => ({ doc: s.docTitle, heading: s.heading, score: s.score, via: s.via, snippet: s.text.slice(0, 200) })),
  };
}

async function cannedAgent(q: string) {
  const trace: AgentEvent[] = [];
  const answer = await runAgent(q, (e) => {
    trace.push(e);
  });
  return { q, answer, trace };
}

async function main() {
  if (docCount().chunks === 0) await seedIndex();
  const out = {
    generatedAt: new Date().toISOString(),
    model: config.chatModel,
    chat: [] as Awaited<ReturnType<typeof cannedChat>>[],
    agent: [] as Awaited<ReturnType<typeof cannedAgent>>[],
  };
  for (const q of DEMO_QUESTIONS.chat) {
    console.log(`chat: ${q}`);
    out.chat.push(await cannedChat(q));
  }
  for (const q of DEMO_QUESTIONS.agent) {
    console.log(`agent: ${q}`);
    out.agent.push(await cannedAgent(q));
  }
  mkdirSync(dirname("public/canned.json"), { recursive: true });
  writeFileSync("public/canned.json", JSON.stringify(out, null, 2));
  console.log(`wrote public/canned.json (${out.chat.length} chat + ${out.agent.length} agent answers)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
