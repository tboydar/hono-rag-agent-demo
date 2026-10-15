// Retrieval eval: each test question should retrieve the expected doc in top-k.
// Quick sanity check that chunking + embeddings + hybrid fusion work.

import { retrieve, docCount } from "./store.js";
import { seedIndex } from "./seed.js";

const CASES: { q: string; expect: string }[] = [
  { q: "特休有幾天", expect: "請假" },
  { q: "怎麼申請 VPN", expect: "VPN" },
  { q: "發薪日", expect: "薪資" },
  { q: "webhook 重試", expect: "FAQ" },
  { q: "釣魚信通報", expect: "資訊安全" },
  { q: "報帳期限", expect: "差旅" },
  { q: "客訴 P0 的 SLA", expect: "客訴" },
  { q: "會議室借用", expect: "會議室" },
];

async function main() {
  if (docCount().chunks === 0) await seedIndex();
  let hit = 0;
  for (const { q, expect } of CASES) {
    const results = await retrieve(q, 5);
    const ok = results.some((r) => r.docTitle.includes(expect));
    hit += ok ? 1 : 0;
    console.log(`${ok ? "✓" : "✗"} "${q}" → ${results.map((r) => `${r.docTitle}(${r.via})`).join(", ") || "(no results)"}`);
  }
  console.log(`\nrecall@5: ${hit}/${CASES.length}`);
  process.exit(hit === CASES.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
