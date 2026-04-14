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

export const evaluationDatasets = pgTable("evaluation_datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});

export const evaluationQueries = pgTable(
  "evaluation_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => evaluationDatasets.id, { onDelete: "cascade" }),
    queryText: text("query_text").notNull(),
    queryType: varchar("query_type", { length: 50 }).notNull(),
    expectedDocumentIds: jsonb("expected_document_ids"),
    expectedCitations: jsonb("expected_citations"),
    expectedKeywords: jsonb("expected_keywords"),
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

export const evaluationRuns = pgTable(
  "evaluation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => evaluationDatasets.id, { onDelete: "cascade" }),
    retrievalStrategy: varchar("retrieval_strategy", { length: 100 }).notNull(),
    llmModelName: varchar("llm_model_name", { length: 255 }),
    embeddingModelName: varchar("embedding_model_name", { length: 255 }),
    rerankerModelName: varchar("reranker_model_name", { length: 255 }),
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

export const evaluationResults = pgTable(
  "evaluation_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evaluationRunId: uuid("evaluation_run_id")
      .notNull()
      .references(() => evaluationRuns.id, { onDelete: "cascade" }),
    evaluationQueryId: uuid("evaluation_query_id")
      .notNull()
      .references(() => evaluationQueries.id, { onDelete: "cascade" }),
    precisionAt5: numeric("precision_at_5", { precision: 10, scale: 4 }),
    recallAt5: numeric("recall_at_5", { precision: 10, scale: 4 }),
    citationAccuracy: numeric("citation_accuracy", {
      precision: 10,
      scale: 4,
    }),
    groundednessScore: numeric("groundedness_score", {
      precision: 10,
      scale: 4,
    }),
    latencyMs: integer("latency_ms"),
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
