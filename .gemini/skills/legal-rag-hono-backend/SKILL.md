---
name: legal-rag-hono-backend
description: Use this skill when building or modifying the Hono backend for the legal casebase MVP, including API routes, retrieval orchestration, PostgreSQL access through Drizzle, Pinecone integration, grounded answer generation, and logging.
---

# Legal RAG Hono Backend

## Purpose

This skill defines how to build and evolve the Hono backend for the legal casebase MVP.

The backend is responsible for:

- serving frontend-facing APIs
- retrieving legal authorities
- orchestrating hybrid retrieval
- calling the LLM
- returning grounded answers
- preserving traceability

## Project Constraints

This backend has strict scope constraints:

- TypeScript-only online backend
- Hono is the only backend runtime
- Drizzle is the database access layer
- No authentication
- No uploads
- No email
- No online ingestion
- Corpus is preprocessed offline and indexed before runtime
- Runtime behavior is mostly read-only
- Python is allowed only for offline PDF processing

## Use This Skill When

Use this skill when asked to:

- create or modify Hono routes
- design API schemas
- implement Drizzle-based PostgreSQL access
- implement Pinecone retrieval
- implement query classification
- implement hybrid retrieval
- implement reranking
- implement grounded answer generation
- implement logging or evaluation hooks

## Do Not Use This Skill For

Do not use this skill for:

- React components
- frontend state management
- offline PDF extraction code
- OCR or raw document extraction
- user auth flows
- upload flows
- payment or email systems
- Python web frameworks

## Backend Principles

### 1. Retrieval First

The backend should retrieve authorities before generating answers.
LLM usage must be downstream of retrieval.

### 2. Source Traceability

Every authority returned by the backend should be traceable to:

- document_id
- chunk_id
- paragraph range

### 3. Hybrid Retrieval by Default

Prefer combining:

- PostgreSQL lexical / metadata retrieval via Drizzle
- Pinecone dense retrieval

Do not rely on vector retrieval alone for legal search.

### 4. Conservative Answering

If evidence is weak or absent:

- do not fabricate
- return limitations
- prefer evidence-insufficient behavior

### 5. Keep Runtime Clean

Online runtime should not perform:

- document uploads
- parsing raw files
- chunk generation
- embedding generation
- Pinecone index rebuilds

## Expected API Surface

### GET /health

Health check endpoint.

### GET /search

Retrieval endpoint for:

- citation lookup
- keyword search
- natural-language legal search

Should return:

- query
- query_type
- candidate results
- legal metadata
- snippets
- paragraph ranges
- chunk IDs

### POST /ask

Grounded legal RAG endpoint.

Should:

- retrieve evidence
- call the LLM
- return answer_text
- return cited_authorities
- return supporting_excerpts
- return limitations when needed

### GET /documents/:documentId

Return a single document's metadata and summary.

### GET /documents/:documentId/paragraphs

Return paragraph-level detail for evidence navigation.

## Recommended Internal Structure

Organize code into:

- routes
- modules
- services
- repositories
- db
- schemas
- lib

Suggested app structure:

- `apps/api/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/routes/`
- `apps/api/src/modules/`
- `packages/db/`
- `packages/ai/`
- `packages/shared/`

Typical service boundaries:

- document service
- retrieval service
- pinecone service
- ranking service
- llm service
- logging service

## Hono Guidance

### App Composition

Prefer:

- one root Hono app
- route modules mounted by domain
- thin route handlers
- business logic extracted into services

### Validation

Use:

- zod
- shared schema definitions
- explicit request parsing

### Error Handling

Prefer:

- centralized error mapping
- consistent JSON error responses
- no leaking internal stack traces to clients

## Drizzle Guidance

### Source of Truth

Drizzle schema should be the canonical TypeScript definition of:

- legal_documents
- legal_document_paragraphs
- legal_document_chunks
- query logs
- answer logs

### Query Style

Prefer:

- explicit selects
- composable query helpers
- repository-style data access for repeated queries

Avoid:

- scattering raw SQL across route handlers
- mixing business logic with route code

## Retrieval Guidance

### Query Understanding

Implement simple, explainable query routing first.

Likely query types:

- citation_lookup
- case_name_lookup
- legislation_lookup
- keyword_lookup
- natural_language_query

Use rule-based classification first unless a stronger approach is required.

### Lexical Retrieval

Use PostgreSQL for:

- citation exact match
- ILIKE / text match
- metadata filters
- optional full-text search

### Dense Retrieval

Use Pinecone for:

- semantic similarity search
- chunk-level recall
- metadata-constrained vector retrieval

### Merge / Rerank

After retrieval:

- deduplicate
- merge candidates
- score based on exact match, lexical signal, semantic signal, metadata relevance
- select top evidence set

## Grounded Answer Guidance

Prompting should instruct the model to:

- answer only from retrieved materials
- cite authorities
- remain conservative
- expose limitations

Preferred output structure:

- answer_text
- cited_authorities
- supporting_excerpts
- paragraph_refs
- limitations

For chat-first frontend compatibility, the response may also include:

- message_id
- role: "assistant"

## Logging Guidance

The backend should record:

- query_text
- query_type
- filters
- retrieval candidates
- selected evidence
- model used
- latency
- answer payload

The goal is observability and iteration, not analytics bloat.

## Error Handling Guidance

Handle failures explicitly:

- if Pinecone fails, consider lexical fallback
- if LLM fails, return authorities/snippets if possible
- if document not found, return 404
- if query invalid, return 400
- if answer cannot be grounded, return a structured conservative response

## Output Expectations

When using this skill, produce:

- Hono routes
- zod schemas
- Drizzle queries or repository code
- Pinecone integration code
- retrieval orchestration code
- grounded answer generation code
- logging and validation hooks

All generated backend work should preserve:

- clear module boundaries
- legal retrieval correctness
- source traceability
- MVP scope discipline
- Hono-driven runtime design
