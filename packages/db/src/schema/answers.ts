/**
 * 答案与引用数据表定义
 * 
 * 记录 LLM 生成的答案会话，以及这些答案与原始法律文档分块之间的引用关系。
 * 支持回答的溯源 (Grounding) 和验证。
 */
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

/**
 * 答案会话表 (answer_sessions)
 * 存储 LLM 针对某一查询生成的完整回答及其元数据。
 */
export const answerSessions = pgTable(
  "answer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 关联的对话 ID
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    // 关联的 AI 消息 ID
    assistantMessageId: uuid("assistant_message_id").references(
      () => messages.id,
      { onDelete: "set null" },
    ),
    // 触发回答的查询 ID
    queryId: uuid("query_id").references(() => searchQueries.id, {
      onDelete: "set null",
    }),
    // 支撑回答的检索运行 ID
    retrievalRunId: uuid("retrieval_run_id").references(
      () => retrievalRuns.id,
      { onDelete: "set null" },
    ),
    // 模型供应商 (如 OpenAI, Anthropic)
    modelProvider: varchar("model_provider", { length: 100 }).notNull(),
    // 具体模型名称 (如 gpt-4, claude-3)
    modelName: varchar("model_name", { length: 255 }).notNull(),
    // 提示词版本
    promptVersion: varchar("prompt_version", { length: 50 }),
    // 系统提示词快照
    systemPromptSnapshot: text("system_prompt_snapshot"),
    // 生成的纯文本答案
    answerText: text("answer_text"),
    // 结构化答案内容 (如果模型输出 JSON)
    answerJson: jsonb("answer_json"),
    // 流式传输是否完成
    streamCompleted: boolean("stream_completed").notNull().default(false),
    // 验证状态 (pending, validated, rejected)
    validationStatus: varchar("validation_status", { length: 50 })
      .notNull()
      .default("pending"),
    // 置信度标签
    confidenceLabel: varchar("confidence_label", { length: 50 }),
    // 生成耗时 (毫秒)
    latencyMs: integer("latency_ms"),
    // 输入 Token 数
    tokenInput: integer("token_input"),
    // 输出 Token 数
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

/**
 * 答案引用依据表 (answer_citations)
 * 细粒度地记录答案中每一处引用所指向的原始文档片段。
 */
export const answerCitations = pgTable(
  "answer_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 关联的答案会话 ID
    answerSessionId: uuid("answer_session_id")
      .notNull()
      .references(() => answerSessions.id, { onDelete: "cascade" }),
    // 引用的具体分块 ID
    chunkId: uuid("chunk_id").references(() => legalDocumentChunks.id, {
      onDelete: "set null",
    }),
    // 引用的所属文档 ID
    documentId: uuid("document_id").references(() => legalDocuments.id, {
      onDelete: "set null",
    }),
    // 引用标签 (如 [1])
    citationLabel: varchar("citation_label", { length: 255 }),
    // 起始段落号
    paragraphStartNo: integer("paragraph_start_no"),
    // 结束段落号
    paragraphEndNo: integer("paragraph_end_no"),
    // 支撑回答的具体文本片段
    supportingExcerpt: text("supporting_excerpt"),
    // 该引用在答案文本中的起始字符位置
    answerSpanStart: integer("answer_span_start"),
    // 该引用在答案文本中的结束字符位置
    answerSpanEnd: integer("answer_span_end"),
    // 引用在答案中出现的顺序
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
