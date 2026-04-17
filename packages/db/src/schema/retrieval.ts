/**
 * 检索过程数据表定义
 * 
 * 记录 RAG 流程中的关键环节：用户查询的结构化、检索运行参数、以及召回的候选片段。
 * 用于分析检索性能、优化召回策略。
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { conversations, messages } from "./chat";
import { legalDocumentChunks, legalDocuments } from "./documents";

/**
 * 搜索查询表 (search_queries)
 * 存储经过分析、标准化后的用户意图。
 */
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 关联的对话 ID
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    // 关联的消息 ID
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    // 原始查询文本
    queryText: text("query_text").notNull(),
    // 经过 LLM 重写或标准化的查询文本 (用于检索)
    normalizedQuery: text("normalized_query"),
    // 查询类型 (general_legal, case_specific, doctrinal)
    queryType: varchar("query_type", { length: 50 }).notNull(),
    // 提取的元数据过滤器
    filtersJson: jsonb("filters_json"),
    // 查询语言
    queryLanguage: varchar("query_language", { length: 20 })
      .notNull()
      .default("en"),
    // 处理耗时 (毫秒)
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_search_queries_conversation_id").on(table.conversationId),
    index("idx_search_queries_message_id").on(table.messageId),
    index("idx_search_queries_query_type").on(table.queryType),
  ],
);

/**
 * 检索运行记录表 (retrieval_runs)
 * 记录针对某一查询执行的具体检索动作及参数。
 */
export const retrievalRuns = pgTable(
  "retrieval_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 关联的查询 ID
    queryId: uuid("query_id")
      .notNull()
      .references(() => searchQueries.id, { onDelete: "cascade" }),
    // 采用的检索策略 (dense, lexical, hybrid)
    retrievalStrategy: varchar("retrieval_strategy", { length: 100 }).notNull(),
    // 向量检索使用的模型
    denseModelName: varchar("dense_model_name", { length: 255 }),
    // 重排使用的模型
    rerankerModelName: varchar("reranker_model_name", { length: 255 }),
    // 词法检索使用的引擎 (如 PostgreSQL tsvector)
    lexicalEngine: varchar("lexical_engine", { length: 100 }),
    // 实际应用的元数据过滤器快照
    metadataFiltersJson: jsonb("metadata_filters_json"),
    // 向量召回 K 值
    denseTopK: integer("dense_top_k"),
    // 词法召回 K 值
    lexicalTopK: integer("lexical_top_k"),
    // 混合召回后融合的 K 值
    fusedTopK: integer("fused_top_k"),
    // 检索耗时 (毫秒)
    latencyMs: integer("latency_ms"),
    // 调试 Payload (包含检索中间过程)
    debugPayload: jsonb("debug_payload"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_retrieval_runs_query_id").on(table.queryId)],
);

/**
 * 检索候选分块表 (retrieval_candidates)
 * 记录单次检索召回的所有候选文档分块及其评分。
 */
export const retrievalCandidates = pgTable(
  "retrieval_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 关联的检索运行 ID
    retrievalRunId: uuid("retrieval_run_id")
      .notNull()
      .references(() => retrievalRuns.id, { onDelete: "cascade" }),
    // 候选分块 ID
    chunkId: uuid("chunk_id").references(() => legalDocumentChunks.id, {
      onDelete: "set null",
    }),
    // 所属文档 ID
    documentId: uuid("document_id").references(() => legalDocuments.id, {
      onDelete: "set null",
    }),
    // 向量检索排名
    sourceRankDense: integer("source_rank_dense"),
    // 词法检索排名
    sourceRankLexical: integer("source_rank_lexical"),
    // 融合后排名
    fusedRank: integer("fused_rank"),
    // 重排后排名
    rerankedRank: integer("reranked_rank"),
    // 向量得分
    denseScore: numeric("dense_score", { precision: 10, scale: 6 }),
    // 词法得分
    lexicalScore: numeric("lexical_score", { precision: 10, scale: 6 }),
    // 融合得分
    fusedScore: numeric("fused_score", { precision: 10, scale: 6 }),
    // 重排得分
    rerankedScore: numeric("reranked_score", { precision: 10, scale: 6 }),
    // 是否被选入最终 LLM 回答的上下文
    selectedForAnswer: boolean("selected_for_answer").notNull().default(false),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_retrieval_candidates_run_id").on(table.retrievalRunId),
    index("idx_retrieval_candidates_chunk_id").on(table.chunkId),
  ],
);
