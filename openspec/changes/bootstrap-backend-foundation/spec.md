# Spec: bootstrap-backend-foundation

## Summary

Create the initial FastAPI backend foundation for the legal casebase MVP.

## Requirements

### Requirement 1: FastAPI application exists

The system shall provide a runnable FastAPI application.

#### Acceptance Criteria

- The backend starts locally with `uv run uvicorn app.main:app --reload`
- The application exposes a `GET /health` endpoint
- `GET /health` returns HTTP 200 with a JSON response containing `{"status": "ok"}`

---

### Requirement 2: PostgreSQL connection exists

The system shall connect to PostgreSQL using environment configuration.

#### Acceptance Criteria

- Backend reads `DATABASE_URL` from environment variables
- SQLAlchemy engine is initialized successfully
- A session dependency is available for future route handlers

---

### Requirement 3: Core database models exist

The system shall define the initial canonical legal data models.

#### Acceptance Criteria

- `legal_documents` model exists
- `legal_document_paragraphs` model exists
- `legal_document_chunks` model exists
- Tables can be created in PostgreSQL on startup for local development

---

### Requirement 4: Backend project structure exists

The system shall use a clear backend module structure.

#### Acceptance Criteria

- The backend contains:
  - `app/api`
  - `app/core`
  - `app/db`
  - `app/models`
  - `app/schemas`
  - `app/services`
  - `app/repositories`
- Core configuration and DB session files exist
- Main app entrypoint exists

---

### Requirement 5: MVP constraints are preserved

The backend shall not introduce out-of-scope features.

#### Acceptance Criteria

- No authentication code is added
- No upload endpoints are added
- No email functionality is added
- No ingestion endpoints are added
- No Node.js backend layer is introduced
