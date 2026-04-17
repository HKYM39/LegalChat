/**
 * 前端 API 客户端 (API Client)
 * 
 * 职责：
 * 1. 封装与 Hono 后端的 HTTP 通信逻辑。
 * 2. 提供统一的错误处理机制（ApiError）。
 * 3. 定义与后端核心业务（RAG 问答、判例检索、文档详情）对应的调用函数。
 */

import type {
  AskRequest,
  AskResponse,
  ChatRateLimitDetails,
  DocumentParagraphsResponse,
  DocumentResponse,
  HealthResponse,
  InputSecurityViolation,
  SearchRequest,
  SearchResponse,
} from "shared";
import { isInputSecurityViolation } from "shared";

/**
 * 接口返回的错误负载结构
 */
type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

/**
 * 自定义 API 错误类
 * 携带 HTTP 状态码、错误代码及详细信息
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * 类型守卫：判断是否为频率限制详情
 */
export function isChatRateLimitDetails(
  value: unknown,
): value is ChatRateLimitDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.window === "minute" || record.window === "day") &&
    typeof record.limit === "number" &&
    typeof record.retryAfterSeconds === "number" &&
    typeof record.resetAt === "string"
  );
}

export function isInputSecurityErrorDetails(
  value: unknown,
): value is InputSecurityViolation {
  return isInputSecurityViolation(value);
}

/**
 * 内部通用请求函数
 * 封装 fetch 逻辑及 JSON 解析
 */
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    // MVP 阶段禁用缓存，确保获取最新的法律研究数据
    cache: "no-store",
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }

    throw new ApiError(
      payload?.error?.message ??
        `请求失败，状态码: ${response.status}。`,
      response.status,
      payload?.error?.code,
      payload?.error?.details,
    );
  }

  return (await response.json()) as T;
}

/**
 * [GET /health] 检查后端服务可用性
 */
export function getHealth() {
  return requestJson<HealthResponse>("/health", { method: "GET" });
}

/**
 * [GET /search] 搜索法律权威
 * 支持关键词、法院、管辖区、日期等多维度过滤
 */
export function searchAuthorities(input: SearchRequest) {
  const params = new URLSearchParams();
  params.set("q", input.query);
  params.set("top_k", String(input.topK));
  if (input.filters.court) {
    params.set("court", input.filters.court);
  }
  if (input.filters.jurisdiction) {
    params.set("jurisdiction", input.filters.jurisdiction);
  }
  if (input.filters.documentType) {
    params.set("document_type", input.filters.documentType);
  }
  if (input.filters.dateFrom) {
    params.set("date_from", input.filters.dateFrom);
  }
  if (input.filters.dateTo) {
    params.set("date_to", input.filters.dateTo);
  }

  return requestJson<SearchResponse>(`/search?${params.toString()}`, {
    method: "GET",
  });
}

/**
 * [POST /ask] 法律 RAG 问答主接口
 * 核心功能：接收用户自然语言提问，返回基于真实法律判例的 AI 回答及引用来源
 */
export function askLegalQuestion(input: AskRequest) {
  return requestJson<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * [GET /documents/:id] 获取判例元数据详情
 */
export function getDocument(documentId: string) {
  return requestJson<DocumentResponse>(`/documents/${documentId}`, {
    method: "GET",
  });
}

/**
 * [GET /documents/:id/paragraphs] 获取判例的全量段落内容
 */
export function getDocumentParagraphs(documentId: string) {
  return requestJson<DocumentParagraphsResponse>(
    `/documents/${documentId}/paragraphs`,
    {
      method: "GET",
    },
  );
}
