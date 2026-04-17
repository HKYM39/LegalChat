/**
 * 对话速率限制 (Rate Limiting)
 * 
 * 职责：
 * 1. 提供内存级别的限流实现，支持按分钟和按天的配额检查。
 * 2. 支持根据会话 ID (conversationId) 或 IP 地址进行限流标识解析。
 * 3. 达到限流阈值时抛出 429 AppError。
 */
import {
  CHAT_RATE_LIMIT_ERROR_CODE,
  type ChatRateLimitDetails,
  type ChatRateLimitWindow,
} from "../../../../packages/shared/src/index.ts";

import { AppError } from "./errors";

/**
 * 限流配置项
 */
type ChatRateLimitConfig = {
  perMinute: number; // 每分钟最大消息数
  perDay: number;    // 每天最大消息数
  logEnabled: boolean; // 是否开启限流日志
};

/**
 * 限流主体状态
 */
type SubjectState = {
  minuteTimestamps: number[]; // 存储最近一分钟内的请求时间戳
  dayKey: string;           // 当前处理的天 (YYYY-MM-DD)
  dayCount: number;         // 当天已请求总数
};

/**
 * 限流检查输入
 */
type RateLimitCheckInput = {
  subjectKey: string; // 标识用户或会话的唯一键
  now?: number;
};

/**
 * 限流检查结果
 */
type RateLimitCheckResult = {
  allowed: true;
} | {
  allowed: false;
  details: ChatRateLimitDetails;
};

const ONE_MINUTE_MS = 60_000;
const ONE_DAY_SECONDS = 86_400;

/**
 * 获取日期的 YYYY-MM-DD 字符串键
 */
function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 计算 UTC 当天的结束时间（即下一天的 00:00:00）
 */
function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * 构建限流详情对象
 */
function buildLimitDetails(input: {
  limit: number;
  window: ChatRateLimitWindow;
  retryAfterSeconds: number;
  resetAt: Date;
}): ChatRateLimitDetails {
  return {
    window: input.window,
    limit: input.limit,
    retryAfterSeconds: Math.max(1, input.retryAfterSeconds),
    resetAt: input.resetAt.toISOString(),
  };
}

/**
 * 生成限流提示消息
 */
export function createChatRateLimitMessage(details: ChatRateLimitDetails): string {
  if (details.window === "minute") {
    return `Chat rate limit exceeded. You can send at most ${details.limit} messages per minute.`;
  }

  return `Chat rate limit exceeded. You can send at most ${details.limit} messages per day.`;
}

/**
 * 基于内存的对话限流器实现
 */
export class InMemoryChatRateLimiter {
  // 使用 Map 维护不同主体的限流状态
  private readonly subjects = new Map<string, SubjectState>();

  constructor(private readonly config: ChatRateLimitConfig) {}

  /**
   * 检查并消耗一次配额
   */
  checkAndConsume(input: RateLimitCheckInput): RateLimitCheckResult {
    const nowMs = input.now ?? Date.now();
    const now = new Date(nowMs);
    const dayKey = getDayKey(now);
    const minuteWindowStart = nowMs - ONE_MINUTE_MS;
    
    // 获取或初始化该主体的限流状态
    const existing = this.subjects.get(input.subjectKey);
    const state: SubjectState = existing
      ? {
          // 清理超过一分钟的时间戳
          minuteTimestamps: existing.minuteTimestamps.filter(
            (timestamp) => timestamp > minuteWindowStart,
          ),
          // 跨天时重置计数器
          dayKey: existing.dayKey === dayKey ? existing.dayKey : dayKey,
          dayCount: existing.dayKey === dayKey ? existing.dayCount : 0,
        }
      : {
          minuteTimestamps: [],
          dayKey,
          dayCount: 0,
        };

    // 1. 分钟级限流检查
    if (state.minuteTimestamps.length >= this.config.perMinute) {
      const oldestTimestamp = state.minuteTimestamps[0] ?? nowMs;
      const resetAt = new Date(oldestTimestamp + ONE_MINUTE_MS);
      const details = buildLimitDetails({
        window: "minute",
        limit: this.config.perMinute,
        retryAfterSeconds: Math.ceil((resetAt.getTime() - nowMs) / 1000),
        resetAt,
      });
      return { allowed: false, details };
    }

    // 2. 天级限流检查
    if (state.dayCount >= this.config.perDay) {
      const resetAt = endOfUtcDay(now);
      const details = buildLimitDetails({
        window: "day",
        limit: this.config.perDay,
        retryAfterSeconds: Math.ceil((resetAt.getTime() - nowMs) / 1000),
        resetAt,
      });
      return { allowed: false, details };
    }

    // 3. 消耗配额
    state.minuteTimestamps.push(nowMs);
    state.dayCount += 1;
    this.subjects.set(input.subjectKey, state);

    return { allowed: true };
  }

  /**
   * 强制执行限流检查，若超出配额则直接抛出 AppError
   */
  enforce(subjectKey: string): void {
    const result = this.checkAndConsume({ subjectKey });
    if (result.allowed) {
      return;
    }

    // 可选：记录限流触发日志
    if (this.config.logEnabled) {
      console.warn(
        JSON.stringify({
          event: "chat_rate_limit_exceeded",
          subjectKey,
          window: result.details.window,
          limit: result.details.limit,
          retryAfterSeconds: result.details.retryAfterSeconds,
          resetAt: result.details.resetAt,
        }),
      );
    }

    // 抛出 429 状态码的错误
    throw new AppError(
      429,
      CHAT_RATE_LIMIT_ERROR_CODE,
      createChatRateLimitMessage(result.details),
      result.details,
    );
  }
}

/**
 * 解析限流标识符 (Subject)
 * 
 * 优先级：
 * 1. 会话 ID (conversationId)
 * 2. 客户端 IP (Cloudflare 代理头或 X-Forwarded-For)
 * 3. 默认回退值 (anonymous)
 */
export function resolveChatRateLimitSubject(input: {
  conversationId?: string;
  forwardedFor?: string | null;
  cfConnectingIp?: string | null;
  fallback?: string;
}): string {
  if (input.conversationId?.trim()) {
    return `conversation:${input.conversationId.trim()}`;
  }

  const ip = input.cfConnectingIp?.trim() || input.forwardedFor?.split(",")[0]?.trim();
  if (ip) {
    return `ip:${ip}`;
  }

  return input.fallback ?? "anonymous";
}

export { CHAT_RATE_LIMIT_ERROR_CODE };
