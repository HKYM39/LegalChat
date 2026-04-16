import assert from "node:assert/strict";
import test from "node:test";

import type {
  AskResponse,
  DocumentParagraphsResponse,
  DocumentResponse,
  HealthResponse,
  SearchResponse,
} from "../../../packages/shared/src/index.ts";

import { createApp } from "./app";
import type { ServiceContainer } from "./services/container";

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

test("GET /health returns structured health payload", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/health");
  assert.equal(response.status, 200);
  const json = (await response.json()) as HealthResponse;
  assert.equal(json.status, "ok");
  assert.equal(json.service, "legalchat-api");
});

test("GET /search validates and returns search response", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/search?q=test");
  assert.equal(response.status, 200);
  const json = (await response.json()) as SearchResponse;
  assert.equal(json.results.length, 1);
  assert.equal(json.results[0]?.traceability.chunkId, "chunk-1");
});

test("POST /ask returns structured grounded answer", async () => {
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

test("GET /documents/:documentId returns canonical document", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/documents/doc-1");
  assert.equal(response.status, 200);
  const json = (await response.json()) as DocumentResponse;
  assert.equal(json.documentId, "doc-1");
});

test("GET /documents/:documentId/paragraphs returns paragraph list", async () => {
  const app = createApp(stubServices);
  const response = await app.request("/documents/doc-1/paragraphs");
  assert.equal(response.status, 200);
  const json = (await response.json()) as DocumentParagraphsResponse;
  assert.equal(json.paragraphs.length, 1);
});
