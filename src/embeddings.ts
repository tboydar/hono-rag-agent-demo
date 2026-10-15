// Local embeddings via fastembed (ONNX, BAAI/bge-small-zh-v1.5, 512-dim).
// No external API needed — model downloads once into data/.fastembed-cache.

import { EmbeddingModel, FlagEmbedding } from "fastembed";
import { config } from "./config.js";

export const EMBED_DIM = 512;

let model: FlagEmbedding | null = null;
let initPromise: Promise<FlagEmbedding> | null = null;

export function getEmbedder(): Promise<FlagEmbedding> {
  if (model) return Promise.resolve(model);
  initPromise ??= FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
    cacheDir: config.embedCacheDir,
    showDownloadProgress: false,
  }).then((m) => (model = m));
  return initPromise;
}

function normalize(v: number[]): Float32Array {
  const out = new Float32Array(v.length);
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

export async function embedAll(texts: string[]): Promise<Float32Array[]> {
  const emb = await getEmbedder();
  const out: Float32Array[] = [];
  for await (const batch of emb.embed(texts, 16)) {
    for (const vec of batch) out.push(normalize(vec));
  }
  return out;
}

export async function embedOne(text: string): Promise<Float32Array> {
  return (await embedAll([text]))[0];
}
