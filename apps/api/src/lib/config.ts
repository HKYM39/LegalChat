/**
 * 应用配置管理
 * 
 * 职责：
 * 1. 从环境变量中加载应用所需的各项配置（DB、AI、RateLimit 等）。
 * 2. 提供默认值与基础的类型转换处理。
 * 3. 提供健康状态检查所需的配置快照。
 */
import { hasDatabaseUrl } from "../../../../packages/db/src/index.ts";
import {
  DEFAULT_CHAT_RATE_LIMIT_PER_DAY,
  DEFAULT_CHAT_RATE_LIMIT_PER_MINUTE,
} from "../../../../packages/shared/src/index.ts";

/**
 * 应用全局配置类型定义
 */
export type AppConfig = {
  // 数据库连接 URL (PostgreSQL)
  databaseUrl?: string;
  // Pinecone 向量数据库配置
  pineconeApiKey?: string;
  pineconeIndexHost?: string;
  pineconeNamespace?: string;
  // Gemini AI 模型配置
  geminiApiKey?: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  geminiEmbeddingOutputDimensionality?: number;
  geminiApiBaseUrl: string;
  // 检索参数配置
  defaultTopK: number;
  // 系统运行配置
  requestLogEnabled: boolean;
  // 对话速率限制配置
  chatRateLimitPerMinute: number;
  chatRateLimitPerDay: number;
};

/**
 * 规范化嵌入模型名称
 */
function normalizeGeminiEmbeddingModel(value?: string): string {
  if (!value || value === "text-embedding-004") {
    return "gemini-embedding-001";
  }
  return value;
}

/**
 * 读取环境变量值
 */
function readEnv(name: string): string | undefined {
  const value =
    typeof process !== "undefined" && process.env
      ? process.env[name]
      : undefined;
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * 读取数值型环境变量，若无效则返回回退值
 */
function readNumberEnv(name: string, fallback: number): number {
  const value = readEnv(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 加载应用完整配置
 * 
 * 对应 PRD 2.0 中定义的 Hono 在线 API 层所需的环境依赖。
 */
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
    chatRateLimitPerMinute: readNumberEnv(
      "CHAT_RATE_LIMIT_PER_MINUTE",
      DEFAULT_CHAT_RATE_LIMIT_PER_MINUTE,
    ),
    chatRateLimitPerDay: readNumberEnv(
      "CHAT_RATE_LIMIT_PER_DAY",
      DEFAULT_CHAT_RATE_LIMIT_PER_DAY,
    ),
  };
}

/**
 * 获取服务配置的健康概要，用于 /health 接口
 */
export function configHealth(config: AppConfig) {
  return {
    database: Boolean(config.databaseUrl || hasDatabaseUrl),
    pinecone: Boolean(config.pineconeApiKey && config.pineconeIndexHost),
    gemini: Boolean(config.geminiApiKey),
  };
}
