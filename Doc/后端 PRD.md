- # 3. 后端 PRD（修订版：符合当前技术栈）

  ## 3.1 Backend Architecture

  后端采用 **单体式 Python 服务** 架构，由 **FastAPI** 同时承担：

  - 对前端提供业务 API
  - 执行 legal retrieval
  - 调用 Pinecone 做向量检索
  - 调用大模型完成 grounded answer generation
  - 读写 PostgreSQL
  - 记录 query / retrieval / answer logs

  ### 技术栈

  - Python 3.11+
  - FastAPI
  - Pydantic
  - Uvicorn / Starlette
  - SQLAlchemy + Alembic
  - PostgreSQL
  - Pinecone
  - OpenAI / Gemini / Claude / OpenRouter（MVP 只接一个即可）
  - uv（Python 依赖与运行管理）

  ### 架构原则

  - 不拆 Node.js API Gateway
  - 不做用户鉴权
  - 不做文件上传
  - 不做邮件能力
  - 不做线上 ingestion pipeline
  - 法律语料由本地离线预处理后导入 PostgreSQL 与 Pinecone
  - 线上服务只负责 **查询、检索、生成、展示所需数据提供**

  ### Backend Responsibilities

  后端职责包括：

  1. 提供 Search / Ask / Document Detail API
  2. 从 PostgreSQL 读取法律文书、段落、chunk、日志数据
  3. 从 Pinecone 做 dense vector retrieval
  4. 结合 PostgreSQL 做 lexical / metadata retrieval
  5. 执行 hybrid retrieval、merge、rerank
  6. 构造 grounded prompt 并调用 LLM
  7. 返回 answer、authorities、supporting excerpts、paragraph refs
  8. 记录 query、retrieval、answer 过程数据

  ------

  ## 3.2 Backend Core Modules

  ### Module 1: API Layer

  职责：

  - 提供 REST API 给 Next.js 前端
  - 参数校验
  - 错误处理
  - 响应格式标准化

  核心接口：

  - `GET /health`
  - `GET /search`
  - `POST /ask`
  - `GET /documents/{document_id}`
  - `GET /documents/{document_id}/paragraphs`

  ------

  ### Module 2: Document Query Service

  职责：

  - 查询 PostgreSQL 中的法律文书主数据
  - 返回 case detail / paragraph detail
  - 读取 chunk 与 document 的映射
  - 支持按 citation、title、court、jurisdiction、date 等字段查询

  输出对象包括：

  - legal document metadata
  - paragraph list
  - chunk list
  - source references

  ------

  ### Module 3: Retrieval Service

  职责：

  - 统一处理 legal search retrieval
  - 根据 query 类型决定 retrieval strategy
  - 组合 PostgreSQL lexical retrieval 与 Pinecone dense retrieval
  - 完成 candidate merge、去重、排序

  子职责：

  - query normalization
  - query classification
  - metadata filter extraction
  - lexical retrieval
  - vector retrieval
  - hybrid merge
  - rerank
  - evidence packaging

  ------

  ### Module 4: LLM Answer Service

  职责：

  - 接收 query + top retrieved evidence
  - 构造 grounded prompt
  - 调用 LLM
  - 输出结构化 answer
  - 返回 cited authorities 与 supporting excerpts

  约束：

  - 模型只能基于 retrieved context 作答
  - 无足够 authority 时返回 evidence insufficient
  - answer 中的 citation 必须映射回 retrieved chunks

  ------

  ### Module 5: Logging & Trace Service

  职责：

  - 记录 query 日志
  - 记录 retrieval run
  - 记录 answer generation
  - 保留可调试的 evidence trace

  记录内容包括：

  - query_text
  - query_type
  - filters
  - retrieval candidates
  - selected chunks
  - model_name
  - latency
  - answer_text
  - supporting chunk ids

  ------

  ### Module 6: Offline Data Import Compatibility Layer

  职责：

  - 保证离线脚本导入的数据结构与线上服务兼容
  - 不在在线 FastAPI 中执行上传/解析/embedding
  - 只要求后端能读取本地预处理后写入的数据

  说明：

  - 文档清洗
  - 法律结构解析
  - chunking
  - embeddings 生成
  - Pinecone upsert

  这些都在本地脚本中完成，不属于线上 API 服务职责。旧版把 ingestion、parsing、chunking、embedding 都放在线 AI service 中，这一版要从在线 backend scope 中剥离出去。

  ------

  ## 3.3 Backend API Design

  ## 3.3.1 `GET /health`

  用途：

  - 健康检查

  响应：

  ```
  
  {
    "status": "ok"
  }
  ```

  ------

  ## 3.3.2 `GET /search`

  用途：

  - 支持 citation / keyword / natural language 查询
  - 返回候选案例和证据片段
  - 不直接生成长答案

  请求参数：

  - `q`: string，用户查询
  - `court`: string，可选
  - `jurisdiction`: string，可选
  - `date_from`: string，可选
  - `date_to`: string，可选
  - `document_type`: string，可选
  - `top_k`: int，可选

  响应示例：

  ```
  
  {
    "query": "procedural fairness migration decisions",
    "query_type": "keyword_or_nl",
    "results": [
      {
        "document_id": "doc_123",
        "title": "Example Case",
        "neutral_citation": "[2020] FCA 100",
        "court": "Federal Court of Australia",
        "jurisdiction": "Australia",
        "decision_date": "2020-05-10",
        "snippet": "The Court considered procedural fairness in the migration context...",
        "paragraph_start_no": 45,
        "paragraph_end_no": 47,
        "chunk_id": "chunk_abc"
      }
    ]
  }
  ```

  ------

  ## 3.3.3 `POST /ask`

  用途：

  - 执行完整 legal RAG 问答流程
  - 返回 grounded answer + evidence

  请求体：

  ```
  
  {
    "query": "Which Australian cases discuss procedural fairness in migration decisions?",
    "filters": {
      "jurisdiction": "Australia"
    },
    "top_k": 8
  }
  ```

  响应示例：

  ```
  
  {
    "answer_text": "Several Australian cases discuss procedural fairness in migration decisions...",
    "authorities": [
      {
        "document_id": "doc_123",
        "title": "Example Case",
        "neutral_citation": "[2020] FCA 100",
        "paragraph_refs": [45, 47]
      }
    ],
    "supporting_excerpts": [
      {
        "chunk_id": "chunk_abc",
        "document_id": "doc_123",
        "excerpt": "The Court considered procedural fairness in the migration context..."
      }
    ],
    "limitations": null
  }
  ```

  MVP 第一版可以先同步返回 JSON，不强制上 SSE streaming。旧版把 `/api/ask` 默认设计成 Node 转发 streaming，这一版不再需要该层转发。

  ------

  ## 3.3.4 `GET /documents/{document_id}`

  用途：

  - 获取单个案件详情

  返回：

  - metadata
  - summary_text
  - chunk overview
  - source_url

  ------

  ## 3.3.5 `GET /documents/{document_id}/paragraphs`

  用途：

  - 获取该案件的段落列表
  - 支持前端 paragraph-level evidence jump

  返回：

  - paragraph_no
  - paragraph_text
  - paragraph_order

  ------

  ## 3.4 Backend Request Flows

  ### Search Flow

  1. 前端调用 `GET /search`
  2. FastAPI 接收 query 与 filters
  3. 后端执行 query normalization / classification
  4. PostgreSQL 执行 lexical retrieval 与 metadata filtering
  5. Pinecone 执行 dense vector retrieval
  6. 后端 merge 两路候选结果并 rerank
  7. 从 PostgreSQL 补全 chunk / document metadata
  8. 返回 result list 给前端

  ------

  ### Ask Flow

  1. 前端调用 `POST /ask`
  2. FastAPI 记录 query log
  3. 后端执行 hybrid retrieval
  4. 选取 top chunks 作为 answer evidence
  5. 构造 grounded prompt
  6. 调用 LLM 生成结构化回答
  7. 校验 citation / supporting excerpts
  8. 写入 answer log
  9. 返回 answer + authorities + evidence

  ------

  ### Document Detail Flow

  1. 前端调用 `GET /documents/{id}`
  2. FastAPI 查询 PostgreSQL 中的 `legal_documents`
  3. 返回 metadata 和 summary
  4. 前端调用 `GET /documents/{id}/paragraphs`
  5. FastAPI 查询 PostgreSQL 中的 `legal_document_paragraphs`
  6. 返回可用于 evidence jump 的段落列表

  ------

  ### Offline Indexing Flow（非在线服务）

  这一流程不属于 FastAPI 在线后端职责，但必须与后端数据结构保持一致：

  1. 本地清洗法律文书
  2. 提取 metadata
  3. legal-aware chunking
  4. 生成 embeddings
  5. 写入 PostgreSQL
  6. upsert 到 Pinecone

  ------

  ## 3.5 Backend Non-Functional Requirements

  ### Performance

  - 普通 search 请求目标：1–3 秒
  - ask 请求目标：2–6 秒内完成首版响应
  - 单查询 top_k 应受控，避免无上限上下文膨胀

  ### Reliability

  - Pinecone 检索失败时允许 lexical fallback
  - LLM 调用失败时允许返回 retrieved authorities 而非空白
  - PostgreSQL 查询失败时返回标准化错误

  ### Observability

  - 每次 search / ask 都必须可复盘
  - retrieval candidates 与 selected evidence 可记录
  - 关键耗时需记录：
    - retrieval latency
    - LLM latency
    - total latency

  ### Traceability

  - answer 中出现的 authority 必须映射到 chunk
  - chunk 必须映射回 document 与 paragraph range
  - 前端 evidence panel 依赖该映射

  ### Security

  - MVP 不做用户鉴权
  - 不开放上传入口
  - 不开放任意写接口
  - API 以只读查询为主，降低风险面

  ------

  ## 3.6 Error Handling

  ### Search Errors

  - `400 Bad Request`
    - query 为空
    - filter 参数非法
  - `404 Not Found`
    - 无匹配结果
  - `503 Service Unavailable`
    - Pinecone 或数据库不可用

  ### Ask Errors

  - `400 Bad Request`
    - query 为空
  - `422 Unprocessable Entity`
    - retrieval 为空且无法生成 grounded answer
  - `504 Gateway Timeout`
    - LLM 超时
  - `503 Service Unavailable`
    - Pinecone / PostgreSQL / LLM provider 不可用

  ### Document Errors

  - `404 Not Found`
    - document_id 不存在
  - `500 Internal Server Error`
    - 段落或 metadata 查询异常

  ### Degradation Strategy

  - Pinecone 失败：降级为 PostgreSQL lexical retrieval
  - LLM 失败：返回 retrieved authorities + snippets
  - validation 失败：去除 unsupported claims 或返回 evidence insufficient

  ------

  ## 3.7 Backend Project Structure

  建议后端项目目录：

  ```
  
  backend/
  ├── app/
  │   ├── api/
  │   │   ├── routes_health.py
  │   │   ├── routes_search.py
  │   │   ├── routes_ask.py
  │   │   └── routes_documents.py
  │   ├── core/
  │   │   ├── config.py
  │   │   └── logging.py
  │   ├── db/
  │   │   ├── session.py
  │   │   └── base.py
  │   ├── models/
  │   │   ├── document.py
  │   │   ├── chunk.py
  │   │   ├── paragraph.py
  │   │   ├── query_log.py
  │   │   └── answer_log.py
  │   ├── schemas/
  │   │   ├── search.py
  │   │   ├── ask.py
  │   │   └── document.py
  │   ├── services/
  │   │   ├── retrieval_service.py
  │   │   ├── pinecone_service.py
  │   │   ├── llm_service.py
  │   │   ├── ranking_service.py
  │   │   └── document_service.py
  │   ├── repositories/
  │   │   ├── document_repository.py
  │   │   ├── chunk_repository.py
  │   │   └── log_repository.py
  │   └── main.py
  ├── alembic/
  ├── pyproject.toml
  ├── uv.lock
  └── .env
  ```