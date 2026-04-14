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

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  searchQueries: many(searchQueries),
  answerSessions: many(answerSessions),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  searchQueries: many(searchQueries),
  answerSessions: many(answerSessions),
}));

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

export const retrievalRunsRelations = relations(retrievalRuns, ({ one, many }) => ({
  query: one(searchQueries, {
    fields: [retrievalRuns.queryId],
    references: [searchQueries.id],
  }),
  candidates: many(retrievalCandidates),
  answerSessions: many(answerSessions),
}));

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

export const evaluationDatasetsRelations = relations(
  evaluationDatasets,
  ({ many }) => ({
    queries: many(evaluationQueries),
    runs: many(evaluationRuns),
  }),
);

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

export const evaluationRunsRelations = relations(evaluationRuns, ({ one, many }) => ({
  dataset: one(evaluationDatasets, {
    fields: [evaluationRuns.datasetId],
    references: [evaluationDatasets.id],
  }),
  results: many(evaluationResults),
}));

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
