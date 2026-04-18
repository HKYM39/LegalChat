# LegalChat 代码分析

本文档基于当前仓库代码而不是历史设想编写，目标是说明这个项目现在“实际做了什么、怎么做、做到什么程度、还缺什么”。

当前仓库已经形成一条可运行的法律 RAG MVP 主链路：

- 离线阶段：Python 将 PDF 判例清洗为标准化 JSON，TypeScript 再做 chunk、embedding、PostgreSQL 导入和 Pinecone upsert。
- 在线阶段：Hono API 提供 `/health`、`/search`、`/ask`、`/documents/:id`、`/documents/:id/paragraphs`。
- 前端阶段：Next.js 提供 chat-first 对话页和案件详情核验页，并通过同源 `/api/*` 代理转发到 Hono。

和旧版说明不同，当前代码库的真实架构不是 “FastAPI 在线服务 + Node API Gateway”，而是：

- 在线 API：`apps/api`，Hono + TypeScript
- 前端：`apps/web`，Next.js 16 + React 19
- 离线清洗：`tools/legal_importer`，Python
- 离线索引：`apps/api/Script/offline-index.ts`，TypeScript
- 共享契约：`packages/shared`
- RAG 逻辑：`packages/ai`
- 数据模型与仓储：`packages/db`

---

## 1. 仓库结构分析

### 根目录

- `apps/api`
  Hono 在线 API、离线索引脚本、集成测试。
- `apps/web`
  Next.js 前端，提供聊天界面和案件详情页。
- `packages/shared`
  前后端共享的类型、请求解析、输入安全规则、限流常量。
- `packages/ai`
  查询分类、检索计划、混合召回融合、Gemini 嵌入与 grounded answer 生成。
- `packages/db`
  Drizzle schema、PostgreSQL client、repository。
- `tools/legal_importer`
  Python PDF 标准化流水线，负责从 `Data/Source/*.pdf` 生成结构化 JSON。
- `infra/docker`
  本地 PostgreSQL 容器和初始化 schema。
- `Data/Source`
  原始 PDF 判例语料。
- `Data/JSON`
  供人工核验的同名 JSON 导出。
- `tools/output/normalized`
  Python 规范化输出。
- `tools/output/chunks`
  TypeScript chunk 快照输出。

### Monorepo 管理方式

根目录 `package.json` 只有少量聚合脚本：

- `dev:web`
- `dev:api`
- `build`
- `typecheck`
- `lint`
- `test`

说明这个仓库的工作区边界比较清晰，前端、API、共享包和数据库包都独立维护自己的脚本，根目录只做统一调度。

---

## 2. 当前真实技术栈

### 在线服务

- Hono
- TypeScript
- Drizzle ORM
- postgres.js
- Gemini API
- Pinecone

### 前端

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Material UI
- Zustand

### 离线处理

- Python 3
- PyMuPDF
- pypdf 作为回退

### 基础设施

- PostgreSQL 16
- Docker Compose

---

## 3. 在线架构分析

在线部分的入口在 `apps/api/src/app.ts`。

它做的事情很明确：

- 构建 Hono app
- 读取环境配置
- 创建服务容器
- 注册全局错误处理中间件
- 注册请求耗时中间件
- 挂载业务路由

当前 API 面暴露五类接口：

- `GET /health`
- `GET /search`
- `POST /ask`
- `GET /documents/:documentId`
- `GET /documents/:documentId/paragraphs`

这套接口设计和当前前端页面是一一对应的，结构比较收敛，没有出现多余的管理接口或文件上传接口，符合 MVP 边界。

### 3.1 配置层

`apps/api/src/lib/config.ts` 负责把环境变量转换成运行配置，主要覆盖：

- `DATABASE_URL`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`
- `PINECONE_NAMESPACE`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY`
- `DEFAULT_TOP_K`
- `CHAT_RATE_LIMIT_PER_MINUTE`
- `CHAT_RATE_LIMIT_PER_DAY`

优点：

- 环境变量入口集中，便于排查配置问题
- 对 embedding 模型名做了兼容修正
- `configHealth()` 可直接服务于 `/health`

限制：

- 没有更严格的 schema 级环境校验
- 缺失时多数依赖是运行期失败，不是启动期失败

### 3.2 服务容器

`apps/api/src/services/container.ts` 是在线主链路的核心。

它承担三个角色：

- 协调 `packages/ai`
- 协调 `packages/db`
- 管理 Pinecone / Gemini / Rate Limit 等外部依赖

其中最重要的方法有：

- `getHealth()`
- `runSearch()`
- `runAsk()`
- `getDocument()`
- `getDocumentParagraphs()`

`withRepository()` 每次请求都创建 postgres.js 连接并在结束后关闭，比较适合当前 serverless 风格的 Hono 应用，但如果请求量变大，连接频繁建立和关闭会有额外成本。

### 3.3 `/search` 检索链路

`runSearch()` 的实际流程如下：

1. 用 `packages/ai` 生成 retrieval plan
2. 先跑 PostgreSQL lexical search
3. 调用 Gemini 生成 query embedding
4. 调用 Pinecone 做向量召回
5. 用 DB 将 vector id 映射回 chunk 和 document
6. 融合 lexical + dense 结果
7. 异步持久化 search query、retrieval run、retrieval candidates

这是一个标准的 hybrid retrieval 结构，优点是数据可追踪，返回结果自带 `documentId`、`chunkId`、段落范围。

但需要注意两点：

- 词法检索当前不是 PostgreSQL FTS/BM25，而是 `ILIKE`
- 向量检索失败时会静默降级为 lexical-only

也就是说，“Hybrid retrieval” 的产品表述在方向上是成立的，但当前 lexical 部分仍然是 MVP 级实现，不是高质量全文检索实现。

### 3.4 `/ask` 问答链路

`runAsk()` 的流程是：

1. 先执行聊天限流
2. 内部调用 `runSearch()`
3. 将检索结果转成 evidence prompt
4. 调用 Gemini 做 grounded answer
5. 如果模型不可用则返回保守模式结果
6. 落库保存 search query、retrieval run、retrieval candidates、answer session、answer citations

这个设计的优点很明确：

- 问答不是独立黑盒，而是复用检索主链路
- 支持从 answer 反查 citation
- `limitations` 被设计成一等字段，而不是埋在错误提示里

当前缺点也比较明确：

- 没有 streaming response
- 没有真正的 citation validation second pass
- 生成失败时只做保守降级，没有更精细的回退策略

### 3.5 错误处理与日志

`apps/api/src/middleware/error-handler.ts` 会把所有异常转成统一 JSON：

- `error.code`
- `error.message`
- `error.details`

`request-logger.ts` 目前只写入 `x-request-latency-ms` 响应头，没有真正持久化 HTTP access log。

这说明当前日志体系更偏“产品内业务日志”，而不是“运维可观测性日志”。

---

## 4. RAG 核心逻辑分析

RAG 逻辑集中在 `packages/ai/src/index.ts`。

### 4.1 查询标准化与分类

当前实现包含：

- `normalizeQuery()`
- `classifyQuery()`
- `buildLexicalQuery()`
- `buildRetrievalPlan()`

优点：

- 逻辑简单直接
- 对 case name、legislation、keyword、natural language 有基本分类
- 能为不同类型查询分配 lexicalTopK / denseTopK

问题：

- `classifyQuery()` 的启发式规则仍然较粗
- “citation lookup” 目前依赖年份和 `v`，容易误判
- 规则主要针对英语文本，缺少更强的 citation parser

### 4.2 检索融合

`mergeAndRerankCandidates()` 使用的是一个轻量加权融合策略：

- lexical score 权重更高
- dense score 为补充
- neutral citation 会给 boost

这和法律检索的优先级基本一致：

1. 引用号
2. 案件标题 / lexical
3. semantic similarity

这部分设计是合理的，但它仍然不是学习式 reranker，只是启发式重排。

### 4.3 Prompt 证据构造

`buildPromptEvidence()` 和 `buildGroundedPrompt()` 会把证据组织成：

- label
- title
- citation
- excerpt
- traceability

并把 `document_id`、`chunk_id`、段落区间明确写入 prompt。

这是当前代码里非常重要的优点，因为它让“可追溯性”不是 UI 装饰，而是 prompt 上下文本身的一部分。

### 4.4 模型调用

当前 `packages/ai` 同时承担：

- query embedding
- grounded answer generation

依赖都指向 Gemini API。

优点：

- 模型供应链收敛
- 配置项简单

问题：

- 没有统一的 provider abstraction
- embedding 和 answer generation 强耦合到同一供应商
- 配额耗尽时会直接影响离线索引和在线问答两个链路

---

## 5. 数据库设计分析

数据库入口在 `packages/db`。

### 5.1 client 层

`packages/db/src/client.ts` 提供：

- `createDbClient()`
- `Database` 类型
- `hasDatabaseUrl`

实现很轻，职责单一，符合 monorepo package 的预期。

### 5.2 文档主数据

`packages/db/src/schema/documents.ts` 是项目最重要的 schema 文件之一，定义了：

- `legal_documents`
- `legal_document_sections`
- `legal_document_paragraphs`
- `legal_document_chunks`

这里可以看出项目的真实“canonical source of truth” 是 PostgreSQL，而不是 Pinecone。

核心设计思想是：

- `legal_documents` 保存案件级元数据和全文
- `legal_document_paragraphs` 保留原文段落顺序与编号
- `legal_document_chunks` 承担向量检索与 grounded evidence 的载体
- `legal_document_sections` 已建表，但当前离线链路尚未实质填充

这是一个正确的法律检索数据模型方向，因为最终 UI 和 answer trace 都依赖 paragraph 和 chunk 的双层结构。

### 5.3 检索与答案日志

`packages/db/src/schema/retrieval.ts` 和 `packages/db/src/schema/answers.ts` 定义了：

- `search_queries`
- `retrieval_runs`
- `retrieval_candidates`
- `answer_sessions`
- `answer_citations`

这说明项目不仅关心“能查到”，也关心“怎么查到”和“答案引用了什么”，具备后续评估和调优的基础。

从设计上看，这是这个仓库比较成熟的一部分。

### 5.4 repository 层

`packages/db/src/repositories/legal-research.ts` 封装了主要查询和落库逻辑。

当前能力包括：

- lexical search
- vector id 反查 chunk
- 文档详情查询
- 段落列表查询
- search / retrieval / answer 日志落库

优点：

- 数据访问和业务编排分离清晰
- 返回结构紧贴 API 需要

主要局限：

- lexical search 仍然基于 `ILIKE`
- 还没有 PostgreSQL FTS、tsvector、trigram 或专门的 citation 索引策略
- repository 目前偏面向现有接口，复用层级还不算高

---

## 6. 共享契约与安全分析

`packages/shared/src/index.ts` 是当前项目工程质量最关键的文件之一。

它承担四类职责：

- 共享类型定义
- 请求解析
- 输入安全校验
- 限流常量

### 6.1 类型契约

这里统一定义了：

- `SearchRequest`
- `AskRequest`
- `SearchResponse`
- `AskResponse`
- `DocumentResponse`
- `DocumentParagraphsResponse`
- `AuthorityResult`
- `SupportingExcerpt`

这让前端、后端、AI 包都能围绕同一套结构工作，减少契约漂移。

### 6.2 输入解析

`parseSearchFromUrl()`、`parseAskBody()` 等函数把请求解析逻辑集中到了共享包里，而不是散落在路由文件内。

优点：

- API 入口更轻
- 错误消息统一
- 更容易测试

### 6.3 输入安全

这一块是当前代码里实现比较完整的部分。

它会主动拦截：

- 空白输入
- 超长输入
- 控制字符
- script / XSS 片段
- HTTP request line / header block
- SQL probe
- path traversal
- template injection

并以统一错误码 `input_security_rejected` 返回结构化错误。

这个设计的价值在于：

- 前端可本地预检
- 后端可做兜底阻断
- 两边共用同一套错误语义

从工程角度看，这比“前端拦一次、后端各写各的”要稳健得多。

---

## 7. 前端实现分析

前端位于 `apps/web`，核心定位是 chat-first 法律研究界面。

### 7.1 页面结构

当前页面很集中：

- `/`
  聊天主页面
- `/documents/[documentId]`
  文档详情与段落核验页面

这符合 MVP 聚焦思路，没有引入账户体系、后台系统或复杂导航。

### 7.2 API 代理

`apps/web/app/api/[...path]/route.ts` 的设计很实用：

- 优先使用 `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`
- 若未配置，自动探测本地常见 Wrangler 端口
- 过滤 hop-by-hop headers
- 把浏览器请求统一代理到 Hono

这个代理层解决了两个现实问题：

- 本地开发跨域
- Wrangler 端口漂移

### 7.3 聊天状态管理

`apps/web/store/chat-store.ts` 使用 Zustand 承担：

- 输入框状态
- 对话消息列表
- 调用 `/ask`
- 本地限流预检查
- 输入安全预检查
- API 错误处理

优点：

- 逻辑集中
- UI 组件比较薄
- 本地 rate limit 和后端 429 错误有统一展示逻辑

当前限制：

- 没有真正的流式消息状态
- 当前对话未持久化到后端 conversation/message 表
- 错误助手消息是本地拼装的回退结果

### 7.4 文档详情页

`apps/web/components/documents/document-detail-page.tsx` 负责：

- 拉取案件元数据
- 拉取段落全文
- 根据 query string 或 hash 做定位
- 高亮对应段落范围

这说明当前产品不是只给“答案 + 卡片”，而是已经具备基础的 citation verification 页面。

这点对法律产品很重要，因为它直接支撑“让用户核原文”。

### 7.5 UI 组件结构

聊天组件层次大致包括：

- `ChatWorkspace`
- `ConversationThread`
- `ChatComposer`
- `AssistantMessage`
- `AuthorityCard`
- `EvidenceSection`
- `EmptyState`

结构上是合理的，页面职责和展示职责分离较清楚。

---

## 8. 离线处理链路分析

离线链路分成两段，这一点是当前项目的真实特色。

### 8.1 Python 规范化阶段

`tools/legal_importer` 负责：

- 扫描 `Data/Source/*.pdf`
- 提取 PDF 文本
- 清洗噪声
- 提取案件元数据
- 构造 paragraph 记录
- 生成标准化 JSON

当前输出：

- `tools/output/normalized/*.json`
- `Data/JSON/*.json`

最近代码已经补上了页眉页脚剔除逻辑，AustLII URL、页码和抓取时间戳会尽量在前置提取阶段被清掉。

优点：

- 文档 ID、段落 ID 稳定
- 对下游 TypeScript 索引器友好
- 输出可供人工核验

限制：

- section hierarchy 仍未真正抽取
- paragraph 切分仍然偏粗
- 对 PDF 文本层质量有较强依赖

### 8.2 TypeScript 索引阶段

`apps/api/Script/offline-index.ts` 负责：

- 读取 normalized JSON
- 重新进行 legal-aware chunking
- 生成 Gemini embeddings
- 写入 PostgreSQL
- upsert Pinecone
- 输出 chunk snapshot

这个脚本是离线和在线的桥梁，因为在线检索依赖的 canonical records 和 vector ids 都从这里进入系统。

优点：

- chunk id 稳定
- 支持 `--only-missing-vectors`
- 支持 `--force-reembed`
- 支持 `--skip-pinecone`
- 支持 `--dry-run`

现实问题：

- 当前 embedding 完全依赖 Gemini 配额
- 脚本没有显式的 429 重试和退避策略
- sections 表虽然存在，但 chunking 仍主要靠段落和 heading-like 启发式

---

## 9. 运行时数据流

### 9.1 离线数据流

1. PDF 放入 `Data/Source`
2. Python 提取并清洗为 normalized JSON
3. TypeScript indexer 构建 chunks
4. chunks 写入 PostgreSQL
5. embeddings 写入 Pinecone
6. 文档标记为 `chunked` / `embedded` / `indexed`

### 9.2 在线 `/search` 数据流

1. 前端发送查询
2. Hono 解析参数
3. shared 解析 request
4. AI 包生成 retrieval plan
5. PostgreSQL lexical search
6. Gemini embed query
7. Pinecone query
8. DB 反查 chunk
9. 融合排序
10. 返回 authority results
11. 写入 search / retrieval logs

### 9.3 在线 `/ask` 数据流

1. 前端做本地输入安全和本地限流预检查
2. Hono 后端再做输入安全兜底
3. 服务容器执行 hybrid retrieval
4. 组装证据 prompt
5. Gemini 生成 grounded answer
6. 持久化 answer session 与 citations
7. 前端渲染 authority cards 和 supporting excerpts
8. 用户点击 authority 跳转到详情页核原文

---

## 10. 测试与质量现状

当前代码不是“零测试”状态，而是已经有针对关键模块的测试。

### API 侧

`apps/api/src/app.test.ts` 覆盖了：

- `/health`
- `/search`
- `/ask`
- 限流错误
- 输入安全错误

测试方式是用 stub service container 注入，不依赖真实数据库和模型服务，这个方向是正确的。

### 前端侧

`apps/web/store/*.test.ts` 说明当前主要测试重心在 store 层，而不是 DOM 组件层。

### shared 侧

`packages/shared/src/input-security.test.ts` 验证输入安全规则，这是当前最值得保留的测试资产之一。

### 烟囱验证

`apps/api/src/integration-smoke.ts` 提供了一个面向真实运行态的 smoke 脚本，可一次打通：

- `/health`
- `/search`
- `/ask`
- `/documents/:id`
- `/documents/:id/paragraphs`

---

## 11. 当前实现的优点

从代码而不是愿景看，这个仓库目前最强的地方有六个：

1. 在线和离线职责切分清楚。
2. PostgreSQL 作为 canonical source of truth 的思路是对的。
3. shared package 真正承担了跨层契约，而不是名义上的“公共类型目录”。
4. RAG answer 带 traceability，且支持从 UI 回跳原文核验。
5. 检索、答案、引用日志都已入库，为后续评估留出了空间。
6. 输入安全和限流已经在产品主路径里落地，不是事后补丁。

---

## 12. 当前主要缺口和技术债

下面这些问题不是猜测，而是从代码可以直接看出来的。

### 12.1 文本检索仍是 MVP 级

当前 lexical search 使用的是 `ILIKE`，不是：

- PostgreSQL FTS
- trigram
- BM25
- citation-specialized parser

所以“精确引用、标题匹配、复杂关键词”在规模变大后会遇到明显瓶颈。

### 12.2 section 结构尚未真正贯通

数据库已经有 `legal_document_sections`，但离线规范化与 chunking 仍未充分填充这一层。

结果是：

- heading_path 主要靠启发式
- section 粒度检索和展示能力还没真正建立

### 12.3 embedding 供应链单点依赖 Gemini

当前在线查询 embedding、离线索引 embedding、grounded answer generation 都依赖 Gemini。

这会带来三个现实问题：

- 配额耗尽会同时影响离线和在线
- 没有 provider fallback
- 没有批处理重试和退避机制

### 12.4 对话域模型未完全打通

虽然数据库 schema 有：

- `conversations`
- `messages`

但当前前端聊天和后端问答并没有把完整对话状态真正持久化成会话对象。

现在的 conversationId 主要用于限流 subject，不是完整会话存储。

### 12.5 没有真正的流式响应

UI 是 chat-first，但 `/ask` 仍是一次性 JSON 响应，不是 streaming transport。

这意味着体验上更像“请求-等待-返回”，而不是成熟 AI assistant 的连续输出。

### 12.6 文档清洗质量还有提升空间

虽然页眉页脚剔除已补上，但当前 PDF 清洗仍存在：

- 段落合并偏粗
- 某些 glyph 丢失
- 标题/段落/脚注边界不稳定

这会直接影响 chunk 质量和回答 grounding 质量。

---

## 13. 适合下一阶段优先做的事

如果按当前代码状态往前推进，最有价值的优先级大致如下：

1. 把 lexical search 从 `ILIKE` 升级到 PostgreSQL FTS 或 citation-aware 搜索。
2. 把 `legal_document_sections` 真正打通进离线规范化和 chunking。
3. 给 `offline-index.ts` 增加 429 重试、指数退避和断点续跑日志。
4. 给 `/ask` 增加 streaming response。
5. 把 conversations/messages 真正接入在线问答链路。
6. 扩大 UI 和 repository 层测试覆盖，而不是只测 store 和 app shell。

---

## 14. 总结

这个项目不是一个“只有界面原型”的法律 AI Demo，也不是一个“只有向量库”的检索试验品。

从现有代码看，它已经具备：

- 可运行的离线导入
- 可运行的混合检索
- 可运行的 grounded answer
- 可追溯的 citation 跳转
- 可落库的检索与答案日志

但它也还没有进入“可扩规模、可稳定运营”的阶段。

当前最准确的定位应当是：

一个结构方向正确、主链路已经打通、工程边界清楚，但检索质量、离线稳健性和会话能力仍处于 MVP 阶段的法律 RAG 系统。
