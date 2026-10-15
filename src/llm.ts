// LLM layer: pi-ai unified API with ArliAI as an OpenAI-compatible provider.
// Auth resolves from ARLIAI_API_KEY env var (or `pi`-managed credentials if wired).

import { createModels, createProvider, envApiKeyAuth, type Model, type MutableModels } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { config } from "./config.js";

const ARLIAI_MODELS: Model<"openai-completions">[] = [
  {
    id: "DeepSeek-V4-Flash-0731",
    name: "DeepSeek V4 Flash (ArliAI)",
    api: "openai-completions",
    provider: "arliai",
    baseUrl: config.arliaiBaseUrl,
    input: ["text"],
    reasoning: true,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  },
  {
    id: "GLM-4.7",
    name: "GLM 4.7 (ArliAI)",
    api: "openai-completions",
    provider: "arliai",
    baseUrl: config.arliaiBaseUrl,
    input: ["text"],
    reasoning: true,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 8_192,
  },
  {
    id: "GLM-4.6-Derestricted-v5",
    name: "GLM 4.6 (ArliAI)",
    api: "openai-completions",
    provider: "arliai",
    baseUrl: config.arliaiBaseUrl,
    input: ["text"],
    reasoning: true,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 8_192,
  },
];

let models: MutableModels | null = null;

export function getModels(): MutableModels {
  if (models) return models;
  models = createModels();
  models.setProvider(
    createProvider({
      id: "arliai",
      name: "ArliAI",
      baseUrl: config.arliaiBaseUrl,
      auth: { apiKey: envApiKeyAuth("ArliAI API key", ["ARLIAI_API_KEY"]) },
      models: ARLIAI_MODELS,
      api: openAICompletionsApi(),
    }),
  );
  return models;
}

export function getChatModel(): Model<"openai-completions"> {
  const m = getModels().getModel("arliai", config.chatModel);
  if (!m || !("api" in m) || m.api !== "openai-completions") {
    throw new Error(`model not found: arliai/${config.chatModel} (available: ${ARLIAI_MODELS.map((x) => x.id).join(", ")})`);
  }
  return m as Model<"openai-completions">;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ARLIAI_API_KEY);
}
