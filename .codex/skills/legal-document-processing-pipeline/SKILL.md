---
name: legal-document-processing-pipeline
description: Use this skill when building or modifying offline Python scripts for legal document normalization, legal-aware chunking, metadata extraction, embedding generation, PostgreSQL import, and Pinecone upsert.
---

# Legal Document Processing Pipeline

## Purpose

This skill defines how to build and modify the offline document processing pipeline for the legal casebase MVP.

This pipeline is responsible for transforming raw legal documents into indexed, retrievable evidence units.

It runs locally and offline.

## Project Constraints

This project has strict constraints:

- Legal corpus is fixed for the MVP
- No user uploads
- No online ingestion pipeline
- No runtime document parsing through FastAPI
- Documents are processed locally before deployment
- Output must be compatible with:
  - PostgreSQL canonical records
  - Pinecone vector records
  - FastAPI retrieval layer

## Use This Skill When

Use this skill when asked to:

- define processed legal document schema
- normalize raw legal case data
- parse headings / sections / paragraphs
- implement legal-aware chunking
- generate embeddings
- import records into PostgreSQL
- upsert embeddings into Pinecone
- maintain chunk/document ID consistency
- improve offline indexing scripts

## Do Not Use This Skill For

Do not use this skill for:

- frontend React pages
- FastAPI route handlers
- request/response API schemas
- auth flows
- uploads
- user-facing UI logic

## Processing Principles

### 1. Structure Preservation

Legal texts are not generic articles. Preserve:

- title
- neutral citation
- court
- jurisdiction
- decision date
- section / heading hierarchy
- paragraph numbering
- source URL
- document type

### 2. Chunking Is Evidence Design

Chunks are not just embedding windows.
Each chunk is an evidence unit and must be usable for:

- retrieval
- answer grounding
- evidence display
- paragraph-level traceability

### 3. Avoid Naive Fixed-Size Chunking

Do not default to arbitrary fixed token slicing unless explicitly needed.

Prefer chunking based on:

- heading boundaries
- paragraph groups
- legal argument continuity
- citation boundaries

### 4. Stable IDs Matter

Every chunk should have a stable chunk_id.
PostgreSQL and Pinecone records must agree on:

- document_id
- chunk_id
- paragraph range
- source metadata

### 5. Metadata Completeness Matters

Pinecone metadata is not optional. It should support downstream filtering and debugging.

## Recommended Offline Pipeline

### Step 1: Normalize Raw Documents

Input examples may include:

- JSON
- cleaned text
- manually curated data

Transform raw documents into a standard normalized schema.

### Step 2: Extract / Preserve Metadata

Expected metadata:

- title
- neutral_citation
- court
- jurisdiction
- decision_date
- document_type
- source_url
- summary_text if available

### Step 3: Preserve Paragraph Structure

Paragraph output should include:

- paragraph_no
- paragraph_order
- paragraph_text

### Step 4: Build Chunks

Each chunk should include:

- chunk_id
- document_id
- chunk_index
- chunk_text
- paragraph_start_no
- paragraph_end_no
- heading_path
- embedding_model_name when available

### Step 5: Generate Embeddings

Embeddings may be generated using:

- OpenAI embeddings
- sentence-transformers
- another approved model

### Step 6: Write to Storage

Write canonical records to PostgreSQL.
Write vector records to Pinecone.

## Recommended File Outputs

### Normalized document format

Each processed file should represent a single legal document.

### Chunk file format

Each chunk file should preserve:

- chunk text
- paragraph ranges
- metadata necessary for vector indexing

## Pinecone Metadata Requirements

Each vector record should include at least:

- chunk_id
- document_id
- title
- neutral_citation
- court
- jurisdiction
- decision_date
- document_type
- paragraph_start_no
- paragraph_end_no
- heading_path

## PostgreSQL Compatibility Requirements

Offline outputs must map cleanly into:

- legal_documents
- legal_document_paragraphs
- legal_document_chunks

Do not invent fields that break this alignment unless the schema is intentionally updated.

## Chunking Guidance

Preferred chunking behavior:

- keep related adjacent paragraphs together
- avoid mixing unrelated sections
- do not split a citation-bearing paragraph from its immediate legal context
- keep chunk size moderate and usable for prompting

MVP-appropriate strategy:

- group 2–5 adjacent paragraphs when coherent
- allow single-paragraph chunk if a paragraph is long or legally self-contained

## Validation Guidance

Before accepting generated offline pipeline code, verify:

- paragraph numbers are preserved
- chunk ranges are correct
- chunk IDs are stable
- PostgreSQL import succeeds
- Pinecone metadata is complete
- retrieval can map back from chunk_id to document and paragraph range

## Output Expectations

When using this skill, produce:

- Python scripts
- normalization logic
- chunking logic
- embedding generation code
- PostgreSQL import scripts
- Pinecone upsert scripts
- schema-aligned outputs

All code should prioritize:

- reproducibility
- traceability
- legal structure preservation
- compatibility with the online FastAPI runtime
