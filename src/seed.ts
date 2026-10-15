// Seed: load markdown docs from data/seed-docs, chunk, embed, store in SQLite.
// Idempotent — wipes and rebuilds the index every run.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chunkMarkdown } from "./chunking.js";
import { embedAll } from "./embeddings.js";
import { docCount, getDb, insertChunk, insertDoc, resetIndex } from "./store.js";
import { config } from "./config.js";

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith(".md")) yield p;
  }
}

export async function seedIndex(): Promise<{ docs: number; chunks: number }> {
  const t0 = Date.now();
  getDb();
  resetIndex();

  let chunkCount = 0;
  for (const path of walk(config.seedDir)) {
    const markdown = readFileSync(path, "utf8");
    const category = path.split("/").slice(-2, -1)[0] ?? "misc";
    const { title, chunks } = chunkMarkdown(markdown);
    const docId = insertDoc(path.replace(`${config.seedDir}/`, ""), title || path, category, markdown);
    // prepend title+heading so retrieval matches both semantics and keywords
    const texts = chunks.map((c) => `${title}\n${c.heading}\n${c.text}`);
    const vecs = await embedAll(texts);
    chunks.forEach((c, i) => insertChunk(docId, i, c.heading, c.text, vecs[i]));
    chunkCount += chunks.length;
    console.log(`  ${title} (${category}) → ${chunks.length} chunks`);
  }

  const stats = docCount();
  console.log(`indexed ${stats.docs} docs / ${stats.chunks} chunks in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedIndex().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
