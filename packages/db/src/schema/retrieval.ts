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

export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    queryText: text("query_text").notNull(),
    normalizedQuery: text("normalized_query"),
    queryType: varchar("query_type", { length: 50 }).notNull(),
    filtersJson: jsonb("filters_json"),
    queryLanguage: varchar("query_language", { length: 20 })
      .notNull()
      .default("en"),
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

export const retrievalRuns = pgTable(
  "retrieval_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queryId: uuid("query_id")
      .notNull()
      .references(() => searchQueries.id, { onDelete: "cascade" }),
    retrievalStrategy: varchar("retrieval_strategy", { length: 100 }).notNull(),
    denseModelName: varchar("dense_model_name", { length: 255 }),
    rerankerModelName: varchar("reranker_model_name", { length: 255 }),
    lexicalEngine: varchar("lexical_engine", { length: 100 }),
    metadataFiltersJson: jsonb("metadata_filters_json"),
    denseTopK: integer("dense_top_k"),
    lexicalTopK: integer("lexical_top_k"),
    fusedTopK: integer("fused_top_k"),
    latencyMs: integer("latency_ms"),
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

export const retrievalCandidates = pgTable(
  "retrieval_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    retrievalRunId: uuid("retrieval_run_id")
      .notNull()
      .references(() => retrievalRuns.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id").references(() => legalDocumentChunks.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => legalDocuments.id, {
      onDelete: "set null",
    }),
    sourceRankDense: integer("source_rank_dense"),
    sourceRankLexical: integer("source_rank_lexical"),
    fusedRank: integer("fused_rank"),
    rerankedRank: integer("reranked_rank"),
    denseScore: numeric("dense_score", { precision: 10, scale: 6 }),
    lexicalScore: numeric("lexical_score", { precision: 10, scale: 6 }),
    fusedScore: numeric("fused_score", { precision: 10, scale: 6 }),
    rerankedScore: numeric("reranked_score", { precision: 10, scale: 6 }),
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
