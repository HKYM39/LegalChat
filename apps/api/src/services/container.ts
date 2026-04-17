/**
 * 服务容器 (Service Container)
 * 
 * 职责：
 * 1. 核心业务逻辑的聚合层，协调 AI 层 (packages/ai) 与数据访问层 (packages/db)。
 * 2. 实现 RAG (Retrieval-Augmented Generation) 完整生命周期。
 * 3. 管理外部服务（如 Pinecone, Gemini）的调用与降级逻辑。
 * 4. 提供依赖注入的入口，便于单元测试。
 */
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
  createDbClient,
  createLegalResearchRepository,
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
import { InMemoryChatRateLimiter } from "../lib/chat-rate-limit";
import { configHealth, type AppConfig } from "../lib/config";

/**
 * 对话执行上下文
 */
type AskExecutionContext = {
  rateLimitSubject?: string;
};

/**
 * 服务容器接口定义
 */
export type ServiceContainer = {
  getHealth(): Promise<HealthResponse>;
  runSearch(input: SearchRequest): Promise<SearchResponse>;
  runAsk(input: AskRequest, context?: AskExecutionContext): Promise<AskResponse>;
  getDocument(documentId: string): Promise<DocumentResponse>;
  getDocumentParagraphs(documentId: string): Promise<DocumentParagraphsResponse>;
};

type PineconeMatch = {
  id: string;
  score?: number;
};

/**
 * 格式化 Pinecone 基础 URL
 */
function pineconeBaseUrl(indexHost: string): string {
  if (indexHost.startsWith("http://") || indexHost.startsWith("https://")) {
    return indexHost.replace(/\/$/, "");
  }
  return `https://${indexHost.replace(/\/$/, "")}`;
}

/**
 * 调用 Pinecone 执行向量相似度检索
 */
async function fetchPineconeMatches(input: {
  config: AppConfig;
  vector: number[] | null;
  topK: number;
}): Promise<PineconeMatch[]> {
  // 如果配置缺失或向量生成失败，直接跳过向量检索
  if (
    !input.vector ||
    !input.config.pineconeApiKey ||
    !input.config.pineconeIndexHost
  ) {
    return [];
  }

  try {
    const response = await fetch(
      `${pineconeBaseUrl(input.config.pineconeIndexHost)}/query`,
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
    // 向量库故障时不中断流程，回退到词法检索
    return [];
  }
}

/**
 * 将数据库行映射为标准的检索候选对象 (RetrievalCandidate)
 */
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
    snippet: row.snippet.slice(0, 600), // 截取片段长度
    score: row.score,
    traceability: {
      documentId: row.documentId,
      chunkId: row.chunkId,
      paragraphStartNo: row.paragraphStartNo,
      paragraphEndNo: row.paragraphEndNo,
    },
  };
}

/**
 * 映射文档详情响应
 */
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

/**
 * 映射文档段落响应
 */
function mapParagraphs(
  documentId: string,
  paragraphs: ParagraphRow[],
): DocumentParagraphsResponse {
  return {
    documentId,
    paragraphs,
  };
}

/**
 * 创建服务容器实例
 * 
 * @param config 应用配置
 */
export function createServices(config: AppConfig): ServiceContainer {
  // 初始化限流器
  const chatRateLimiter = new InMemoryChatRateLimiter({
    perMinute: config.chatRateLimitPerMinute,
    perDay: config.chatRateLimitPerDay,
    logEnabled: config.requestLogEnabled,
  });

  /**
   * 辅助函数：在 Repository 上下文中执行操作并自动管理连接闭合
   */
  async function withRepository<T>(
    operation: (
      repository: ReturnType<typeof createLegalResearchRepository>,
    ) => Promise<T>,
  ): Promise<T> {
    const client = createDbClient(config.databaseUrl);
    if (!client) {
      throw new AppError(503, "database_unavailable", "DATABASE_URL 未配置。");
    }

    try {
      const repository = createLegalResearchRepository(client.db);
      return await operation(repository);
    } finally {
      // 这里的 sql.end 用于无服务器环境下的连接清理，Bun 环境下可按需调整
      await client.sql.end({ timeout: 1 }).catch(() => undefined);
    }
  }

  return {
    /**
     * 获取系统健康详情
     */
    async getHealth() {
      const checks = configHealth(config);
      return {
        status: checks.database ? "ok" : "degraded",
        service: "legalchat-api",
        timestamp: new Date().toISOString(),
        checks,
      };
    },

    /**
     * 执行混合检索 (Lexical + Dense Search)
     */
    async runSearch(input) {
      return withRepository(async (repository) => {
        // 1. 生成检索计划 (判定查询类型与分配 TopK)
        const plan = buildRetrievalPlan({
          query: input.query,
          topK: input.topK || config.defaultTopK,
          filters: input.filters,
        });
        const startedAt = Date.now();

        // 2. 执行词法检索 (Lexical/Keyword Search)
        const lexicalRows = await repository.lexicalSearch({
          normalizedQuery: plan.lexicalQuery,
          filters: plan.filters,
          limit: plan.lexicalTopK,
        });
        const lexical = lexicalRows.map(mapAuthority);
        
        const searchLimitations: string[] = [];

        // 3. 执行向量检索 (Dense/Vector Search)
        const vector = await embedQuery(
          {
            apiKey: config.geminiApiKey,
            model: config.geminiModel,
            embeddingModel: config.geminiEmbeddingModel,
            embeddingOutputDimensionality:
              config.geminiEmbeddingOutputDimensionality,
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

        if (
          vector &&
          matches.length === 0 &&
          config.pineconeApiKey &&
          config.pineconeIndexHost
        ) {
          searchLimitations.push("向量检索当前不可用，结果已降级为 lexical-only。");
        }

        // 从 DB 获取向量匹配对应的详细内容
        const denseRows = await repository.findChunksByVectorIds(
          matches.map((item) => item.id),
        );
        const dense = denseRows.map((row, index) => ({
          ...mapAuthority(row),
          score: matches[index]?.score ?? 0,
        }));

        // 4. 融合并重排序 (Lexical + Dense Fusion)
        const merged = mergeAndRerankCandidates({
          lexical,
          dense,
          topK: plan.topK,
        });

        // 5. 记录检索日志 (异步执行，不阻塞返回)
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
          limitations: Array.from(
            new Set([...merged.limitations, ...searchLimitations]),
          ),
          results: merged.results,
        };
      });
    },

    /**
     * 执行 RAG 对话 (Grounded Answer Synthesis)
     */
    async runAsk(input, context) {
      // 1. 强制执行速率限制
      chatRateLimiter.enforce(context?.rateLimitSubject ?? "anonymous");

      // 2. 执行混合检索获取证据片段
      const search = await this.runSearch(input);
      const plan = buildRetrievalPlan({
        query: input.query,
        topK: input.topK || config.defaultTopK,
        filters: input.filters,
      });

      // 3. 构建 Prompt 证据上下文
      const promptEvidence = buildPromptEvidence(search.results);
      const modelStartedAt = Date.now();

      // 4. 调用 LLM 生成基于事实的回答
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

      // 5. 构建结构化响应并包含限制说明
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

      // 6. 记录对话与引用日志 (持久化到数据库)
      await withRepository(async (repository) => {
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
      });

      return response;
    },

    /**
     * 获取指定 ID 的文档详情
     */
    async getDocument(documentId) {
      return withRepository(async (repository) => {
        const row = await repository.getDocumentById(documentId);
        if (!row) {
          throw new AppError(404, "document_not_found", "未找到对应文档。");
        }
        return mapDocument(row);
      });
    },

    /**
     * 获取指定文档的所有段落列表
     */
    async getDocumentParagraphs(documentId) {
      return withRepository(async (repository) => {
        const document = await repository.getDocumentById(documentId);
        if (!document) {
          throw new AppError(404, "document_not_found", "未找到对应文档。");
        }

        const paragraphs = await repository.getDocumentParagraphs(documentId);
        return mapParagraphs(documentId, paragraphs);
      });
    },
  };
}
