export const config = {
  port: Number(process.env.PORT ?? 8788),
  host: process.env.HOST ?? "0.0.0.0",
  arliaiBaseUrl: process.env.ARLIAI_BASE_URL ?? "https://api.arliai.com/v1",
  chatModel: process.env.CHAT_MODEL ?? "DeepSeek-V4-Flash-0731",
  dbPath: process.env.DB_PATH ?? "data/kb.sqlite",
  seedDir: process.env.SEED_DIR ?? "data/seed-docs",
  embedCacheDir: process.env.EMBED_CACHE_DIR ?? "data/.fastembed-cache",
  topK: Number(process.env.TOP_K ?? 5),
  rrfK: 60,
};

export const DEMO_QUESTIONS = {
  chat: [
    "特休有幾天？要怎麼申請？",
    "VPN 要怎麼設定？",
    "IntentFlow 的 webhook 重試機制是什麼？",
    "發薪日是每個月幾號？午餐補助多少？",
    "收到釣魚信件要怎麼通報？",
  ],
  agent: [
    "幫我查王小明的特休餘額，然後幫他送一張下週一到週三的特休假單",
    "IntentFlow webhook 失敗會重試幾次？順便幫我開一張 P2 工單追蹤這個問題",
    "幫我查林志穎請假還剩幾天，還有他的分機號碼",
  ],
};
