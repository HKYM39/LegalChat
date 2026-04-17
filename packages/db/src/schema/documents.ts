/**
 * 法律文档核心数据表定义
 * 
 * 本文件定义了法律案例、段落、分块及引用的物理存储结构，
 * 与 RAG (检索增强生成) 流程紧密对齐。
 */
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

/**
 * 法律文档主表 (legal_documents)
 * 存储案件的基本元数据，如标题、法院、日期等。
 */
export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 数据来源类型，默认为离线导入
    sourceType: varchar("source_type", { length: 50 })
      .notNull()
      .default("offline_import"),
    // 原始文档 URL
    sourceUrl: text("source_url"),
    // 外部系统标识符
    externalSourceId: varchar("external_source_id", { length: 255 }),
    // 案件标题 (如 Birketu Pty Ltd v Atanaskovic)
    title: text("title").notNull(),
    // 中立引用号 (如 [2025] HCA 2)
    neutralCitation: varchar("neutral_citation", { length: 255 }),
    // 平行引用
    parallelCitation: text("parallel_citation"),
    // 审理法院
    court: varchar("court", { length: 255 }),
    // 管辖区
    jurisdiction: varchar("jurisdiction", { length: 255 }),
    // 判决日期
    decisionDate: date("decision_date", { mode: "string" }),
    // 审理法官
    judges: text("judges"),
    // 案件当事人
    parties: text("parties"),
    // 文档类型 (case, legislation 等)
    documentType: varchar("document_type", { length: 100 })
      .notNull()
      .default("case"),
    // 语言
    language: varchar("language", { length: 20 }).notNull().default("en"),
    // 案件编号
    docketNumber: varchar("docket_number", { length: 255 }),
    // 案件摘要 (用于快速预览)
    summaryText: text("summary_text"),
    // 清洗后的全文
    fullText: text("full_text").notNull(),
    // 原始提取文本
    rawText: text("raw_text"),
    // 文本校验和，用于去重
    textChecksum: varchar("text_checksum", { length: 128 }).notNull(),
    // 解析状态 (pending, processing, completed, failed)
    parseStatus: varchar("parse_status", { length: 50 })
      .notNull()
      .default("completed"),
    // 向量索引状态 (pending, completed)
    indexingStatus: varchar("indexing_status", { length: 50 })
      .notNull()
      .default("pending"),
    // 是否激活
    isActive: boolean("is_active").notNull().default(true),
    // 导入时间
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

/**
 * 法律文档章节表 (legal_document_sections)
 * 存储文档的分级结构信息（标题、层级等）。
 */
export const legalDocumentSections = pgTable(
  "legal_document_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 所属文档 ID
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    // 父章节 ID (支持递归结构)
    parentSectionId: uuid("parent_section_id").references(
      (): typeof legalDocumentSections.id => legalDocumentSections.id,
      { onDelete: "set null" },
    ),
    // 章节层级 (1, 2, 3...)
    level: integer("level").notNull(),
    // 章节顺序
    sectionOrder: integer("section_order").notNull(),
    // 标题文本
    headingText: text("heading_text").notNull(),
    // 标题标签 (如 "I", "A", "1")
    headingLabel: varchar("heading_label", { length: 255 }),
    // 章节路径 (用于全文检索和面包屑展示)
    sectionPath: text("section_path").notNull(),
    // 该章节涵盖的起始段落号
    startParagraphNo: integer("start_paragraph_no"),
    // 该章节涵盖的结束段落号
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

/**
 * 法律文档段落表 (legal_document_paragraphs)
 * 法律文档原子级的存储单位，保留原始段落编号和顺序。
 */
export const legalDocumentParagraphs = pgTable(
  "legal_document_paragraphs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 所属文档 ID
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    // 所属章节 ID
    sectionId: uuid("section_id").references(() => legalDocumentSections.id, {
      onDelete: "set null",
    }),
    // 法律原文中的段落编号 (如 [42])
    paragraphNo: integer("paragraph_no"),
    // 物理排列顺序
    paragraphOrder: integer("paragraph_order").notNull(),
    // 段落正文内容
    paragraphText: text("paragraph_text").notNull(),
    // 在全文中的字符起始位置
    charStart: integer("char_start"),
    // 在全文中的字符结束位置
    charEnd: integer("char_end"),
    // 预估或实际 Token 数
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

/**
 * 法律文档分块表 (legal_document_chunks)
 * 用于向量搜索的检索单位，通常由一个或多个段落组成。
 */
export const legalDocumentChunks = pgTable(
  "legal_document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 所属文档 ID
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    // 所属章节 ID
    sectionId: uuid("section_id").references(() => legalDocumentSections.id, {
      onDelete: "set null",
    }),
    // 分块在文档中的索引
    chunkIndex: integer("chunk_index").notNull(),
    // 分块类型 (paragraph_group, summary 等)
    chunkType: varchar("chunk_type", { length: 50 })
      .notNull()
      .default("paragraph_group"),
    // 用于嵌入的文本内容
    chunkText: text("chunk_text").notNull(),
    // 起始段落号 (回溯依据)
    paragraphStartNo: integer("paragraph_start_no"),
    // 结束段落号 (回溯依据)
    paragraphEndNo: integer("paragraph_end_no"),
    // 章节路径 (辅助检索增强)
    headingPath: text("heading_path"),
    // Token 数量
    tokenCount: integer("token_count"),
    // 嵌入模型名称
    embeddingModelName: varchar("embedding_model_name", { length: 255 }),
    // 嵌入模型版本
    embeddingModelVersion: varchar("embedding_model_version", { length: 100 }),
    // 向量库提供商 (如 Pinecone)
    vectorProvider: varchar("vector_provider", { length: 100 }),
    // 向量库中的 ID
    vectorId: varchar("vector_id", { length: 255 }),
    // 额外元数据 (JSONB 格式)
    chunkMetadata: jsonb("chunk_metadata"),
    // 是否激活
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

/**
 * 法律引用表 (legal_document_citations)
 * 记录文档内部对其他法律文件或段落的显式引用。
 */
export const legalDocumentCitations = pgTable(
  "legal_document_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 引用发起文档 ID
    documentId: uuid("document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "cascade" }),
    // 引用发起段落 ID
    paragraphId: uuid("paragraph_id").references(
      () => legalDocumentParagraphs.id,
      { onDelete: "set null" },
    ),
    // 引用发起分块 ID
    chunkId: uuid("chunk_id").references(() => legalDocumentChunks.id, {
      onDelete: "set null",
    }),
    // 原始引用文本
    citationText: text("citation_text").notNull(),
    // 标准化引用格式 (如 [2025] HCA 2)
    normalizedCitation: varchar("normalized_citation", { length: 255 }),
    // 引用类型 (case, legislation, article)
    citationType: varchar("citation_type", { length: 50 }).notNull(),
    // 目标文档 ID (如果已在库中)
    targetDocumentId: uuid("target_document_id").references(
      () => legalDocuments.id,
      { onDelete: "set null" },
    ),
    // 在发起段落中的字符起始位置
    startCharOffset: integer("start_char_offset"),
    // 在发起段落中的字符结束位置
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

