# Offline Legal Document Import Tools

## Scope

This directory contains the offline Python pipeline for importing fixed legal PDF
documents from `Data/Source/` into PostgreSQL canonical tables.

Input boundary:

- Source files: `Data/Source/*.pdf`
- Supported parser mode: text-based PDFs without OCR

Output boundary:

- Normalized document JSON: `tools/output/normalized/*.json`
- Chunk snapshot JSON: `tools/output/chunks/*.json`
- PostgreSQL tables:
  - `legal_documents`
  - `legal_document_paragraphs`
  - `legal_document_chunks`

The pipeline does not write embeddings or Pinecone records in this change.

## Install

Create a virtual environment and install dependencies:

```bash
cd /home/hkym/code/LegalChat
python3 -m venv .venv
. .venv/bin/activate
pip install -r tools/requirements.txt
```

Alternatively with `uv`:

```bash
cd /home/hkym/code/LegalChat
uv venv
uv pip install -r tools/requirements.txt
```

## Database

Default local Docker PostgreSQL settings match `infra/docker/docker-compose.yaml`:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_casebase
```

## Run

Normalize files only:

```bash
python3 -m tools.legal_importer --skip-db
```

Normalize and import to PostgreSQL:

```bash
python3 -m tools.legal_importer
```

Useful flags:

```bash
python3 -m tools.legal_importer --limit 1 --verbose
python3 -m tools.legal_importer --source-dir Data/Source --output-dir tools/output --fail-fast
```

## Validation Notes

- `document_id`, paragraph row `id`, and chunk row `id` are deterministic UUIDv5 values.
- Chunk rows preserve `paragraph_start_no` and `paragraph_end_no`.
- Duplicate imports are handled with upsert logic keyed by `legal_documents.id`.
- If Python dependencies are missing, the CLI exits with a clear installation message.

## Validation Result

Validated on `2026-04-15` with:

- Source file: `Data/Source/Birketu Pty Ltd v Atanaskovic [2025] HCA 2 (5 February 2025).pdf`
- Runtime: local repository code plus temporary Python container attached to `legal_casebase_pg`
- Database: `postgresql://postgres:postgres@localhost:5432/legal_casebase`

Observed results:

- `legal_documents`: `1`
- `legal_document_paragraphs`: `293`
- `legal_document_chunks`: `75`
- Imported document id: `b50ecc2d-4500-54d5-b669-ffe8affd43e4`
- Paragraph number range: `1..293`
- Chunk paragraph coverage: `1..293`

Remaining risks:

- AustLII PDF extraction still leaves some header/footer noise in `full_text` and `summary_text`.
- Some extracted glyphs are replaced with placeholder characters by the upstream PDF text layer.
- Current implementation does not map section hierarchy into `legal_document_sections`; `heading_path` is therefore usually null.
