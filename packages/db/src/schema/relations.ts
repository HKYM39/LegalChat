/**
 * Drizzle 关系定义
 * 
 * 定义数据表之间的逻辑关联，支持 Drizzle 查询 API 的关联加载 (with 查询)。
 * 描述了从文档到段落、分块，从对话到消息、答案等完整的领域模型关联。
 */
import { relations } from "drizzle-orm";

import { answerCitations, answerSessions } from "./answers";
import { conversations, messages } from "./chat";
import {
  legalDocumentChunks,
  legalDocumentCitations,
  legalDocumentParagraphs,
  legalDocuments,
  legalDocumentSections,
} from "./documents";
import {
  evaluationDatasets,
  evaluationQueries,
  evaluationResults,
  evaluationRuns,
} from "./evaluation";
import {
  retrievalCandidates,
  retrievalRuns,
  searchQueries,
} from "./retrieval";

/**
 * 法律文档 (legal_documents) 关系
 */
export const legalDocumentsRelations = relations(legalDocuments, ({ many }) => ({
  sections: many(legalDocumentSections),
  paragraphs: many(legalDocumentParagraphs),
  chunks: many(legalDocumentChunks),
  citations: many(legalDocumentCitations, {
    relationName: "document_citations_source",
  }),
  citedBy: many(legalDocumentCitations, {
    relationName: "document_citations_target",
  }),
  retrievalCandidates: many(retrievalCandidates),
  answerCitations: many(answerCitations),
}));

/**
 * 法律文档章节 (legal_document_sections) 关系
 */
export const legalDocumentSectionsRelations = relations(
  legalDocumentSections,
  ({ one, many }) => ({
    document: one(legalDocuments, {
      fields: [legalDocumentSections.documentId],
      references: [legalDocuments.id],
    }),
    parentSection: one(legalDocumentSections, {
      fields: [legalDocumentSections.parentSectionId],
      references: [legalDocumentSections.id],
      relationName: "section_hierarchy",
    }),
    childSections: many(legalDocumentSections, {
      relationName: "section_hierarchy",
    }),
    paragraphs: many(legalDocumentParagraphs),
    chunks: many(legalDocumentChunks),
  }),
);

/**
 * 法律文档段落 (legal_document_paragraphs) 关系
 */
export const legalDocumentParagraphsRelations = relations(
  legalDocumentParagraphs,
  ({ one, many }) => ({
    document: one(legalDocuments, {
      fields: [legalDocumentParagraphs.documentId],
      references: [legalDocuments.id],
    }),
    section: one(legalDocumentSections, {
      fields: [legalDocumentParagraphs.sectionId],
      references: [legalDocumentSections.id],
    }),
    citations: many(legalDocumentCitations),
  }),
);

/**
 * 法律文档分块 (legal_document_chunks) 关系
 */
export const legalDocumentChunksRelations = relations(
  legalDocumentChunks,
  ({ one, many }) => ({
    document: one(legalDocuments, {
      fields: [legalDocumentChunks.documentId],
      references: [legalDocuments.id],
    }),
    section: one(legalDocumentSections, {
      fields: [legalDocumentChunks.sectionId],
      references: [legalDocumentSections.id],
    }),
    citations: many(legalDocumentCitations),
    retrievalCandidates: many(retrievalCandidates),
    answerCitations: many(answerCitations),
  }),
);

/**
 * 法律引用 (legal_document_citations) 关系
 */
export const legalDocumentCitationsRelations = relations(
  legalDocumentCitations,
  ({ one }) => ({
    document: one(legalDocuments, {
      fields: [legalDocumentCitations.documentId],
      references: [legalDocuments.id],
      relationName: "document_citations_source",
    }),
    paragraph: one(legalDocumentParagraphs, {
      fields: [legalDocumentCitations.paragraphId],
      references: [legalDocumentParagraphs.id],
    }),
    chunk: one(legalDocumentChunks, {
      fields: [legalDocumentCitations.chunkId],
      references: [legalDocumentChunks.id],
    }),
    targetDocument: one(legalDocuments, {
      fields: [legalDocumentCitations.targetDocumentId],
      references: [legalDocuments.id],
      relationName: "document_citations_target",
    }),
  }),
);

/**
 * 对话 (conversations) 关系
 */
export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  searchQueries: many(searchQueries),
  answerSessions: many(answerSessions),
}));

/**
 * 消息 (messages) 关系
 */
export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  searchQueries: many(searchQueries),
  answerSessions: many(answerSessions),
}));

/**
 * 查询 (search_queries) 关系
 */
export const searchQueriesRelations = relations(searchQueries, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [searchQueries.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [searchQueries.messageId],
    references: [messages.id],
  }),
  retrievalRuns: many(retrievalRuns),
  answerSessions: many(answerSessions),
}));

/**
 * 检索运行 (retrieval_runs) 关系
 */
export const retrievalRunsRelations = relations(retrievalRuns, ({ one, many }) => ({
  query: one(searchQueries, {
    fields: [retrievalRuns.queryId],
    references: [searchQueries.id],
  }),
  candidates: many(retrievalCandidates),
  answerSessions: many(answerSessions),
}));

/**
 * 检索候选分块 (retrieval_candidates) 关系
 */
export const retrievalCandidatesRelations = relations(
  retrievalCandidates,
  ({ one }) => ({
    retrievalRun: one(retrievalRuns, {
      fields: [retrievalCandidates.retrievalRunId],
      references: [retrievalRuns.id],
    }),
    chunk: one(legalDocumentChunks, {
      fields: [retrievalCandidates.chunkId],
      references: [legalDocumentChunks.id],
    }),
    document: one(legalDocuments, {
      fields: [retrievalCandidates.documentId],
      references: [legalDocuments.id],
    }),
  }),
);

/**
 * 答案会话 (answer_sessions) 关系
 */
export const answerSessionsRelations = relations(answerSessions, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [answerSessions.conversationId],
    references: [conversations.id],
  }),
  assistantMessage: one(messages, {
    fields: [answerSessions.assistantMessageId],
    references: [messages.id],
  }),
  query: one(searchQueries, {
    fields: [answerSessions.queryId],
    references: [searchQueries.id],
  }),
  retrievalRun: one(retrievalRuns, {
    fields: [answerSessions.retrievalRunId],
    references: [retrievalRuns.id],
  }),
  citations: many(answerCitations),
}));

/**
 * 答案引用 (answer_citations) 关系
 */
export const answerCitationsRelations = relations(answerCitations, ({ one }) => ({
  answerSession: one(answerSessions, {
    fields: [answerCitations.answerSessionId],
    references: [answerSessions.id],
  }),
  chunk: one(legalDocumentChunks, {
    fields: [answerCitations.chunkId],
    references: [legalDocumentChunks.id],
  }),
  document: one(legalDocuments, {
    fields: [answerCitations.documentId],
    references: [legalDocuments.id],
  }),
}));

/**
 * 评估数据集 (evaluation_datasets) 关系
 */
export const evaluationDatasetsRelations = relations(
  evaluationDatasets,
  ({ many }) => ({
    queries: many(evaluationQueries),
    runs: many(evaluationRuns),
  }),
);

/**
 * 评估查询 (evaluation_queries) 关系
 */
export const evaluationQueriesRelations = relations(
  evaluationQueries,
  ({ one, many }) => ({
    dataset: one(evaluationDatasets, {
      fields: [evaluationQueries.datasetId],
      references: [evaluationDatasets.id],
    }),
    results: many(evaluationResults),
  }),
);

/**
 * 评估运行 (evaluation_runs) 关系
 */
export const evaluationRunsRelations = relations(evaluationRuns, ({ one, many }) => ({
  dataset: one(evaluationDatasets, {
    fields: [evaluationRuns.datasetId],
    references: [evaluationDatasets.id],
  }),
  results: many(evaluationResults),
}));

/**
 * 评估结果 (evaluation_results) 关系
 */
export const evaluationResultsRelations = relations(
  evaluationResults,
  ({ one }) => ({
    run: one(evaluationRuns, {
      fields: [evaluationResults.evaluationRunId],
      references: [evaluationRuns.id],
    }),
    query: one(evaluationQueries, {
      fields: [evaluationResults.evaluationQueryId],
      references: [evaluationQueries.id],
    }),
  }),
);
