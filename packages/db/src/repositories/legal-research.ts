/**
 * 法律研究数据存储库 (Repository)
 * 
 * 本模块封装了所有与法律文档检索、案件详情查询以及 RAG 流程持久化相关的数据库操作。
 * 它连接了 Drizzle 定义的数据模型与业务逻辑层，提供高层次的数据访问 API。
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { SearchFilters } from "../../../shared/src/index.ts";

import type { Database } from "../client";
import {
  answerCitations,
  answerSessions,
  legalDocumentChunks,
  legalDocumentParagraphs,
  legalDocuments,
  retrievalCandidates,
  retrievalRuns,
  searchQueries,
} from "../schema";

/**
 * 词法搜索结果行定义
 */
export type LexicalSearchRow = {
  documentId: string;
  chunkId: string;
  title: string;
  neutralCitation: string | null;
  court: string | null;
  jurisdiction: string | null;
  documentType: string;
  decisionDate: string | null;
  snippet: string; // 召回的文本片段
  score: number;   // 相关度评分
  paragraphStartNo: number | null;
  paragraphEndNo: number | null;
};

/**
 * 文档详情行定义
 */
export type DocumentDetailRow = {
  documentId: string;
  title: string;
  neutralCitation: string | null;
  parallelCitation: string | null;
  court: string | null;
  jurisdiction: string | null;
  documentType: string;
  decisionDate: string | null;
  docketNumber: string | null;
  summaryText: string | null;
  sourceUrl: string | null;
  parseStatus: string;
  indexingStatus: string;
};

/**
 * 段落行定义
 */
export type ParagraphRow = {
  id: string;
  documentId: string;
  paragraphNo: number | null;
  paragraphOrder: number;
  paragraphText: string;
};

/**
 * 创建法律研究存储库实例
 * 
 * @param database Drizzle 数据库实例
 */
export function createLegalResearchRepository(database: Database) {
  /**
   * 构建通用的文档过滤条件
   */
  function buildFilters(filters: SearchFilters) {
    const clauses = [eq(legalDocuments.isActive, true)];

    if (filters.court) {
      clauses.push(eq(legalDocuments.court, filters.court));
    }
    if (filters.jurisdiction) {
      clauses.push(eq(legalDocuments.jurisdiction, filters.jurisdiction));
    }
    if (filters.documentType) {
      clauses.push(eq(legalDocuments.documentType, filters.documentType));
    }
    if (filters.dateFrom) {
      clauses.push(gte(legalDocuments.decisionDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      clauses.push(lte(legalDocuments.decisionDate, filters.dateTo));
    }

    return and(...clauses);
  }

  return {
    /**
     * 基于 ILIKE 的简单词法搜索实现 (MVP 阶段使用)
     * 实现了对引用号、标题和分块正文的加权搜索。
     */
    async lexicalSearch(input: {
      normalizedQuery: string;
      filters: SearchFilters;
      limit: number;
    }): Promise<LexicalSearchRow[]> {
      const likeQuery = `%${input.normalizedQuery}%`;
      // 计算简单的相关度权重
      const score = sql<number>`
        (
          CASE
            WHEN ${legalDocuments.neutralCitation} ILIKE ${likeQuery} THEN 5
            ELSE 0
          END
          +
          CASE
            WHEN ${legalDocuments.title} ILIKE ${likeQuery} THEN 3
            ELSE 0
          END
          +
          CASE
            WHEN ${legalDocumentChunks.chunkText} ILIKE ${likeQuery} THEN 2
            ELSE 0
          END
        )
      `;

      const rows = await database
        .select({
          documentId: legalDocuments.id,
          chunkId: legalDocumentChunks.id,
          vectorId: legalDocumentChunks.vectorId,
          title: legalDocuments.title,
          neutralCitation: legalDocuments.neutralCitation,
          court: legalDocuments.court,
          jurisdiction: legalDocuments.jurisdiction,
          documentType: legalDocuments.documentType,
          decisionDate: legalDocuments.decisionDate,
          snippet: legalDocumentChunks.chunkText,
          score,
          paragraphStartNo: legalDocumentChunks.paragraphStartNo,
          paragraphEndNo: legalDocumentChunks.paragraphEndNo,
        })
        .from(legalDocumentChunks)
        .innerJoin(
          legalDocuments,
          eq(legalDocumentChunks.documentId, legalDocuments.id),
        )
        .where(
          and(
            buildFilters(input.filters),
            eq(legalDocumentChunks.isActive, true),
            or(
              ilike(legalDocuments.neutralCitation, likeQuery),
              ilike(legalDocuments.title, likeQuery),
              ilike(legalDocumentChunks.chunkText, likeQuery),
            ),
          ),
        )
        .orderBy(desc(score), asc(legalDocuments.decisionDate))
        .limit(input.limit);

      return rows.map((row) => ({
        ...row,
        score: Number(row.score ?? 0),
      }));
    },

    /**
     * 根据向量库召回的 ID 列表获取完整的分块和文档信息
     * 保持向量召回的原始排名顺序。
     */
    async findChunksByVectorIds(vectorIds: string[]): Promise<LexicalSearchRow[]> {
      if (vectorIds.length === 0) {
        return [];
      }

      const rows = await database
        .select({
          documentId: legalDocuments.id,
          chunkId: legalDocumentChunks.id,
          vectorId: legalDocumentChunks.vectorId,
          title: legalDocuments.title,
          neutralCitation: legalDocuments.neutralCitation,
          court: legalDocuments.court,
          jurisdiction: legalDocuments.jurisdiction,
          documentType: legalDocuments.documentType,
          decisionDate: legalDocuments.decisionDate,
          snippet: legalDocumentChunks.chunkText,
          score: sql<number>`0`,
          paragraphStartNo: legalDocumentChunks.paragraphStartNo,
          paragraphEndNo: legalDocumentChunks.paragraphEndNo,
        })
        .from(legalDocumentChunks)
        .innerJoin(
          legalDocuments,
          eq(legalDocumentChunks.documentId, legalDocuments.id),
        )
        .where(
          and(
            eq(legalDocumentChunks.isActive, true),
            inArray(legalDocumentChunks.vectorId, vectorIds),
          ),
        );

      const order = new Map(vectorIds.map((value, index) => [value, index]));
      return rows.sort((left, right) => {
        const leftRank = order.get(left.vectorId ?? "") ?? Number.MAX_SAFE_INTEGER;
        const rightRank =
          order.get(right.vectorId ?? "") ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank;
      }).map(({ vectorId: _vectorId, ...row }) => row);
    },

    /**
     * 获取指定文档的详细元数据
     */
    async getDocumentById(documentId: string): Promise<DocumentDetailRow | null> {
      const [row] = await database
        .select({
          documentId: legalDocuments.id,
          title: legalDocuments.title,
          neutralCitation: legalDocuments.neutralCitation,
          parallelCitation: legalDocuments.parallelCitation,
          court: legalDocuments.court,
          jurisdiction: legalDocuments.jurisdiction,
          documentType: legalDocuments.documentType,
          decisionDate: legalDocuments.decisionDate,
          docketNumber: legalDocuments.docketNumber,
          summaryText: legalDocuments.summaryText,
          sourceUrl: legalDocuments.sourceUrl,
          parseStatus: legalDocuments.parseStatus,
          indexingStatus: legalDocuments.indexingStatus,
        })
        .from(legalDocuments)
        .where(eq(legalDocuments.id, documentId))
        .limit(1);

      return row ?? null;
    },

    /**
     * 获取指定文档的所有段落原文，按顺序排列
     */
    async getDocumentParagraphs(documentId: string): Promise<ParagraphRow[]> {
      return database
        .select({
          id: legalDocumentParagraphs.id,
          documentId: legalDocumentParagraphs.documentId,
          paragraphNo: legalDocumentParagraphs.paragraphNo,
          paragraphOrder: legalDocumentParagraphs.paragraphOrder,
          paragraphText: legalDocumentParagraphs.paragraphText,
        })
        .from(legalDocumentParagraphs)
        .where(eq(legalDocumentParagraphs.documentId, documentId))
        .orderBy(asc(legalDocumentParagraphs.paragraphOrder));
    },

    /**
     * 持久化搜索查询记录
     */
    async insertSearchQuery(input: {
      conversationId?: string;
      messageId?: string;
      queryText: string;
      normalizedQuery: string;
      queryType: string;
      filtersJson: SearchFilters;
      latencyMs?: number;
    }): Promise<string | null> {
      const [row] = await database
        .insert(searchQueries)
        .values({
          conversationId: input.conversationId,
          messageId: input.messageId,
          queryText: input.queryText,
          normalizedQuery: input.normalizedQuery,
          queryType: input.queryType,
          filtersJson: input.filtersJson,
          latencyMs: input.latencyMs,
        })
        .returning({ id: searchQueries.id });

      return row?.id ?? null;
    },

    /**
     * 持久化检索运行记录
     */
    async insertRetrievalRun(input: {
      queryId: string;
      retrievalStrategy: string;
      metadataFiltersJson: SearchFilters;
      denseTopK: number;
      lexicalTopK: number;
      fusedTopK: number;
      latencyMs?: number;
      debugPayload?: Record<string, unknown>;
    }): Promise<string | null> {
      const [row] = await database
        .insert(retrievalRuns)
        .values({
          queryId: input.queryId,
          retrievalStrategy: input.retrievalStrategy,
          denseModelName: "gemini-embedding-001",
          lexicalEngine: "postgres_ilike",
          metadataFiltersJson: input.metadataFiltersJson,
          denseTopK: input.denseTopK,
          lexicalTopK: input.lexicalTopK,
          fusedTopK: input.fusedTopK,
          latencyMs: input.latencyMs,
          debugPayload: input.debugPayload,
        })
        .returning({ id: retrievalRuns.id });

      return row?.id ?? null;
    },

    /**
     * 批量持久化检索召回的候选分块
     */
    async insertRetrievalCandidates(
      input: Array<{
        retrievalRunId: string;
        chunkId: string;
        documentId: string;
        sourceRankDense?: number;
        sourceRankLexical?: number;
        fusedRank?: number;
        rerankedRank?: number;
        denseScore?: number;
        lexicalScore?: number;
        fusedScore?: number;
        rerankedScore?: number;
        selectedForAnswer: boolean;
      }>,
    ): Promise<void> {
      if (input.length === 0) {
        return;
      }

      await database.insert(retrievalCandidates).values(input);
    },

    /**
     * 持久化 LLM 生成的答案会话
     */
    async insertAnswerSession(input: {
      queryId?: string | null;
      retrievalRunId?: string | null;
      answerText: string;
      answerJson: Record<string, unknown>;
      validationStatus: string;
      latencyMs?: number;
    }): Promise<string | null> {
      const [row] = await database
        .insert(answerSessions)
        .values({
          queryId: input.queryId,
          retrievalRunId: input.retrievalRunId,
          modelProvider: "gemini",
          modelName: "gemini-2.5-flash",
          promptVersion: "rag-v1",
          answerText: input.answerText,
          answerJson: input.answerJson,
          validationStatus: input.validationStatus,
          streamCompleted: true,
          latencyMs: input.latencyMs,
          confidenceLabel:
            input.validationStatus === "grounded" ? "medium" : "low",
        })
        .returning({ id: answerSessions.id });

      return row?.id ?? null;
    },

    /**
     * 批量持久化答案中的引用依据
     */
    async insertAnswerCitations(
      input: Array<{
        answerSessionId: string;
        chunkId: string;
        documentId: string;
        citationLabel: string;
        paragraphStartNo: number | null;
        paragraphEndNo: number | null;
        supportingExcerpt: string;
        citationOrder: number;
      }>,
    ): Promise<void> {
      if (input.length === 0) {
        return;
      }

      await database.insert(answerCitations).values(input);
    },
  };
}
