/**
 * 应用全局配置 (Global Configuration)
 * 
 * 职责：
 * 1. 管理 API 基础路径。
 * 2. 从环境变量中读取频率限制等配置项，并提供合理的默认值。
 */

import {
  DEFAULT_CHAT_RATE_LIMIT_PER_DAY,
  DEFAULT_CHAT_RATE_LIMIT_PER_MINUTE,
} from "shared";

// 默认 API 基础 URL（MVP 环境）
export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8788";

/**
 * 辅助函数：安全地从环境变量读取数字
 */
function readNumberEnv(
  value: string | undefined,
  fallback: number,
): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 聊天频率限制配置
 * 优先读取 NEXT_PUBLIC_ 开头的环境变量（暴露给前端）
 */
export const chatRateLimitConfig = {
  perMinute: readNumberEnv(
    process.env.NEXT_PUBLIC_CHAT_RATE_LIMIT_PER_MINUTE,
    DEFAULT_CHAT_RATE_LIMIT_PER_MINUTE,
  ),
  perDay: readNumberEnv(
    process.env.NEXT_PUBLIC_CHAT_RATE_LIMIT_PER_DAY,
    DEFAULT_CHAT_RATE_LIMIT_PER_DAY,
  ),
};
