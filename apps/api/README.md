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

## Chat Rate Limits

`POST /ask` 支持基于环境变量的聊天频率限制：

- `CHAT_RATE_LIMIT_PER_MINUTE`
  单个匿名聊天主体每分钟最多允许的消息数，默认 `10`
- `CHAT_RATE_LIMIT_PER_DAY`
  单个匿名聊天主体每天最多允许的消息数，默认 `100`

当前实现优先使用前端传入的稳定 `conversationId` 作为限流主体；若缺失，则回退到请求 IP。命中限制时，接口会返回 `429` 和结构化错误详情，前端可据此展示明确提示。

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

## Input Security Validation

`POST /ask` 在进入检索、模型调用和正常问答日志链路前，会先执行统一的输入安全校验。前端本地预检与后端兜底共用 `packages/shared` 中的同一套规则与错误语义。

当前会主动拒绝以下输入类别：

- 空白输入
- 超过 `4000` 字符的超长输入
- 包含异常控制字符或疑似二进制片段的输入
- 明显脚本/XSS 载荷，例如 `script` 标签、事件处理属性、`javascript:` / `data:text/html`
- 明显协议探测载荷，例如原始 HTTP 请求行或 header 块
- 明显注入/路径探测载荷，例如 SQL 注入探针、模板注入片段、`../` 或 `/etc/passwd`

命中安全规则时，接口返回 `422`，并使用统一错误码 `input_security_rejected`。`error.details` 中包含：

- `type: "input_security_violation"`
- `code: "input_security_rejected"`
- `reasonCode`
- `message`

该类请求不会进入正常问答主链路。

可用以下命令验证：

```bash
cd packages/shared && node --import tsx src/input-security.test.ts
cd apps/api && node --import tsx src/app.test.ts
```
