# Design: bootstrap-backend-foundation

## Overview

This change establishes the minimum backend runtime for the project.

The backend is a single FastAPI service that will later host:
- legal retrieval APIs
- grounded answer generation
- document detail APIs
- query logging

At this stage, only the application shell and canonical DB foundation are created.

## Architecture

### Runtime
- Python 3.11+
- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- uv for dependency and environment management

### Local Development
- PostgreSQL runs in Docker
- FastAPI runs locally through uvicorn

## Module Layout

```text
backend/
├── app/
│   ├── api/
│   ├── core/
│   │   └── config.py
│   ├── db/
│   │   └── session.py
│   ├── models/
│   │   └── document.py
│   ├── repositories/
│   ├── schemas/
│   ├── services/
│   └── main.py
├── .env
└── pyproject.toml