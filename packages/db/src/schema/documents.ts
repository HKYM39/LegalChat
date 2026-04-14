import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: varchar("source_type", { length: 50 })
      .notNull()
      .default("offline_import"),
    sourceUrl: text("source_url"),
    externalSourceId: varchar("external_source_id", { length: 255 }),
    title: text("title").notNull(),
    neutralCitation: varchar("neutral_citation", { length: 255 }),
    parallelCitation: text("parallel_citation"),
    court: varchar("court", { length: 255 }),
    jurisdiction: varchar("jurisdiction", { length: 255 }),
    decisionDate: date("decision_date", { mode: "string" }),
    judges: text("judges"),
    parties: text("parties"),
    documentType: varchar("document_type", { length: 100 })
      .notNull()
      .default("case"),
    language: varchar("language", { length: 20 }).notNull().default("en"),
    docketNumber: varchar("docket_number", { length: 255 }),
    summaryText: text("summary_text"),
    fullText: text("full_text").notNull(),
    rawText: text("raw_text"),
    textChecksum: varchar("text_checksum", { length: 128 }).notNull(),
    parseStatus: varchar("parse_status", { length: 50 })
      .notNull()
      .default("completed"),
    indexingStatus: varchar("indexing_status", { length: 50 })
      .notNull()
      .default("pending"),
    isActive: boolean("is_active").notNull().default(true),
    importedAt: timestamp("imported_at", {
      withTimezone: true,
      mode: "string",
    }),
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
    uniqueIndex("uq_legal_documents_text_checksum").on(table.textChecksum),
    index("idx_legal_documents_neutral_citation").on(table.neutralCitation),
    index("idx_legal_documents_court").on(table.court),
    index("idx_legal_documents_jurisdiction").on(table.jurisdiction),
    index("idx_legal_documents_decision_date").on(table.decisionDate),
    index("idx_legal_documents_document_type").on(table.documentType),
    index("idx_legal_documents_active").on(table.isActive),
  ],
);

export const legalDocumentSections = pgTable(
  "legal_document_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    parentSectionId: uuid("parent_section_id").references(
      (): typeof legalDocumentSections.id => legalDocumentSections.id,
      { onDelete: "set null" },
    ),
    level: integer("level").notNull(),
    sectionOrder: integer("section_order").notNull(),
    headingText: text("heading_text").notNull(),
    headingLabel: varchar("heading_label", { length: 255 }),
    sectionPath: text("section_path").notNull(),
    startParagraphNo: integer("start_paragraph_no"),
    endParagraphNo: integer("end_paragraph_no"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_legal_document_sections_document_id").on(table.documentId),
    index("idx_legal_document_sections_parent").on(table.parentSectionId),
  ],
);

export const legalDocumentParagraphs = pgTable(
  "legal_document_paragraphs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => legalDocumentSections.id, {
      onDelete: "set null",
    }),
    paragraphNo: integer("paragraph_no"),
    paragraphOrder: integer("paragraph_order").notNull(),
    paragraphText: text("paragraph_text").notNull(),
    charStart: integer("char_start"),
    charEnd: integer("char_end"),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_legal_document_paragraphs_document_id").on(table.documentId),
    index("idx_legal_document_paragraphs_document_para_no").on(
      table.documentId,
      table.paragraphNo,
    ),
    index("idx_legal_document_paragraphs_document_order").on(
      table.documentId,
      table.paragraphOrder,
    ),
  ],
);

export const legalDocumentChunks = pgTable(
  "legal_document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => legalDocumentSections.id, {
      onDelete: "set null",
    }),
    chunkIndex: integer("chunk_index").notNull(),
    chunkType: varchar("chunk_type", { length: 50 })
      .notNull()
      .default("paragraph_group"),
    chunkText: text("chunk_text").notNull(),
    paragraphStartNo: integer("paragraph_start_no"),
    paragraphEndNo: integer("paragraph_end_no"),
    headingPath: text("heading_path"),
    tokenCount: integer("token_count"),
    embeddingModelName: varchar("embedding_model_name", { length: 255 }),
    embeddingModelVersion: varchar("embedding_model_version", { length: 100 }),
    vectorProvider: varchar("vector_provider", { length: 100 }),
    vectorId: varchar("vector_id", { length: 255 }),
    chunkMetadata: jsonb("chunk_metadata"),
    isActive: boolean("is_active").notNull().default(true),
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
    uniqueIndex("uq_legal_document_chunks_doc_chunk_index").on(
      table.documentId,
      table.chunkIndex,
    ),
    index("idx_legal_document_chunks_document_id").on(table.documentId),
    index("idx_legal_document_chunks_vector_id").on(table.vectorId),
    index("idx_legal_document_chunks_para_range").on(
      table.paragraphStartNo,
      table.paragraphEndNo,
    ),
    index("idx_legal_document_chunks_active").on(table.isActive),
  ],
);

export const legalDocumentCitations = pgTable(
  "legal_document_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    paragraphId: uuid("paragraph_id").references(
      () => legalDocumentParagraphs.id,
      { onDelete: "set null" },
    ),
    chunkId: uuid("chunk_id").references(() => legalDocumentChunks.id, {
      onDelete: "set null",
    }),
    citationText: text("citation_text").notNull(),
    normalizedCitation: varchar("normalized_citation", { length: 255 }),
    citationType: varchar("citation_type", { length: 50 }).notNull(),
    targetDocumentId: uuid("target_document_id").references(
      () => legalDocuments.id,
      { onDelete: "set null" },
    ),
    startCharOffset: integer("start_char_offset"),
    endCharOffset: integer("end_char_offset"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_legal_document_citations_document_id").on(table.documentId),
    index("idx_legal_document_citations_normalized").on(
      table.normalizedCitation,
    ),
    index("idx_legal_document_citations_target_document_id").on(
      table.targetDocumentId,
    ),
  ],
);
