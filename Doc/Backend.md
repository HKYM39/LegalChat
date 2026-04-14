## 1. 后端目标

后端需要完成三类职责：

第一，提供在线 API。
 第二，完成在线 AI / RAG orchestration。
 第三，承接离线文档处理后的结构化数据导入与检索。

这里的关键变化是：

- **Hono 是唯一在线后端**
- **Drizzle 是唯一数据库访问层**
- **Python 仅用于 PDF 文档处理**

------

## 2. 后端技术栈

### 在线后端

- Hono
- TypeScript
- Zod
- Drizzle
- PostgreSQL
- Pinecone
- OpenAI / Gemini / Claude / OpenRouter

### 离线文档处理

- Python
- PDF 解析脚本
- 文本清洗脚本
- 结构化 JSON 输出

------

## 3. 后端整体架构

## 3.1 在线 Hono API 层

职责：

- 提供所有 HTTP 接口
- 解析请求
- 调用 retrieval pipeline
- 调用 LLM
- 返回 structured response
- 写 query / answer logs

## 3.2 TypeScript AI / RAG 层

职责：

- query classification
- lexical retrieval
- vector retrieval
- merge / rerank
- prompt building
- grounded answer synthesis
- answer validation

## 3.3 Drizzle 数据访问层

职责：

- 定义 schema
- 管理 migration
- 提供 repository-style query access

## 3.4 Python PDF Processing 层

职责：

- 从 PDF 抽取文本
- 做文档清洗
- 输出标准化 JSON

------

## 4. 在线 API 设计

## 4.1 GET /health

作用：

- 健康检查

响应：

```

{ "status": "ok" }
```

------

## 4.2 GET /search

作用：

- citation lookup
- keyword search
- natural language search 的辅助检索

请求参数：

- q
- court
- jurisdiction
- date_from
- date_to
- document_type
- top_k

响应内容：

- query
- queryType
- results
- snippets
- paragraph ranges
- legal metadata

------

## 4.3 POST /ask

作用：

- 主对话接口
- 生成 grounded legal response

请求体：

- query
- filters
- top_k

响应：

- messageId
- role
- answerText
- authorities
- supportingExcerpts
- limitations

------

## 4.4 GET /documents/:documentId

作用：

- 获取案件详情

返回：

- metadata
- summary
- sourceUrl

------

## 4.5 GET /documents/:documentId/paragraphs

作用：

- 获取该案件的段落列表

返回：

- paragraphNo
- paragraphOrder
- paragraphText

------

## 5. Hono 模块设计

建议 `apps/api/src/` 下按以下组织：

```

apps/api/src/
├── index.ts
├── app.ts
├── routes/
│   ├── health.ts
│   ├── ask.ts
│   ├── search.ts
│   └── documents.ts
├── modules/
│   ├── retrieval/
│   ├── llm/
│   ├── documents/
│   └── logs/
├── lib/
├── middleware/
└── schemas/
```

------

## 6. Drizzle 数据层设计

建议放在 `packages/db/`。

## 6.1 核心表

- `legal_documents`
- `legal_document_paragraphs`
- `legal_document_chunks`
- `search_queries`
- `retrieval_runs`
- `answer_sessions`
- `answer_citations`

## 6.2 数据职责

PostgreSQL 负责：

- canonical document records
- metadata filters
- chunk source mapping
- query / answer logs
- case detail data

Pinecone 负责：

- dense vector recall

------

## 7. TypeScript AI / RAG 设计

建议放在 `packages/ai/`。

## 7.1 Query Understanding

- query normalization
- query type classification
- filter extraction

支持类型：

- citation lookup
- case name lookup
- legislation lookup
- keyword lookup
- natural language legal question

------

## 7.2 Lexical Retrieval

通过 PostgreSQL / Drizzle 实现：

- citation exact match
- case title match
- keyword lookup
- metadata filters

------

## 7.3 Dense Retrieval

通过 Pinecone 实现：

- embedding query
- chunk-level recall
- metadata constrained vector search

------

## 7.4 Hybrid Retrieval

步骤：

1. classify query
2. lexical retrieval
3. dense retrieval
4. deduplicate
5. merge
6. rerank
7. evidence packaging

------

## 7.5 Reranking

MVP 可先采用 heuristic rerank，依据：

- exact citation hit
- lexical score
- semantic score
- jurisdiction match
- court match
- heading match
- paragraph range relevance

------

## 7.6 Grounded Answer Synthesis

输入：

- query
- top evidence chunks

输出：

- answerText
- authorities
- supportingExcerpts
- limitations

原则：

- 模型只能基于 retrieved evidence 输出
- 不允许编造 authority
- 必须尽量绑定 paragraph refs

------

## 7.7 Validation

检查：

- authority 是否来自 retrieved set
- supporting excerpts 是否对应真实 chunk
- paragraph refs 是否有效
- 是否存在 unsupported claims

失败处理：

- trim unsupported claims
- return limitations
- 不归档为高可信结果

------

## 8. 文档处理（Python）

这是唯一保留的 Python 架构部分。

## 8.1 职责边界

Python 不提供在线服务，只做离线 PDF -> JSON。

### 保留职责

- PDF 文本提取
- 文本清洗
- 基础结构识别
- 生成标准化 JSON

### 明确不做

- FastAPI
- 在线 query API
- 在线 retrieval
- 在线 embeddings
- 在线 Pinecone access
- 在线 LLM orchestration

------

## 8.2 目录建议

```

tools/pdf-processing/
├── scripts/
├── input/
├── output/
├── pyproject.toml
└── README.md
```

------

## 8.3 输入输出定义

### 输入

- 法律案例 PDF

### 输出

结构化 JSON，示例：

```

{
  "title": "...",
  "neutral_citation": "...",
  "court": "...",
  "jurisdiction": "...",
  "decision_date": "...",
  "document_type": "case",
  "source_url": "...",
  "paragraphs": [
    {
      "paragraph_no": 1,
      "text": "..."
    }
  ]
}
```

------

## 8.4 文档处理流程

1. 读取 PDF
2. 抽取文本
3. 清理噪声
4. 尝试恢复段落结构
5. 输出标准化 JSON

------

## 8.5 后续由谁继续处理

输出 JSON 后，后续流程全部由 TypeScript 负责：

- chunking
- embeddings
- PostgreSQL import
- Pinecone upsert

这一步非常关键，因为它确保“除了 PDF 文档处理外，全部移出 Python”。

------

## 9. 离线索引流程

完整离线流程应为：

1. Python PDF tool 输出 JSON
2. TypeScript ingestion pipeline 读取 JSON
3. 执行 legal-aware chunking
4. 生成 embeddings
5. 导入 PostgreSQL
6. upsert Pinecone

------

## 10. 日志与可观测性

后端需要记录：

- 原始 query
- query type
- retrieval candidates
- selected evidence
- model used
- latency
- answer payload

这部分仍由 TypeScript 后端负责，不由 Python 处理。

------

## 11. 性能与可靠性要求

### 性能

- `/search` 1–3 秒
- `/ask` 2–6 秒

### 可靠性

- Pinecone 失败时可 lexical fallback
- LLM 失败时可返回 authorities + snippets
- 数据库失败时返回标准化错误

------

## 12. 边界总结

最终边界必须严格是：

### Python

只做：

- PDF -> cleaned structured JSON

### Hono + TypeScript

做：

- JSON -> chunk -> embedding -> PostgreSQL -> Pinecone -> retrieval -> ask -> response

这就是当前项目的最终架构。