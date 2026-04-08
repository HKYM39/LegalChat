# Proposal: bootstrap-backend-foundation

## Why

The project needs a stable Python backend foundation before implementing legal retrieval, Pinecone integration, grounded answer generation, or frontend integration.

At this stage, there is no authoritative backend runtime, no standardized project structure, no database session management, and no base schema bootstrap.

This change establishes the minimum backend skeleton required for all later work.

## What Changes

This change will:

- initialize the Python backend using uv
- create the FastAPI application structure
- configure environment-based settings
- connect to PostgreSQL
- define the initial SQLAlchemy base and session
- create the first core data models:
  - legal_documents
  - legal_document_paragraphs
  - legal_document_chunks
- expose a `/health` endpoint
- enable local startup for development

## What This Change Does Not Do

This change does not include:

- Pinecone integration
- LLM integration
- `/search` implementation
- `/ask` implementation
- offline ingestion scripts
- Alembic migrations beyond initial setup
- frontend integration
- authentication or uploads
