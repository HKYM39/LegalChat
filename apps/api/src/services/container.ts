import {
  buildAskResponse,
  buildPromptEvidence,
  buildRetrievalPlan,
  embedQuery,
  generateGroundedAnswer,
  mergeAndRerankCandidates,
  type RetrievalCandidate,
} from "../../../../packages/ai/src/index.ts";
import {
  createLegalResearchRepository,
  db,
  type DocumentDetailRow,
  type ParagraphRow,
} from "../../../../packages/db/src/index.ts";
import type {
  AskRequest,
  AskResponse,
  DocumentParagraphsResponse,
  DocumentResponse,
  HealthResponse,
  SearchRequest,
  SearchResponse,
} from "../../../../packages/shared/src/index.ts";

import { AppError } from "../lib/errors";
import { configHealth, type AppConfig } from "../lib/config";

export type ServiceContainer = {
  getHealth(): Promise<HealthResponse>;
  runSearch(input: SearchRequest): Promise<SearchResponse>;
  runAsk(input: AskRequest): Promise<AskResponse>;
  getDocument(documentId: string): Promise<DocumentResponse>;
  getDocumentParagraphs(documentId: string): Promise<DocumentParagraphsResponse>;
};

type PineconeMatch = {
  id: string;
  score?: number;
};

async function fetchPineconeMatches(input: {
  config: AppConfig;
  vector: number[] | null;
  topK: number;
}): Promise<PineconeMatch[]> {
  if (
    !input.vector ||
    !input.config.pineconeApiKey ||
    !input.config.pineconeIndexHost
  ) {
    return [];
  }

  try {
    const response = await fetch(
      `https://${input.config.pineconeIndexHost}/query`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "api-key": input.config.pineconeApiKey,
        },
        body: JSON.stringify({
          vector: input.vector,
          topK: input.topK,
          namespace: input.config.pineconeNamespace,
          includeMetadata: false,
        }),
      },
    );

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as {
      matches?: PineconeMatch[];
    };
    return json.matches ?? [];
  } catch {
    return [];
  }
}

function mapAuthority(row: {
  documentId: string;
  chunkId: string;
  title: string;
  neutralCitation: string | null;
  court: string | null;
  jurisdiction: string | null;
  documentType: string;
  decisionDate: string | null;
  snippet: string;
  score: number;
  paragraphStartNo: number | null;
  paragraphEndNo: number | null;
}): RetrievalCandidate {
  return {
    documentId: row.documentId,
    chunkId: row.chunkId,
    title: row.title,
    neutralCitation: row.neutralCitation,
    court: row.court,
    jurisdiction: row.jurisdiction,
    documentType: row.documentType,
    decisionDate: row.decisionDate,
    snippet: row.snippet.slice(0, 600),
    score: row.score,
    traceability: {
      documentId: row.documentId,
      chunkId: row.chunkId,
      paragraphStartNo: row.paragraphStartNo,
      paragraphEndNo: row.paragraphEndNo,
    },
  };
}

function mapDocument(row: DocumentDetailRow): DocumentResponse {
  return {
    documentId: row.documentId,
    title: row.title,
    neutralCitation: row.neutralCitation,
    parallelCitation: row.parallelCitation,
    court: row.court,
    jurisdiction: row.jurisdiction,
    documentType: row.documentType,
    decisionDate: row.decisionDate,
    docketNumber: row.docketNumber,
    summaryText: row.summaryText,
    sourceUrl: row.sourceUrl,
    parseStatus: row.parseStatus,
    indexingStatus: row.indexingStatus,
  };
}

function mapParagraphs(
  documentId: string,
  paragraphs: ParagraphRow[],
): DocumentParagraphsResponse {
  return {
    documentId,
    paragraphs,
  };
}

export function createServices(config: AppConfig): ServiceContainer {
  const repository = db ? createLegalResearchRepository(db) : null;

  return {
    async getHealth() {
      const checks = configHealth(config);
      return {
        status: checks.database ? "ok" : "degraded",
        service: "legalchat-api",
        timestamp: new Date().toISOString(),
        checks,
      };
    },

    async runSearch(input) {
      if (!repository) {
        throw new AppError(503, "database_unavailable", "DATABASE_URL 未配置。");
      }

      const plan = buildRetrievalPlan({
        query: input.query,
        topK: input.topK || config.defaultTopK,
        filters: input.filters,
      });
      const startedAt = Date.now();
      const lexicalRows = await repository.lexicalSearch({
        normalizedQuery: plan.lexicalQuery,
        filters: plan.filters,
        limit: plan.lexicalTopK,
      });
      const lexical = lexicalRows.map(mapAuthority);
      const searchLimitations: string[] = [];
      const vector = await embedQuery(
        {
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
          embeddingModel: config.geminiEmbeddingModel,
          apiBaseUrl: config.geminiApiBaseUrl,
        },
        plan.normalizedQuery,
      );
      if (!vector && config.geminiApiKey) {
        searchLimitations.push("查询向量生成不可用，结果已降级为 lexical-only。");
      }
      const matches = await fetchPineconeMatches({
        config,
        vector,
        topK: plan.denseTopK,
      });
      if (vector && matches.length === 0 && config.pineconeApiKey && config.pineconeIndexHost) {
        searchLimitations.push("向量检索当前不可用，结果已降级为 lexical-only。");
      }
      const denseRows = await repository.findChunksByVectorIds(matches.map((item) => item.id));
      const dense = denseRows.map((row, index) => ({
        ...mapAuthority(row),
        score: matches[index]?.score ?? 0,
      }));
      const merged = mergeAndRerankCandidates({
        lexical,
        dense,
        topK: plan.topK,
      });

      const queryId = await repository
        .insertSearchQuery({
          queryText: input.query,
          normalizedQuery: plan.normalizedQuery,
          queryType: plan.queryType,
          filtersJson: input.filters,
          latencyMs: Date.now() - startedAt,
        })
        .catch(() => null);

      const retrievalRunId =
        queryId &&
        (await repository
          .insertRetrievalRun({
            queryId,
            retrievalStrategy: "hybrid_retrieval",
            metadataFiltersJson: input.filters,
            denseTopK: plan.denseTopK,
            lexicalTopK: plan.lexicalTopK,
            fusedTopK: plan.topK,
            latencyMs: Date.now() - startedAt,
            debugPayload: {
              lexicalCount: lexical.length,
              denseCount: dense.length,
            },
          })
          .catch(() => null));

      if (retrievalRunId) {
        await repository
          .insertRetrievalCandidates(
            merged.results.map((item, index) => ({
              retrievalRunId,
              chunkId: item.chunkId,
              documentId: item.documentId,
              sourceRankDense: item.denseRank,
              sourceRankLexical: item.lexicalRank,
              fusedRank: item.fusedRank,
              rerankedRank: index + 1,
              denseScore: item.denseScore,
              lexicalScore: item.lexicalScore,
              fusedScore: item.fusedScore,
              rerankedScore: item.rerankedScore,
              selectedForAnswer: false,
            })),
          )
          .catch(() => undefined);
      }

      return {
        query: input.query,
        normalizedQuery: plan.normalizedQuery,
        queryType: plan.queryType,
        topK: plan.topK,
        limitations: Array.from(new Set([...merged.limitations, ...searchLimitations])),
        results: merged.results,
      };
    },

    async runAsk(input) {
      if (!repository) {
        throw new AppError(503, "database_unavailable", "DATABASE_URL 未配置。");
      }

      const search = await this.runSearch(input);
      const plan = buildRetrievalPlan({
        query: input.query,
        topK: input.topK || config.defaultTopK,
        filters: input.filters,
      });
      const promptEvidence = buildPromptEvidence(search.results);
      const modelStartedAt = Date.now();
      const answer = await generateGroundedAnswer({
        config: {
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
          embeddingModel: config.geminiEmbeddingModel,
          apiBaseUrl: config.geminiApiBaseUrl,
        },
        query: input.query,
        evidence: promptEvidence,
      });
      const askLimitations = [...search.limitations];
      if (!answer && search.results.length > 0 && config.geminiApiKey) {
        askLimitations.push("Gemini 回答生成当前不可用，结果已降级为保守模式。");
      }
      const response = buildAskResponse({
        query: input.query,
        plan,
        authorities: search.results,
        answer,
        limitations:
          search.results.length === 0
            ? [...askLimitations, "未检索到足够证据。"]
            : askLimitations,
      });

      const queryId = await repository
        .insertSearchQuery({
          conversationId: input.conversationId,
          messageId: input.messageId,
          queryText: input.query,
          normalizedQuery: response.normalizedQuery,
          queryType: response.queryType,
          filtersJson: input.filters,
        })
        .catch(() => null);

      const retrievalRunId =
        queryId &&
        (await repository
          .insertRetrievalRun({
            queryId,
            retrievalStrategy: "hybrid_retrieval",
            metadataFiltersJson: input.filters,
            denseTopK: plan.denseTopK,
            lexicalTopK: plan.lexicalTopK,
            fusedTopK: plan.topK,
          })
          .catch(() => null));

      if (retrievalRunId) {
        await repository
          .insertRetrievalCandidates(
            search.results.map((item, index) => ({
              retrievalRunId,
              chunkId: item.chunkId,
              documentId: item.documentId,
              sourceRankDense: item.denseRank,
              sourceRankLexical: item.lexicalRank,
              fusedRank: item.fusedRank,
              rerankedRank: index + 1,
              denseScore: item.denseScore,
              lexicalScore: item.lexicalScore,
              fusedScore: item.fusedScore,
              rerankedScore: item.rerankedScore,
              selectedForAnswer: true,
            })),
          )
          .catch(() => undefined);
      }

      const answerSessionId =
        queryId &&
        (await repository
          .insertAnswerSession({
            queryId,
            retrievalRunId: retrievalRunId ?? null,
            answerText: response.answerText,
            answerJson: response,
            validationStatus:
              response.limitations.length > 0 ? "conservative" : "grounded",
            latencyMs: Date.now() - modelStartedAt,
          })
          .catch(() => null));

      if (answerSessionId) {
        await repository
          .insertAnswerCitations(
            response.supportingExcerpts.map((item, index) => ({
              answerSessionId,
              chunkId: item.traceability.chunkId,
              documentId: item.traceability.documentId,
              citationLabel: item.label,
              paragraphStartNo: item.traceability.paragraphStartNo,
              paragraphEndNo: item.traceability.paragraphEndNo,
              supportingExcerpt: item.excerpt,
              citationOrder: index + 1,
            })),
          )
          .catch(() => undefined);
      }

      return response;
    },

    async getDocument(documentId) {
      if (!repository) {
        throw new AppError(503, "database_unavailable", "DATABASE_URL 未配置。");
      }

      const row = await repository.getDocumentById(documentId);
      if (!row) {
        throw new AppError(404, "document_not_found", "未找到对应文档。");
      }
      return mapDocument(row);
    },

    async getDocumentParagraphs(documentId) {
      if (!repository) {
        throw new AppError(503, "database_unavailable", "DATABASE_URL 未配置。");
      }

      const document = await repository.getDocumentById(documentId);
      if (!document) {
        throw new AppError(404, "document_not_found", "未找到对应文档。");
      }

      const paragraphs = await repository.getDocumentParagraphs(documentId);
      return mapParagraphs(documentId, paragraphs);
    },
  };
}
