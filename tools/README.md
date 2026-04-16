# Offline Legal Document Import Tools

## Scope

This directory contains the offline Python normalization pipeline for processing
fixed legal PDF documents from `Data/Source/` into standardized JSON artifacts.

Input boundary:

- Source files: `Data/Source/*.pdf`
- Supported parser mode: text-based PDFs without OCR

Output boundary:

- Normalized document JSON: `tools/output/normalized/*.json`

This Python stage does not write PostgreSQL records, chunk snapshots, embeddings,
or Pinecone records. Those responsibilities belong to the TypeScript offline
indexing pipeline under `apps/api/Script/`.

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

## Run

```bash
python3 -m tools.legal_importer
```

Useful flags:

```bash
python3 -m tools.legal_importer --limit 1 --verbose
python3 -m tools.legal_importer --source-dir Data/Source --output-dir tools/output --fail-fast
```

## Validation Notes

- `document_id` and paragraph row `id` values are deterministic UUIDv5 values.
- Normalized JSON preserves paragraph numbers and paragraph order for downstream TypeScript chunking.
- If Python dependencies are missing, the CLI exits with a clear installation message.

## Validation Result

Validated on `2026-04-16` with:

- Source file: `Data/Source/Birketu Pty Ltd v Atanaskovic [2025] HCA 2 (5 February 2025).pdf`
- Runtime: local repository code and Python virtual environment

Observed results:

- Normalized JSON files: `1`
- Normalized document id: `b50ecc2d-4500-54d5-b669-ffe8affd43e4`
- Paragraph number range: `1..293`

Remaining risks:

- AustLII PDF extraction still leaves some header/footer noise in `full_text` and `summary_text`.
- Some extracted glyphs are replaced with placeholder characters by the upstream PDF text layer.
- Current implementation does not map section hierarchy into `legal_document_sections`; downstream TypeScript chunking therefore infers heading boundaries conservatively.
