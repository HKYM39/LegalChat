-- 001_init_schema.sql
-- Legal Casebase AI Assistant MVP
-- PostgreSQL schema for:
-- - Hono backend
-- - Drizzle ORM
-- - Pinecone vector retrieval
-- - chat-first legal AI assistant
-- - Python only for offline PDF -> JSON processing

BEGIN;

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Core legal documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL DEFAULT 'offline_import',
    source_url TEXT,
    external_source_id VARCHAR(255),
    title TEXT NOT NULL,
    neutral_citation VARCHAR(255),
    parallel_citation TEXT,
    court VARCHAR(255),
    jurisdiction VARCHAR(255),
    decision_date DATE,
    judges TEXT,
    parties TEXT,
    document_type VARCHAR(100) NOT NULL DEFAULT 'case',
    language VARCHAR(20) NOT NULL DEFAULT 'en',
    docket_number VARCHAR(255),
    summary_text TEXT,
    full_text TEXT NOT NULL,
    raw_text TEXT,
    text_checksum VARCHAR(128) NOT NULL,
    parse_status VARCHAR(50) NOT NULL DEFAULT 'completed',
    indexing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    imported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE legal_documents IS 'Canonical legal document records.';
COMMENT ON COLUMN legal_documents.source_type IS 'Data source type, e.g. offline_import, seed, manual.';
COMMENT ON COLUMN legal_documents.source_url IS 'Original source URL if available.';
COMMENT ON COLUMN legal_documents.external_source_id IS 'External source-specific document ID.';
COMMENT ON COLUMN legal_documents.title IS 'Document title or case title.';
COMMENT ON COLUMN legal_documents.neutral_citation IS 'Neutral citation, e.g. [1992] HCA 23.';
COMMENT ON COLUMN legal_documents.parallel_citation IS 'Parallel citation(s) if available.';
COMMENT ON COLUMN legal_documents.court IS 'Court name.';
COMMENT ON COLUMN legal_documents.jurisdiction IS 'Jurisdiction, e.g. Australia, NSW.';
COMMENT ON COLUMN legal_documents.decision_date IS 'Decision date.';
COMMENT ON COLUMN legal_documents.judges IS 'Judges, stored as text for MVP.';
COMMENT ON COLUMN legal_documents.parties IS 'Parties, stored as text for MVP.';
COMMENT ON COLUMN legal_documents.document_type IS 'case, legislation, regulation, etc.';
COMMENT ON COLUMN legal_documents.summary_text IS 'Short summary or headnote-like text.';
COMMENT ON COLUMN legal_documents.full_text IS 'Cleaned full text used for display and reference.';
COMMENT ON COLUMN legal_documents.raw_text IS 'Raw extracted text before cleanup.';
COMMENT ON COLUMN legal_documents.text_checksum IS 'Checksum used for deduplication.';
COMMENT ON COLUMN legal_documents.parse_status IS 'Document parse status.';
COMMENT ON COLUMN legal_documents.indexing_status IS 'Indexing status for chunk/vector pipeline.';
COMMENT ON COLUMN legal_documents.is_active IS 'Soft-active flag.';
COMMENT ON COLUMN legal_documents.imported_at IS 'Import timestamp.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_documents_text_checksum
    ON legal_documents(text_checksum);

CREATE INDEX IF NOT EXISTS idx_legal_documents_neutral_citation
    ON legal_documents(neutral_citation);

CREATE INDEX IF NOT EXISTS idx_legal_documents_court
    ON legal_documents(court);

CREATE INDEX IF NOT EXISTS idx_legal_documents_jurisdiction
    ON legal_documents(jurisdiction);

CREATE INDEX IF NOT EXISTS idx_legal_documents_decision_date
    ON legal_documents(decision_date);

CREATE INDEX IF NOT EXISTS idx_legal_documents_document_type
    ON legal_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_legal_documents_active
    ON legal_documents(is_active);

-- ============================================================================
-- Document sections
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_document_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    parent_section_id UUID REFERENCES legal_document_sections(id) ON DELETE SET NULL,
    level INTEGER NOT NULL,
    section_order INTEGER NOT NULL,
    heading_text TEXT NOT NULL,
    heading_label VARCHAR(255),
    section_path TEXT NOT NULL,
    start_paragraph_no INTEGER,
    end_paragraph_no INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE legal_document_sections IS 'Heading/section hierarchy within a legal document.';
COMMENT ON COLUMN legal_document_sections.parent_section_id IS 'Parent section for hierarchical structure.';
COMMENT ON COLUMN legal_document_sections.level IS 'Hierarchy level starting from 1.';
COMMENT ON COLUMN legal_document_sections.section_order IS 'Order of appearance in the document.';
COMMENT ON COLUMN legal_document_sections.heading_text IS 'Visible heading text.';
COMMENT ON COLUMN legal_document_sections.heading_label IS 'Optional heading label like Part I.';
COMMENT ON COLUMN legal_document_sections.section_path IS 'Full hierarchical path of headings.';
COMMENT ON COLUMN legal_document_sections.start_paragraph_no IS 'First paragraph number within section.';
COMMENT ON COLUMN legal_document_sections.end_paragraph_no IS 'Last paragraph number within section.';

CREATE INDEX IF NOT EXISTS idx_legal_document_sections_document_id
    ON legal_document_sections(document_id);

CREATE INDEX IF NOT EXISTS idx_legal_document_sections_parent
    ON legal_document_sections(parent_section_id);

-- ============================================================================
-- Paragraphs
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_document_paragraphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    section_id UUID REFERENCES legal_document_sections(id) ON DELETE SET NULL,
    paragraph_no INTEGER,
    paragraph_order INTEGER NOT NULL,
    paragraph_text TEXT NOT NULL,
    char_start INTEGER,
    char_end INTEGER,
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE legal_document_paragraphs IS 'Paragraph-level source text for legal documents.';
COMMENT ON COLUMN legal_document_paragraphs.section_id IS 'Section containing this paragraph.';
COMMENT ON COLUMN legal_document_paragraphs.paragraph_no IS 'Visible paragraph number if available.';
COMMENT ON COLUMN legal_document_paragraphs.paragraph_order IS 'Sequential order in document.';
COMMENT ON COLUMN legal_document_paragraphs.char_start IS 'Character start in full_text if tracked.';
COMMENT ON COLUMN legal_document_paragraphs.char_end IS 'Character end in full_text if tracked.';
COMMENT ON COLUMN legal_document_paragraphs.token_count IS 'Approximate token count.';

CREATE INDEX IF NOT EXISTS idx_legal_document_paragraphs_document_id
    ON legal_document_paragraphs(document_id);

CREATE INDEX IF NOT EXISTS idx_legal_document_paragraphs_document_para_no
    ON legal_document_paragraphs(document_id, paragraph_no);

CREATE INDEX IF NOT EXISTS idx_legal_document_paragraphs_document_order
    ON legal_document_paragraphs(document_id, paragraph_order);

-- ============================================================================
-- Retrieval chunks
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    section_id UUID REFERENCES legal_document_sections(id) ON DELETE SET NULL,
    chunk_index INTEGER NOT NULL,
    chunk_type VARCHAR(50) NOT NULL DEFAULT 'paragraph_group',
    chunk_text TEXT NOT NULL,
    paragraph_start_no INTEGER,
    paragraph_end_no INTEGER,
    heading_path TEXT,
    token_count INTEGER,
    embedding_model_name VARCHAR(255),
    embedding_model_version VARCHAR(100),
    vector_provider VARCHAR(100),
    vector_id VARCHAR(255),
    chunk_metadata JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE legal_document_chunks IS 'Chunk-level evidence units used for retrieval and grounding.';
COMMENT ON COLUMN legal_document_chunks.chunk_index IS 'Chunk order within a document.';
COMMENT ON COLUMN legal_document_chunks.chunk_type IS 'paragraph_group, section_summary, etc.';
COMMENT ON COLUMN legal_document_chunks.paragraph_start_no IS 'First paragraph number included in chunk.';
COMMENT ON COLUMN legal_document_chunks.paragraph_end_no IS 'Last paragraph number included in chunk.';
COMMENT ON COLUMN legal_document_chunks.heading_path IS 'Heading path associated with chunk.';
COMMENT ON COLUMN legal_document_chunks.embedding_model_name IS 'Embedding model used.';
COMMENT ON COLUMN legal_document_chunks.embedding_model_version IS 'Embedding model version.';
COMMENT ON COLUMN legal_document_chunks.vector_provider IS 'Vector store provider, e.g. pinecone.';
COMMENT ON COLUMN legal_document_chunks.vector_id IS 'External vector database record ID.';
COMMENT ON COLUMN legal_document_chunks.chunk_metadata IS 'Additional structured retrieval metadata.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_document_chunks_doc_chunk_index
    ON legal_document_chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_legal_document_chunks_document_id
    ON legal_document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_legal_document_chunks_vector_id
    ON legal_document_chunks(vector_id);

CREATE INDEX IF NOT EXISTS idx_legal_document_chunks_para_range
    ON legal_document_chunks(paragraph_start_no, paragraph_end_no);

CREATE INDEX IF NOT EXISTS idx_legal_document_chunks_active
    ON legal_document_chunks(is_active);

-- ============================================================================
-- Extracted citations inside documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_document_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    paragraph_id UUID REFERENCES legal_document_paragraphs(id) ON DELETE SET NULL,
    chunk_id UUID REFERENCES legal_document_chunks(id) ON DELETE SET NULL,
    citation_text TEXT NOT NULL,
    normalized_citation VARCHAR(255),
    citation_type VARCHAR(50) NOT NULL,
    target_document_id UUID REFERENCES legal_documents(id) ON DELETE SET NULL,
    start_char_offset INTEGER,
    end_char_offset INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE legal_document_citations IS 'Citations extracted from documents.';
COMMENT ON COLUMN legal_document_citations.citation_text IS 'Raw citation text found in source.';
COMMENT ON COLUMN legal_document_citations.normalized_citation IS 'Normalized citation if resolved.';
COMMENT ON COLUMN legal_document_citations.citation_type IS 'case, legislation, section, regulation, etc.';
COMMENT ON COLUMN legal_document_citations.target_document_id IS 'Resolved target document if known.';

CREATE INDEX IF NOT EXISTS idx_legal_document_citations_document_id
    ON legal_document_citations(document_id);

CREATE INDEX IF NOT EXISTS idx_legal_document_citations_normalized
    ON legal_document_citations(normalized_citation);

CREATE INDEX IF NOT EXISTS idx_legal_document_citations_target_document_id
    ON legal_document_citations(target_document_id);

-- ============================================================================
-- Chat-first conversation layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE conversations IS 'Chat conversations for the AI-first legal assistant.';
COMMENT ON COLUMN conversations.title IS 'Conversation title, optional and may be generated later.';

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE messages IS 'Conversation messages.';
COMMENT ON COLUMN messages.role IS 'user or assistant.';
COMMENT ON COLUMN messages.metadata IS 'Optional structured metadata such as authorities or UI hints.';

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_role
    ON messages(role);

-- ============================================================================
-- Search and retrieval logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    normalized_query TEXT,
    query_type VARCHAR(50) NOT NULL,
    filters_json JSONB,
    query_language VARCHAR(20) NOT NULL DEFAULT 'en',
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE search_queries IS 'Search or ask query log.';
COMMENT ON COLUMN search_queries.query_type IS 'citation_lookup, keyword_lookup, natural_language_query, etc.';
COMMENT ON COLUMN search_queries.filters_json IS 'Applied metadata filters.';
COMMENT ON COLUMN search_queries.latency_ms IS 'End-to-end query latency in milliseconds.';

CREATE INDEX IF NOT EXISTS idx_search_queries_conversation_id
    ON search_queries(conversation_id);

CREATE INDEX IF NOT EXISTS idx_search_queries_message_id
    ON search_queries(message_id);

CREATE INDEX IF NOT EXISTS idx_search_queries_query_type
    ON search_queries(query_type);

CREATE TABLE IF NOT EXISTS retrieval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES search_queries(id) ON DELETE CASCADE,
    retrieval_strategy VARCHAR(100) NOT NULL,
    dense_model_name VARCHAR(255),
    reranker_model_name VARCHAR(255),
    lexical_engine VARCHAR(100),
    metadata_filters_json JSONB,
    dense_top_k INTEGER,
    lexical_top_k INTEGER,
    fused_top_k INTEGER,
    latency_ms INTEGER,
    debug_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE retrieval_runs IS 'A retrieval execution for a given query.';
COMMENT ON COLUMN retrieval_runs.retrieval_strategy IS 'Name of retrieval strategy, e.g. hybrid_v1.';
COMMENT ON COLUMN retrieval_runs.debug_payload IS 'Optional retrieval debug information.';

CREATE INDEX IF NOT EXISTS idx_retrieval_runs_query_id
    ON retrieval_runs(query_id);

CREATE TABLE IF NOT EXISTS retrieval_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retrieval_run_id UUID NOT NULL REFERENCES retrieval_runs(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES legal_document_chunks(id) ON DELETE SET NULL,
    document_id UUID REFERENCES legal_documents(id) ON DELETE SET NULL,
    source_rank_dense INTEGER,
    source_rank_lexical INTEGER,
    fused_rank INTEGER,
    reranked_rank INTEGER,
    dense_score NUMERIC(10, 6),
    lexical_score NUMERIC(10, 6),
    fused_score NUMERIC(10, 6),
    reranked_score NUMERIC(10, 6),
    selected_for_answer BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE retrieval_candidates IS 'Candidate chunks/documents returned during retrieval.';
COMMENT ON COLUMN retrieval_candidates.selected_for_answer IS 'Whether this candidate was included in the final answer context.';

CREATE INDEX IF NOT EXISTS idx_retrieval_candidates_run_id
    ON retrieval_candidates(retrieval_run_id);

CREATE INDEX IF NOT EXISTS idx_retrieval_candidates_chunk_id
    ON retrieval_candidates(chunk_id);

-- ============================================================================
-- Answer generation logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS answer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    assistant_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    query_id UUID REFERENCES search_queries(id) ON DELETE SET NULL,
    retrieval_run_id UUID REFERENCES retrieval_runs(id) ON DELETE SET NULL,
    model_provider VARCHAR(100) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    prompt_version VARCHAR(50),
    system_prompt_snapshot TEXT,
    answer_text TEXT,
    answer_json JSONB,
    stream_completed BOOLEAN NOT NULL DEFAULT FALSE,
    validation_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    confidence_label VARCHAR(50),
    latency_ms INTEGER,
    token_input INTEGER,
    token_output INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE answer_sessions IS 'Generated answer session for an assistant response.';
COMMENT ON COLUMN answer_sessions.answer_json IS 'Structured answer payload returned to frontend.';
COMMENT ON COLUMN answer_sessions.validation_status IS 'pending, passed, failed, trimmed, etc.';

CREATE INDEX IF NOT EXISTS idx_answer_sessions_conversation_id
    ON answer_sessions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_answer_sessions_query_id
    ON answer_sessions(query_id);

CREATE INDEX IF NOT EXISTS idx_answer_sessions_retrieval_run_id
    ON answer_sessions(retrieval_run_id);

CREATE TABLE IF NOT EXISTS answer_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_session_id UUID NOT NULL REFERENCES answer_sessions(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES legal_document_chunks(id) ON DELETE SET NULL,
    document_id UUID REFERENCES legal_documents(id) ON DELETE SET NULL,
    citation_label VARCHAR(255),
    paragraph_start_no INTEGER,
    paragraph_end_no INTEGER,
    supporting_excerpt TEXT,
    answer_span_start INTEGER,
    answer_span_end INTEGER,
    citation_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE answer_citations IS 'Mapping from generated answer back to supporting authorities.';
COMMENT ON COLUMN answer_citations.citation_label IS 'User-visible citation label.';
COMMENT ON COLUMN answer_citations.supporting_excerpt IS 'Excerpt shown in UI as supporting evidence.';
COMMENT ON COLUMN answer_citations.answer_span_start IS 'Character start in answer_text if mapped.';
COMMENT ON COLUMN answer_citations.answer_span_end IS 'Character end in answer_text if mapped.';

CREATE INDEX IF NOT EXISTS idx_answer_citations_answer_session_id
    ON answer_citations(answer_session_id);

CREATE INDEX IF NOT EXISTS idx_answer_citations_chunk_id
    ON answer_citations(chunk_id);

-- ============================================================================
-- Evaluation tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS evaluation_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE evaluation_datasets IS 'Named evaluation datasets for retrieval and answer benchmarking.';

CREATE TABLE IF NOT EXISTS evaluation_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES evaluation_datasets(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) NOT NULL,
    expected_document_ids JSONB,
    expected_citations JSONB,
    expected_keywords JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE evaluation_queries IS 'Evaluation query definitions.';
COMMENT ON COLUMN evaluation_queries.expected_document_ids IS 'Expected document IDs in JSON array form.';
COMMENT ON COLUMN evaluation_queries.expected_citations IS 'Expected citations in JSON array form.';
COMMENT ON COLUMN evaluation_queries.expected_keywords IS 'Expected keywords in JSON array form.';

CREATE INDEX IF NOT EXISTS idx_evaluation_queries_dataset_id
    ON evaluation_queries(dataset_id);

CREATE TABLE IF NOT EXISTS evaluation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES evaluation_datasets(id) ON DELETE CASCADE,
    retrieval_strategy VARCHAR(100) NOT NULL,
    llm_model_name VARCHAR(255),
    embedding_model_name VARCHAR(255),
    reranker_model_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE evaluation_runs IS 'An execution of a benchmark run against an evaluation dataset.';

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_dataset_id
    ON evaluation_runs(dataset_id);

CREATE TABLE IF NOT EXISTS evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_run_id UUID NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    evaluation_query_id UUID NOT NULL REFERENCES evaluation_queries(id) ON DELETE CASCADE,
    precision_at_5 NUMERIC(10, 4),
    recall_at_5 NUMERIC(10, 4),
    citation_accuracy NUMERIC(10, 4),
    groundedness_score NUMERIC(10, 4),
    latency_ms INTEGER,
    result_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE evaluation_results IS 'Per-query evaluation metrics and raw outputs.';

CREATE INDEX IF NOT EXISTS idx_evaluation_results_run_id
    ON evaluation_results(evaluation_run_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_results_query_id
    ON evaluation_results(evaluation_query_id);

COMMIT;