---
name: legal-rag-fastapi-backend
description: Use this skill when building or modifying the Python FastAPI backend for the legal casebase MVP, including API routes, retrieval orchestration, PostgreSQL access, Pinecone integration, grounded answer generation, and logging.
---

# Legal RAG FastAPI Backend

## Purpose

This skill defines how to build and evolve the FastAPI backend for the legal casebase MVP.

The backend is responsible for:

- serving frontend-facing APIs
- retrieving legal authorities
- orchestrating hybrid retrieval
- calling the LLM
- returning grounded answers
- preserving traceability

## Project Constraints

This backend has strict scope constraints:

- Python-only backend
- FastAPI is both application API and AI orchestration layer
- No Node.js API gateway
- No authentication
- No uploads
- No email
- No online ingestion
- Corpus is preprocessed offline and indexed before runtime
- Runtime behavior is mostly read-only

## Use This Skill When

Use this skill when asked to:

- create or modify FastAPI routes
- design API schemas
- implement PostgreSQL access
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
- offline chunking scripts
- OCR or raw document extraction
- user auth flows
- upload flows
- payment or email systems

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

- PostgreSQL lexical / metadata retrieval
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

### GET /documents/{document_id}

Return a single document's metadata and summary.

### GET /documents/{document_id}/paragraphs

Return paragraph-level detail for evidence navigation.

## Recommended Internal Structure

Organize code into:

- api
- schemas
- services
- repositories
- models
- db
- core

Typical service boundaries:

- document_service
- retrieval_service
- pinecone_service
- ranking_service
- llm_service
- logging_service

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

- FastAPI routes
- Pydantic schemas
- SQLAlchemy models or repository code
- Pinecone integration code
- retrieval orchestration code
- grounded answer generation code
- logging and validation hooks

All generated backend work should preserve:

- clear module boundaries
- legal retrieval correctness
- source traceability
- MVP scope discipline
