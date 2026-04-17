/**
 * API 应用集成测试
 * 
 * 职责：
 * 1. 验证 Hono 应用的路由逻辑。
 * 2. 使用 Mock/Stub 服务容器注入，确保测试不依赖真实的 AI 或数据库连接。
 * 3. 覆盖健康检查、搜索、对话及文档查询的核心路径。
 */
import assert from "node:assert/strict";
import test from "node:test";

import type {
  AskResponse,
  ChatRateLimitDetails,
  DocumentParagraphsResponse,
  DocumentResponse,
  HealthResponse,
  SearchResponse,
} from "../../../packages/shared/src/index.ts";

import { createApp } from "./app";
import { AppError } from "./lib/errors";
import type { ServiceContainer } from "./services/container";

/**
 * 桩服务 (Stub Services)
 * 用于模拟真实的业务逻辑实现
 */
const stubServices: ServiceContainer = {
  async getHealth(): Promise<HealthResponse> {
    return {
      status: "ok",
      service: "legalchat-api",
      timestamp: new Date().toISOString(),
      checks: {
        database: true,
        pinecone: false,
        gemini: false,
      },
    };
  },
  async runSearch(): Promise<SearchResponse> {
    return {
      query: "test",
      normalizedQuery: "test",
      queryType: "keyword_lookup",
      topK: 1,
      limitations: [],
      results: [
        {
          documentId: "doc-1",
          chunkId: "chunk-1",
          title: "Case A",
          neutralCitation: "2024 SCC 1",
          court: "SCC",
          jurisdiction: "CA",
          documentType: "case",
          decisionDate: "2024-01-01",
          snippet: "excerpt",
          score: 1,
          traceability: {
            documentId: "doc-1",
            chunkId: "chunk-1",
            paragraphStartNo: 1,
            paragraphEndNo: 2,
          },
        },
      ],
    };
  },
  async runAsk(): Promise<AskResponse> {
    return {
      messageId: "msg-1",
      role: "assistant",
      query: "test",
      normalizedQuery: "test",
      queryType: "keyword_lookup",
      answerText: "grounded answer",
      authorities: [],
      supportingExcerpts: [],
      limitations: [],
    };
  },
  async getDocument(): Promise<DocumentResponse> {
    return {
      documentId: "doc-1",
      title: "Case A",
      neutralCitation: "2024 SCC 1",
      parallelCitation: null,
      court: "SCC",
      jurisdiction: "CA",
      documentType: "case",
      decisionDate: "2024-01-01",
      docketNumber: null,
      summaryText: null,
      sourceUrl: null,
      parseStatus: "completed",
      indexingStatus: "indexed",
    };
  },
  async getDocumentParagraphs(): Promise<DocumentParagraphsResponse> {
    return {
      documentId: "doc-1",
      paragraphs: [
        {
          id: "para-1",
          documentId: "doc-1",
          paragraphNo: 1,
          paragraphOrder: 1,
          paragraphText: "Paragraph 1",
        },
      ],
    };
  },
};

test("GET /health 返回结构化的健康状态负载", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/health");
  assert.equal(response.status, 200);
  const json = (await response.json()) as HealthResponse;
  assert.equal(json.status, "ok");
  assert.equal(json.service, "legalchat-api");
});

test("GET /search 验证并返回搜索响应", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/search?q=test");
  assert.equal(response.status, 200);
  const json = (await response.json()) as SearchResponse;
  assert.equal(json.results.length, 1);
  assert.equal(json.results[0]?.traceability.chunkId, "chunk-1");
});

test("POST /ask 返回结构化的 Grounded Answer", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: "test",
      topK: 3,
      filters: {},
    }),
  });
  assert.equal(response.status, 200);
  const json = (await response.json()) as AskResponse;
  assert.equal(json.role, "assistant");
  assert.equal(json.answerText, "grounded answer");
});

test("POST /ask 当后端拒绝请求时返回结构化的限流错误", async () => {
  const app = createApp({
    ...stubServices,
    async runAsk(): Promise<AskResponse> {
      const details: ChatRateLimitDetails = {
        window: "minute",
        limit: 10,
        retryAfterSeconds: 30,
        resetAt: new Date("2026-04-16T00:00:30.000Z").toISOString(),
      };

      // 模拟抛出 429 异常
      throw new AppError(
        429,
        "chat_rate_limit_exceeded",
        "Chat rate limit exceeded.",
        details,
      );
    },
  });

  const response = await app.request("/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: "test",
      topK: 3,
      filters: {},
      conversationId: "client-1",
    }),
  });

  assert.equal(response.status, 429);
  const json = (await response.json()) as {
    error: {
      code: string;
      details: ChatRateLimitDetails;
    };
  };
  assert.equal(json.error.code, "chat_rate_limit_exceeded");
  assert.equal(json.error.details.window, "minute");
});

test("GET /documents/:documentId 返回标准的文档详情", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/documents/doc-1");
  assert.equal(response.status, 200);
  const json = (await response.json()) as DocumentResponse;
  assert.equal(json.documentId, "doc-1");
});

test("GET /documents/:documentId/paragraphs 返回段落列表", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/documents/doc-1/paragraphs");
  assert.equal(response.status, 200);
  const json = (await response.json()) as DocumentParagraphsResponse;
  assert.equal(json.paragraphs.length, 1);
});
