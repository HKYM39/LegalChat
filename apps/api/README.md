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
