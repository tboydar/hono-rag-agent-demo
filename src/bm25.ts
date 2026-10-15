// Minimal BM25 (Okapi) over pre-tokenized documents.

export class BM25 {
  private k1 = 1.2;
  private b = 0.75;
  private df = new Map<string, number>();
  private tfs: Map<string, number>[] = [];
  private dl: number[] = [];
  private avgdl = 0;
  readonly size: number;

  constructor(docs: string[][]) {
    this.size = docs.length;
    let total = 0;
    for (const doc of docs) {
      const freq = new Map<string, number>();
      for (const t of doc) freq.set(t, (freq.get(t) ?? 0) + 1);
      this.tfs.push(freq);
      this.dl.push(doc.length);
      total += doc.length;
      for (const t of freq.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgdl = total / Math.max(1, docs.length);
  }

  private idf(t: string): number {
    const n = this.df.get(t) ?? 0;
    return Math.log(1 + (this.size - n + 0.5) / (n + 0.5));
  }

  search(queryTokens: string[], topK: number): { index: number; score: number }[] {
    const scores: { index: number; score: number }[] = [];
    for (let i = 0; i < this.size; i++) {
      const tf = this.tfs[i];
      let score = 0;
      for (const t of queryTokens) {
        const f = tf.get(t);
        if (!f) continue;
        const idf = this.idf(t);
        score += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * this.dl[i]) / this.avgdl)));
      }
      if (score > 0) scores.push({ index: i, score });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}
