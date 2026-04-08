# Legal Casebase Search Engine MVP

A retrieval-first, citation-grounded legal research MVP inspired by products such as JADE.io and AustLII.

This project demonstrates a full-stack AI + RAG system for legal case search and authority-backed question answering. It focuses on structured ingestion of legal judgments, hybrid retrieval, grounded generation, and an evidence-linked user experience rather than broad corpus coverage.

---

## 1. Project Goal

The goal of this MVP is to build a small but credible legal research system that can:

- ingest and normalize legal judgments and legislation
- preserve legal structure such as sections, headings, and numbered paragraphs
- support citation lookup, keyword search, and natural-language legal research
- combine semantic search with exact lexical retrieval
- generate grounded answers with exact source references
- provide a dual-pane research interface showing answer and supporting authority side by side

This is not intended to replace professional legal research platforms. It is designed to demonstrate strong capability across:

- AI / RAG architecture
- legal text ingestion and retrieval design
- full-stack product development
- observability, traceability, and evaluation

---

## 2. MVP Scope

### In Scope

- legal judgment ingestion and normalization
- legal-aware chunking using sections and paragraph ranges
- hybrid retrieval: vector search + keyword/BM25/full-text search
- metadata filtering: court, jurisdiction, date, document type
- grounded answer generation using retrieved authorities only
- evidence-linked UI with source snippets and paragraph references
- ingestion dashboard and retrieval/debug visibility
- evaluation of retrieval quality and citation grounding

### Out of Scope

- full nationwide legal corpus coverage
- advanced OCR-first ingestion
- multi-tenant enterprise permissions
- precedent graph visualization
- autonomous legal agents
- full billing / payment workflows
- legal advice automation

---

## 3. Core Product Features

### 3.1 Intelligent Ingestion
Instead of naive fixed-token chunking, legal documents are parsed by structural elements such as headings, sections, and numbered paragraphs. This preserves legal context and improves downstream retrieval quality.

### 3.2 Hybrid Retrieval
Law is not a good fit for dense retrieval alone. The system combines:

- semantic vector retrieval for natural-language questions
- lexical retrieval for precise doctrine, citation, and section lookups
- metadata filtering for court, jurisdiction, and date constraints
- reranking for final relevance ordering

### 3.3 Grounded Answer Generation
The LLM is used to synthesize retrieved authorities, not invent unsupported conclusions. Every answer is tied back to retrieved evidence, including:

- cited authorities
- supporting excerpts
- paragraph references
- answer limitations when authority is insufficient

### 3.4 Evidence-Linked UI
The interface streams the answer progressively on the left while highlighting supporting source snippets on the right. This makes the system more transparent, auditable, and useful for legal research.

---

## 4. High-Level Architecture

### Frontend
- Next.js 15
- React 19
- Tailwind CSS
- Material UI (MUI)
- Zustand for state management

### Backend / API Gateway
- Node.js
- TypeScript
- Drizzle ORM
- PostgreSQL

### AI Services
- Python 3.11+
- FastAPI
- Pydantic
- Starlette
- Uvicorn

### Databases
- PostgreSQL for canonical records, metadata, logs, and mappings
- Pinecone for semantic vector search

### LLM / NLP
- OpenAI / Anthropic Claude / Gemini / OpenRouter
- sentence-transformers
- Hugging Face
- scikit-learn
- PyTorch

### Deployment
- Docker / Docker Compose for local development
- Railway or equivalent PaaS for deployment

---

## 5. Why PostgreSQL Is Required

PostgreSQL is the canonical source of truth for the system. It is not optional if the goal is to build a credible legal product rather than a vector-search demo.

PostgreSQL is responsible for:

- legal document metadata
- court, jurisdiction, and date filtering
- paragraph and section structure
- chunk-to-document mappings
- ingestion and indexing status
- query logs and retrieval logs
- answer-to-citation traceability
- admin dashboard and product-facing data

Pinecone is used for semantic retrieval only. PostgreSQL is what makes the system auditable, filterable, stable, and product-ready.

---

## 6. System Design

### 6.1 Ingestion Pipeline

1. Import or upload legal documents
2. Extract raw text
3. Parse structure:
   - title
   - citation
   - court
   - jurisdiction
   - date
   - headings
   - numbered paragraphs
4. Normalize into canonical schema
5. Segment into legal-aware chunks
6. Generate embeddings
7. Store records in PostgreSQL
8. Store vectors in Pinecone
9. Mark document as indexed and searchable

### 6.2 Retrieval Pipeline

1. Classify query type
2. Extract filters and entities
3. Run lexical retrieval
4. Run dense vector retrieval
5. Merge candidates
6. Rerank results
7. Return evidence set
8. Generate grounded answer from retrieved authorities

### 6.3 Answer Pipeline

1. Receive user question
2. Retrieve top evidence chunks
3. Build constrained context
4. Ask LLM for structured answer
5. Validate citation mappings
6. Stream answer to UI
7. Render linked evidence panel
8. Persist logs and answer traces

---

## 7. Query Types Supported

- exact citation lookup
- case name lookup
- doctrine / keyword lookup
- legislation / section lookup
- natural-language legal research queries

Examples:

- `Mabo [No 2]`
- `procedural fairness migration decisions`
- `Which Australian cases discuss procedural fairness in migration matters?`
- `section 5 Administrative Decisions (Judicial Review) Act`

---

## 8. Frontend Overview

### Pages

#### Search Page
Supports:
- citation search
- keyword search
- metadata filters
- result preview

#### AI Research Assistant
Supports:
- natural-language legal queries
- streaming answers
- side-by-side evidence panel
- clickable citations and paragraph references

#### Case Detail Page
Supports:
- full metadata view
- paragraph-level navigation
- heading structure view
- extracted citations

#### Admin Dashboard
Supports:
- document upload/import
- ingestion status
- chunk/index preview
- reindex actions
- debug visibility

---

## 9. Backend Overview

### Node.js / TypeScript Layer
Responsible for:
- auth
- API gateway
- query session handling
- metadata reads
- admin endpoints
- logging
- frontend integration

### Python / FastAPI Layer
Responsible for:
- ingestion
- legal parsing
- chunking
- embeddings
- retrieval
- reranking
- grounded answer synthesis
- evaluation

---

## 10. AI / RAG Design

### Retrieval Principles
- retrieval-first, not generation-first
- hybrid retrieval, not vector-only retrieval
- metadata-aware filtering
- paragraph-level traceability
- answer grounded strictly in retrieved authorities

### Legal-Aware Chunking Principles
- preserve paragraph numbering
- preserve heading hierarchy
- avoid arbitrary token splits
- preserve citation boundaries
- bind each chunk to source document, heading path, and paragraph range

### Grounding Principles
- the model must synthesize retrieved authorities only
- unsupported claims should be removed or downgraded
- every answer should expose source passages
- insufficient evidence should be stated explicitly

---

## 11. Database Overview

### PostgreSQL Tables
Core tables include:

- `users`
- `user_sessions`
- `legal_documents`
- `legal_document_sections`
- `legal_document_paragraphs`
- `legal_document_chunks`
- `legal_document_citations`
- `ingestion_jobs`
- `ingestion_job_events`
- `search_queries`
- `retrieval_runs`
- `retrieval_candidates`
- `answer_sessions`
- `answer_citations`
- `model_registry`
- `prompt_versions`
- `evaluation_datasets`
- `evaluation_queries`
- `evaluation_runs`
- `evaluation_results`

### Pinecone Metadata
Each vector record stores:
- `chunk_id`
- `document_id`
- `title`
- `neutral_citation`
- `court`
- `jurisdiction`
- `decision_date`
- `document_type`
- `paragraph_start_no`
- `paragraph_end_no`
- `heading_path`
- `chunk_type`
- `embedding_model_version`
