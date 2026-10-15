// SQLite-backed knowledge store + hybrid retrieval (vector cosine + BM25, RRF-fused).

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";
import { embedOne } from "./embeddings.js";
import { tokenize } from "./tokenizer.js";
import { BM25 } from "./bm25.js";

export interface DocRow {
  id: number;
  path: string;
  title: string;
  category: string;
  content: string;
}

export interface ChunkRow {
  id: number;
  doc_id: number;
  ord: number;
  heading: string;
  text: string;
}

export interface RetrievedChunk {
  chunkId: number;
  docId: number;
  docTitle: string;
  category: string;
  heading: string;
  text: string;
  score: number;
  via: string; // "vector", "bm25", "vector+bm25"
}

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(config.dbPath), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE,
      title TEXT,
      category TEXT,
      content TEXT
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY,
      doc_id INTEGER REFERENCES docs(id) ON DELETE CASCADE,
      ord INTEGER,
      heading TEXT,
      text TEXT,
      vec BLOB,
      tokens TEXT
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      priority TEXT,
      status TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      employee TEXT,
      type TEXT,
      start TEXT,
      end TEXT,
      reason TEXT,
      status TEXT,
      created_at TEXT
    );
  `);
  return db;
}

export function resetIndex(): void {
  const d = getDb();
  d.exec("DELETE FROM chunks; DELETE FROM docs;");
  invalidateCache();
}

export function insertDoc(path: string, title: string, category: string, content: string): number {
  const r = getDb()
    .prepare("INSERT INTO docs (path, title, category, content) VALUES (?, ?, ?, ?)")
    .run(path, title, category, content);
  return Number(r.lastInsertRowid);
}

export function insertChunk(docId: number, ord: number, heading: string, text: string, vec: Float32Array): void {
  getDb()
    .prepare("INSERT INTO chunks (doc_id, ord, heading, text, vec, tokens) VALUES (?, ?, ?, ?, ?, ?)")
    .run(docId, ord, heading, text, Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength), JSON.stringify(tokenize(text)));
}

export function listDocs(): DocRow[] {
  return getDb()
    .prepare("SELECT id, path, title, category, substr(content, 1, 160) AS content FROM docs ORDER BY category, path")
    .all() as unknown as DocRow[];
}

export function docCount(): { docs: number; chunks: number } {
  const d = getDb();
  const docs = (d.prepare("SELECT COUNT(*) c FROM docs").get() as { c: number }).c;
  const chunks = (d.prepare("SELECT COUNT(*) c FROM chunks").get() as { c: number }).c;
  return { docs, chunks };
}

// ---------- in-memory retrieval structures ----------

interface ChunkEntry {
  row: ChunkRow & { doc_title: string; category: string };
  vec: Float32Array;
  tokens: string[];
}

let cache: { entries: ChunkEntry[]; bm25: BM25 } | null = null;

export function invalidateCache(): void {
  cache = null;
}

function loadIndex(): { entries: ChunkEntry[]; bm25: BM25 } {
  if (cache) return cache;
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.doc_id, c.ord, c.heading, c.text, c.vec, c.tokens, d.title AS doc_title, d.category
       FROM chunks c JOIN docs d ON d.id = c.doc_id ORDER BY c.id`,
    )
    .all() as unknown as (ChunkRow & { doc_title: string; category: string; vec: Uint8Array; tokens: string })[];
  const entries: ChunkEntry[] = rows.map((r) => ({
    row: r,
    vec: new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4),
    tokens: JSON.parse(r.tokens) as string[],
  }));
  cache = { entries, bm25: new BM25(entries.map((e) => e.tokens)) };
  return cache;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function retrieve(query: string, topK = config.topK): Promise<RetrievedChunk[]> {
  const { entries, bm25 } = loadIndex();
  if (entries.length === 0) return [];

  const [qvec, qtokens] = [await embedOne(query), tokenize(query)];

  const vecRanked = entries
    .map((e, i) => ({ index: i, score: cosine(qvec, e.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK * 2);

  const bm25Ranked = bm25.search(qtokens, topK * 2);

  // Reciprocal Rank Fusion
  const fused = new Map<number, { score: number; via: Set<string> }>();
  vecRanked.forEach((r, rank) => {
    const f = fused.get(r.index) ?? { score: 0, via: new Set<string>() };
    f.score += 1 / (config.rrfK + rank + 1);
    f.via.add("vector");
    fused.set(r.index, f);
  });
  bm25Ranked.forEach((r, rank) => {
    const f = fused.get(r.index) ?? { score: 0, via: new Set<string>() };
    f.score += 1 / (config.rrfK + rank + 1);
    f.via.add("bm25");
    fused.set(r.index, f);
  });

  return [...fused.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topK)
    .map(([index, f]) => {
      const e = entries[index];
      return {
        chunkId: e.row.id,
        docId: e.row.doc_id,
        docTitle: e.row.doc_title,
        category: e.row.category,
        heading: e.row.heading,
        text: e.row.text,
        score: Math.round(f.score * 10000) / 10000,
        via: [...f.via].sort().join("+"),
      };
    });
}
