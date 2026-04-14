import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { conversations, messages } from "./chat";
import { legalDocumentChunks, legalDocuments } from "./documents";
import { retrievalRuns, searchQueries } from "./retrieval";

export const answerSessions = pgTable(
  "answer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    assistantMessageId: uuid("assistant_message_id").references(
      () => messages.id,
      { onDelete: "set null" },
    ),
    queryId: uuid("query_id").references(() => searchQueries.id, {
      onDelete: "set null",
    }),
    retrievalRunId: uuid("retrieval_run_id").references(
      () => retrievalRuns.id,
      { onDelete: "set null" },
    ),
    modelProvider: varchar("model_provider", { length: 100 }).notNull(),
    modelName: varchar("model_name", { length: 255 }).notNull(),
    promptVersion: varchar("prompt_version", { length: 50 }),
    systemPromptSnapshot: text("system_prompt_snapshot"),
    answerText: text("answer_text"),
    answerJson: jsonb("answer_json"),
    streamCompleted: boolean("stream_completed").notNull().default(false),
    validationStatus: varchar("validation_status", { length: 50 })
      .notNull()
      .default("pending"),
    confidenceLabel: varchar("confidence_label", { length: 50 }),
    latencyMs: integer("latency_ms"),
    tokenInput: integer("token_input"),
    tokenOutput: integer("token_output"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_answer_sessions_conversation_id").on(table.conversationId),
    index("idx_answer_sessions_query_id").on(table.queryId),
    index("idx_answer_sessions_retrieval_run_id").on(table.retrievalRunId),
  ],
);

export const answerCitations = pgTable(
  "answer_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    answerSessionId: uuid("answer_session_id")
      .notNull()
      .references(() => answerSessions.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id").references(() => legalDocumentChunks.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => legalDocuments.id, {
      onDelete: "set null",
    }),
    citationLabel: varchar("citation_label", { length: 255 }),
    paragraphStartNo: integer("paragraph_start_no"),
    paragraphEndNo: integer("paragraph_end_no"),
    supportingExcerpt: text("supporting_excerpt"),
    answerSpanStart: integer("answer_span_start"),
    answerSpanEnd: integer("answer_span_end"),
    citationOrder: integer("citation_order").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_answer_citations_answer_session_id").on(table.answerSessionId),
    index("idx_answer_citations_chunk_id").on(table.chunkId),
  ],
);
