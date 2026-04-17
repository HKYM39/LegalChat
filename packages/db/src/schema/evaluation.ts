/**
 * RAG 评估数据表定义
 * 
 * 用于存储评估数据集、查询、运行记录及结果。
 * 支持对检索准确率、回答一致性等指标进行量化评估。
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

/**
 * 评估数据集 (evaluation_datasets)
 * 定义一组用于测试的黄金问题集。
 */
export const evaluationDatasets = pgTable("evaluation_datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  // 数据集名称
  name: varchar("name", { length: 255 }).notNull(),
  // 数据集描述
  description: text("description"),
  // 是否激活
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});

/**
 * 评估查询项 (evaluation_queries)
 * 存储数据集中的具体问题及期望的召回结果 (Ground Truth)。
 */
export const evaluationQueries = pgTable(
  "evaluation_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 所属数据集 ID
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => evaluationDatasets.id, { onDelete: "cascade" }),
    // 测试问题文本
    queryText: text("query_text").notNull(),
    // 查询类型 (语义、词法、混合)
    queryType: varchar("query_type", { length: 50 }).notNull(),
    // 期望召回的文档 ID 列表
    expectedDocumentIds: jsonb("expected_document_ids"),
    // 期望的引用段落
    expectedCitations: jsonb("expected_citations"),
    // 期望包含的关键术语
    expectedKeywords: jsonb("expected_keywords"),
    // 备注信息
    notes: text("notes"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_evaluation_queries_dataset_id").on(table.datasetId)],
);

/**
 * 评估运行记录 (evaluation_runs)
 * 记录一次完整的评估实验及其配置。
 */
export const evaluationRuns = pgTable(
  "evaluation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 针对的数据集 ID
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => evaluationDatasets.id, { onDelete: "cascade" }),
    // 评估采用的检索策略
    retrievalStrategy: varchar("retrieval_strategy", { length: 100 }).notNull(),
    // 评估采用的 LLM
    llmModelName: varchar("llm_model_name", { length: 255 }),
    // 评估采用的嵌入模型
    embeddingModelName: varchar("embedding_model_name", { length: 255 }),
    // 评估采用的重排模型
    rerankerModelName: varchar("reranker_model_name", { length: 255 }),
    // 运行状态 (queued, running, completed, failed)
    status: varchar("status", { length: 50 }).notNull().default("queued"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    }),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_evaluation_runs_dataset_id").on(table.datasetId)],
);

/**
 * 评估详细结果 (evaluation_results)
 * 记录单条查询在特定运行中的性能得分。
 */
export const evaluationResults = pgTable(
  "evaluation_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 所属评估运行 ID
    evaluationRunId: uuid("evaluation_run_id")
      .notNull()
      .references(() => evaluationRuns.id, { onDelete: "cascade" }),
    // 对应的评估查询 ID
    evaluationQueryId: uuid("evaluation_query_id")
      .notNull()
      .references(() => evaluationQueries.id, { onDelete: "cascade" }),
    // Top 5 召回准确率
    precisionAt5: numeric("precision_at_5", { precision: 10, scale: 4 }),
    // Top 5 召回率
    recallAt5: numeric("recall_at_5", { precision: 10, scale: 4 }),
    // 引用准确性得分
    citationAccuracy: numeric("citation_accuracy", {
      precision: 10,
      scale: 4,
    }),
    // 答案依据得分 (Groundedness)
    groundednessScore: numeric("groundedness_score", {
      precision: 10,
      scale: 4,
    }),
    // 耗时 (毫秒)
    latencyMs: integer("latency_ms"),
    // 原始结果 Payload (用于调试)
    resultPayload: jsonb("result_payload"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_evaluation_results_run_id").on(table.evaluationRunId),
    index("idx_evaluation_results_query_id").on(table.evaluationQueryId),
  ],
);
