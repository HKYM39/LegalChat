## API Surface

- `GET /health`
- `GET /search?q=...`
- `POST /ask`
- `GET /documents/:documentId`
- `GET /documents/:documentId/paragraphs`

## Local Run

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter api dev
```

## Offline Indexing

Python normalization and TypeScript indexing are intentionally separated:

- Python: `python3 -m tools.legal_importer`
- TypeScript indexing: `pnpm --filter api offline:index`

The TypeScript indexer lives in `apps/api/Script/` and reads normalized files
from `tools/output/normalized/` by default. It is responsible for:

- rebuilding legal-aware chunks from paragraph structure
- writing `legal_documents`, `legal_document_paragraphs`, and `legal_document_chunks`
- generating embeddings
- upserting Pinecone vectors

Set `GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY` to match the Pinecone index
dimension. In the current local setup, the index uses `1024`.

Useful indexing commands:

```bash
pnpm --filter api offline:index -- --limit 1 --verbose
pnpm --filter api offline:index -- --document-id <document-id> --only-missing-vectors
pnpm --filter api offline:index -- --document-id <document-id> --skip-pinecone
pnpm --filter api offline:index -- --document-id <document-id> --force-reembed
```

## Typecheck / Test

```bash
pnpm --filter api typecheck
pnpm --filter api test
```

## Search Request

`GET /search` supports:

- `q`
- `court`
- `jurisdiction`
- `document_type`
- `date_from`
- `date_to`
- `top_k`

## Ask Request

```json
{
  "query": "What did the court say about proportionality?",
  "topK": 5,
  "filters": {
    "court": "Supreme Court of Canada"
  }
}
```

The response includes grounded `authorities`, `supportingExcerpts`, `limitations`, `documentId`, `chunkId`, and paragraph ranges for traceability.
