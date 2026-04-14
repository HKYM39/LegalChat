# AGENTS.md

This file defines global rules and constraints for all AI agents working on this repository.

All Skills, code generation, and design decisions must follow this document.

---

## 0. Language Policy (Strict)

All OpenSpec artifacts MUST be written in Simplified Chinese.

This includes:

- proposal.md
- spec.md
- design.md
- tasks.md

Requirements:

- All section titles must be in Chinese
- All descriptions, requirements, and acceptance criteria must be in Chinese
- English technical terms are allowed only when necessary (e.g. FastAPI, PostgreSQL)
- No full English sentences are allowed

Non-compliance:

- Any artifact written in English must be rewritten into Chinese before proceeding

This rule applies to ALL agents (Codex, Gemini, etc.)

---

## 1. Project Overview

This project is a **legal casebase search engine MVP** built with:

- Frontend: Next.js 15 + React 19 + Tailwind + MUI
- Backend: Hono
- Database: PostgreSQL
- Vector DB: Pinecone
- AI: LLM + RAG

Core principle:

> Retrieval-first, citation-grounded legal research system.

---

## 2. System Boundaries

### ✅ Allowed (In Scope)

- Legal document retrieval
- Hybrid search (lexical + vector)
- Grounded answer generation
- Evidence-based UI
- Offline document processing
- FastAPI backend APIs
- React frontend pages

---

### ❌ Not Allowed (Out of Scope for MVP)

DO NOT implement:

- Authentication / login systems
- File upload / ingestion endpoints
- Email systems
- Payment systems
- Admin dashboards
- Multi-tenant architecture
- Background job queues
- Real-time ingestion pipelines

---

## 3. Architecture Rules

### 3.1 Backend

- TypeScript Only
- Hono is the only backend service
- Using Skills "legal-rag-hono-backend"
- DO NOT introduce Node.js backend or API gateway
- DO NOT split backend into microservices

---

### 3.2 Data Flow

#### Offline

- Document parsing
- Chunking
- Embedding generation
- Pinecone upsert
- PostgreSQL import

#### Online

- Search
- Retrieval
- RAG generation
- Logging

---

### 3.3 Retrieval Model

The system MUST use:

- Hybrid retrieval (lexical + vector)
- NOT vector-only search

Priority:

1. Exact match (citation / case name)
2. Lexical relevance
3. Semantic similarity

---

### 3.4 LLM Usage

LLM is NOT a source of truth.

LLM must:

- only use retrieved evidence
- never hallucinate legal authorities
- return structured output
- include citations and supporting excerpts

If evidence is insufficient:

- return conservative answer
- include limitations

---

### 3.5 Traceability Requirement

Every answer must be traceable to:

- document_id
- chunk_id
- paragraph range

This is mandatory.

---

## 4. Code Organization Rules

### Backend

Must follow:
