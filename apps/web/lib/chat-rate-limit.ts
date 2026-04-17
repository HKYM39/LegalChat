/**
 * 客户端聊天频率限制 (Client-side Chat Rate Limiting)
 * 
 * 职责：
 * 1. 使用 localStorage 在浏览器端记录用户的消息发送频率。
 * 2. 提供“每分钟”和“每天”两个维度的限制逻辑，防止 API 被过度消耗。
 * 3. 生成人性化的频率限制提示消息。
 * 4. 维护稳定的客户端 ID，用于后端链路追踪和频率统计。
 */
"use client";

import {
  CHAT_RATE_LIMIT_ERROR_CODE,
  type ChatRateLimitDetails,
} from "shared";

import { chatRateLimitConfig } from "@/lib/config";

// localStorage 存储键名
const STORAGE_KEY = "casebase.chat.rate-limit";
const CLIENT_ID_STORAGE_KEY = "casebase.chat.client-id";

/**
 * 存储在本地的频率限制状态结构
 */
type StoredRateLimitState = {
  // 客户端唯一 ID
  clientId: string;
  // 最近一分钟内发送消息的时间戳列表
  minuteTimestamps: number[];
  // 当前记录的日期 Key (YYYY-MM-DD)
  dayKey: string;
  // 当日已发送消息总数
  dayCount: number;
};

/**
 * 频率检查结果类型
 */
type LocalRateLimitCheck =
  | {
      allowed: true; // 允许发送
      clientId: string;
    }
  | {
      allowed: false; // 已达上限
      clientId: string;
      details: ChatRateLimitDetails; // 限制详情（包含重试时间等）
    };

/**
 * 安全获取 localStorage 对象
 */
function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

/**
 * 获取日期 Key (YYYY-MM-DD)
 */
function getDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * 获取当日 UTC 时间的结束点（次日 00:00:00）
 */
function getEndOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * 获取或创建持久化的客户端 ID
 */
function getOrCreateClientId(): string {
  const storage = getStorage();
  const existing = storage?.getItem(CLIENT_ID_STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }

  const nextClientId = crypto.randomUUID();
  storage?.setItem(CLIENT_ID_STORAGE_KEY, nextClientId);
  return nextClientId;
}

/**
 * 从 localStorage 读取当前频率限制状态
 */
function readState(now: Date): StoredRateLimitState {
  const storage = getStorage();
  const clientId = getOrCreateClientId();
  const dayKey = getDayKey(now);
  const raw = storage?.getItem(STORAGE_KEY);

  if (!raw) {
    return {
      clientId,
      minuteTimestamps: [],
      dayKey,
      dayCount: 0,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredRateLimitState>;
    // 清理无效数据，仅保留数字时间戳
    const minuteTimestamps = Array.isArray(parsed.minuteTimestamps)
      ? parsed.minuteTimestamps.filter((value): value is number =>
          typeof value === "number" && Number.isFinite(value),
        )
      : [];

    return {
      clientId,
      minuteTimestamps,
      // 如果存储的日期不是今天，则重置当日计数
      dayKey: parsed.dayKey === dayKey ? dayKey : dayKey,
      dayCount:
        parsed.dayKey === dayKey && typeof parsed.dayCount === "number"
          ? parsed.dayCount
          : 0,
    };
  } catch {
    return {
      clientId,
      minuteTimestamps: [],
      dayKey,
      dayCount: 0,
    };
  }
}

/**
 * 将频率限制状态写回 localStorage
 */
function writeState(state: StoredRateLimitState): void {
  const storage = getStorage();
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 构建频率限制详情对象
 */
function createRateLimitDetails(
  window: ChatRateLimitDetails["window"],
  limit: number,
  retryAfterSeconds: number,
  resetAt: Date,
): ChatRateLimitDetails {
  return {
    window,
    limit,
    retryAfterSeconds: Math.max(1, retryAfterSeconds),
    resetAt: resetAt.toISOString(),
  };
}

/**
 * 生成面向用户的中文提示信息
 */
export function createChatRateLimitMessage(details: ChatRateLimitDetails): string {
  if (details.window === "minute") {
    return `每分钟最多可发送 ${details.limit} 条消息。请稍等片刻后再继续提问。`;
  }

  return `您已达到每日 ${details.limit} 条消息的限制。请明天再来。`;
}

/**
 * 预检当前是否触发频率限制
 * 不会增加计数，仅用于显示状态
 */
export function previewChatRateLimit(now = Date.now()): LocalRateLimitCheck {
  const currentDate = new Date(now);
  const minuteWindowStart = now - 60_000;
  const state = readState(currentDate);
  // 过滤掉超过 1 分钟的老时间戳
  const minuteTimestamps = state.minuteTimestamps.filter(
    (timestamp) => timestamp > minuteWindowStart,
  );
  const normalizedState: StoredRateLimitState = {
    ...state,
    minuteTimestamps,
  };

  // 写入清理后的状态
  writeState(normalizedState);

  // 检查分钟限制
  if (minuteTimestamps.length >= chatRateLimitConfig.perMinute) {
    const oldestTimestamp = minuteTimestamps[0] ?? now;
    const resetAt = new Date(oldestTimestamp + 60_000);
    return {
      allowed: false,
      clientId: state.clientId,
      details: createRateLimitDetails(
        "minute",
        chatRateLimitConfig.perMinute,
        Math.ceil((resetAt.getTime() - now) / 1000),
        resetAt,
      ),
    };
  }

  // 检查每日限制
  if (normalizedState.dayCount >= chatRateLimitConfig.perDay) {
    const resetAt = getEndOfUtcDay(currentDate);
    return {
      allowed: false,
      clientId: state.clientId,
      details: createRateLimitDetails(
        "day",
        chatRateLimitConfig.perDay,
        Math.ceil((resetAt.getTime() - now) / 1000),
        resetAt,
      ),
    };
  }

  return {
    allowed: true,
    clientId: state.clientId,
  };
}

/**
 * 执行频率限制检查并消耗一次配额
 * 在发送消息前调用
 */
export function consumeChatRateLimit(now = Date.now()): LocalRateLimitCheck {
  const preview = previewChatRateLimit(now);
  if (!preview.allowed) {
    return preview;
  }

  const currentDate = new Date(now);
  const state = readState(currentDate);
  const minuteTimestamps = state.minuteTimestamps.filter(
    (timestamp) => timestamp > now - 60_000,
  );

  // 更新计数并存储
  writeState({
    ...state,
    minuteTimestamps: [...minuteTimestamps, now],
    dayKey: getDayKey(currentDate),
    dayCount: state.dayCount + 1,
  });

  return preview;
}

/**
 * 清除频率限制状态（通常用于调试）
 */
export function clearChatRateLimitState(): void {
  const storage = getStorage();
  storage?.removeItem(STORAGE_KEY);
  storage?.removeItem(CLIENT_ID_STORAGE_KEY);
}

/**
 * 辅助函数：判断错误码是否为频率限制错误
 */
export function isChatRateLimitCode(code: string | undefined): boolean {
  return code === CHAT_RATE_LIMIT_ERROR_CODE;
}
