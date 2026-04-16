import { hasDatabaseUrl } from "../../../../packages/db/src/index.ts";

export type AppConfig = {
  databaseUrl?: string;
  pineconeApiKey?: string;
  pineconeIndexHost?: string;
  pineconeNamespace?: string;
  geminiApiKey?: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  geminiEmbeddingOutputDimensionality?: number;
  geminiApiBaseUrl: string;
  defaultTopK: number;
  requestLogEnabled: boolean;
};

function normalizeGeminiEmbeddingModel(value?: string): string {
  if (!value || value === "text-embedding-004") {
    return "gemini-embedding-001";
  }
  return value;
}

function readEnv(name: string): string | undefined {
  const value =
    typeof process !== "undefined" && process.env
      ? process.env[name]
      : undefined;
  return value && value.trim() ? value.trim() : undefined;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = readEnv(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl: readEnv("DATABASE_URL"),
    pineconeApiKey: readEnv("PINECONE_API_KEY"),
    pineconeIndexHost: readEnv("PINECONE_INDEX_HOST"),
    pineconeNamespace: readEnv("PINECONE_NAMESPACE"),
    geminiApiKey: readEnv("GEMINI_API_KEY"),
    geminiModel: readEnv("GEMINI_MODEL") ?? "gemini-2.5-flash",
    geminiEmbeddingModel: normalizeGeminiEmbeddingModel(
      readEnv("GEMINI_EMBEDDING_MODEL"),
    ),
    geminiEmbeddingOutputDimensionality: readNumberEnv(
      "GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY",
      1024,
    ),
    geminiApiBaseUrl:
      readEnv("GEMINI_API_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta",
    defaultTopK: readNumberEnv("DEFAULT_TOP_K", 8),
    requestLogEnabled: readEnv("REQUEST_LOG_ENABLED") !== "false",
  };
}

export function configHealth(config: AppConfig) {
  return {
    database: Boolean(config.databaseUrl || hasDatabaseUrl),
    pinecone: Boolean(config.pineconeApiKey && config.pineconeIndexHost),
    gemini: Boolean(config.geminiApiKey),
  };
}
