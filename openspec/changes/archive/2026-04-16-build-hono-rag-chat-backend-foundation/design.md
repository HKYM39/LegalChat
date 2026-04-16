## Context

当前仓库中的 `apps/api` 只有一个最小化 Hono 入口，尚未提供 `/health`、`/search`、`/ask`、文档详情或段落查询接口，也没有在线混合检索、模型调用、回答校验与日志记录模块。`packages/db` 已经提供 Drizzle client 与核心 schema，离线导入链路也已经开始向 PostgreSQL 写入 canonical legal records，因此在线后端最关键的约束不是重新定义数据结构，而是在现有 schema 基础上建立一条 retrieval-first、citation-grounded 的在线执行链路。

项目文档明确要求：

- 在线后端只能使用 Hono + TypeScript
- Python 只承担离线 PDF 处理，不参与在线 API
- 检索必须同时包含 PostgreSQL 词法检索与 Pinecone 向量检索
- 回答必须绑定 authority、supporting excerpts、`document_id`、`chunk_id` 与段落范围
- 证据不足时必须保守回答

同时，当前 `apps/api` 采用 Wrangler 运行方式，说明在线服务需要兼容 Cloudflare Workers 风格的部署环境。因此设计需要兼顾模块边界清晰、依赖可注入以及在本地开发与 Workers 运行时之间保持一致。

## Goals / Non-Goals

**Goals：**

- 建立可运行的 Hono API 基础架构，包括路由、配置、错误处理、请求校验和服务装配
- 建立 TypeScript 在线 RAG 编排层，覆盖 query normalization、query classification、lexical retrieval、vector retrieval、merge / rerank、prompt building、grounded answer synthesis
- 以 Gemini 2.5 Flash 作为主模型，输出结构化法律回答、authority、supporting excerpts、limitations
- 打通 `search_queries`、`retrieval_runs`、`retrieval_candidates`、`answer_sessions`、`answer_citations` 等在线日志链路
- 提供与前端聊天体验兼容的 `/ask`、`/search`、`/documents/:documentId`、`/documents/:documentId/paragraphs` 接口
- 保持与现有 Drizzle schema、离线导入产物和未来 Pinecone 索引数据兼容

**Non-Goals：**

- 不实现用户鉴权、上传、支付、后台管理或多租户能力
- 不引入 Python 在线 API、后台任务系统或复杂 agent workflow
- 不在本次变更中重做数据库 schema 或离线 PDF 处理架构
- 不在本次变更中实现前端页面，仅提供前端可消费的后端接口与响应结构

## Decisions

### 决策一：在线后端采用“路由层 + 应用服务层 + 仓储层 + 提供方适配层”分层结构

`apps/api` 负责 HTTP 协议、请求校验和响应格式；`packages/ai` 负责在线 RAG 编排；`packages/db` 提供数据库访问；Gemini 与 Pinecone 通过独立 provider 适配层接入。这样可以避免把路由逻辑、检索逻辑和模型调用耦合在一起，也便于未来替换模型提供方。

备选方案：

- 直接在 Hono route 中编排全部逻辑：实现更快，但后续测试、复用与替换成本高
- 把全部检索和模型逻辑堆到 `packages/ai`，路由层只透传：会让请求上下文、日志和错误语义难以表达

### 决策二：检索链路固定为“lexical first + vector recall + merge / rerank”

法律研究场景对 citation、案名和法条编号非常敏感，因此必须优先执行 PostgreSQL 词法检索和 metadata filter，再调用 Pinecone 做 dense recall，最后通过统一 rerank 规则合并结果。排序优先级保持为：citation exact match > case title / keyword lexical match > semantic similarity。

备选方案：

- 纯向量检索：召回快，但无法保证 citation 精确命中
- 纯 SQL 检索：可解释性强，但自然语言问题覆盖不足

### 决策三：Gemini 2.5 Flash 作为唯一主回答模型，通过结构化输出协议返回 grounded answer

模型层不直接返回自由文本，而是返回受 Zod schema 约束的结构化对象，至少包含 `answerText`、`authorities`、`supportingExcerpts`、`limitations`。Prompt 必须显式约束模型只可引用已检索到的 authority，并在证据不足时返回限制说明。

备选方案：

- 让模型直接输出 Markdown 文本：实现简单，但难以验证字段完整性
- 同时接多模型路由：扩展性更强，但当前 MVP 会增加配置、回退和测试复杂度

### 决策四：日志写入与回答生成在同一请求链路中完成，但允许非关键日志降级

`/ask` 与 `/search` 需要写 `search_queries`、`retrieval_runs`、`retrieval_candidates`、`answer_sessions`、`answer_citations`。其中回答主流程不可因非关键日志失败而整体中断，因此应区分“主流程关键步骤”和“可降级日志步骤”，对后者记录错误并继续响应。

备选方案：

- 所有日志失败都终止请求：数据最一致，但用户体验差
- 所有日志都异步丢后台：请求轻，但当前架构没有后台任务系统，不符合 MVP 约束

### 决策五：文档与段落查询接口直接使用仓储层读取 canonical tables，不经过 LLM

`/documents/:documentId` 和 `/documents/:documentId/paragraphs` 的目标是核验来源，因此必须直接基于 `legal_documents` 与 `legal_document_paragraphs` 返回 canonical 数据，避免引入模型二次加工。

备选方案：

- 由模型生成摘要后返回：更灵活，但破坏可核验性
- 与 `/ask` 复用同一回答编排链：结构统一，但会增加不必要的延迟与成本

### 决策六：运行时配置统一通过环境变量和类型化 config 层注入

数据库连接、Pinecone 配置、Gemini API key、默认 `top_k`、日志级别等参数应由 `packages/config` 或 `apps/api` 的 config 模块统一解析，并在应用启动时校验。这样可以避免 provider 初始化散落在多个模块中。

备选方案：

- 各模块自行读取 `process.env`：实现简单，但难以统一校验与测试

## Risks / Trade-offs

- [Cloudflare Workers 运行时与 Node 数据库驱动兼容性存在差异] → 先按当前仓库的 Wrangler + `postgres-js` 方式设计，并把数据库与 provider 初始化封装在单独模块中，便于后续替换适配
- [Pinecone 索引尚未准备完成时会影响混合检索闭环] → 在检索层设计 lexical-only 降级模式，并在响应中暴露 limitations
- [Gemini 2.5 Flash 生成速度快但可能在法律表述上过度概括] → 通过严格 evidence prompt、结构化输出和后置 answer validation 限制无依据表达
- [日志写入过多导致请求路径变长] → 区分关键日志与可降级日志，优先保证回答主路径
- [缺少 section 层级数据时 supporting excerpts 的组织能力有限] → 先以 chunk + paragraph range 为最小可用引用单元，保持后续可扩展到 heading hierarchy

## Migration Plan

- 第一步：完善 `apps/api` 基础应用结构与配置解析，保留现有最小入口可回退
- 第二步：在 `packages/ai` 中实现 query classification、retrieval orchestration、prompt builder、Gemini provider 与 answer validator
- 第三步：在 `packages/db` 中补充在线查询与日志仓储层
- 第四步：实现 `/health`、`/search`、`/ask`、文档详情与段落接口，并接入统一错误处理
- 第五步：以本地 PostgreSQL、Pinecone 测试索引和 Gemini 配置完成联调
- 回滚策略：按模块逐步回退到当前最小 `apps/api/src/index.ts`，数据库 schema 与离线导入数据不需要回滚

## Open Questions

- 当前部署目标是否最终固定在 Cloudflare Workers，还是需要兼容传统 Node 服务模式
- Pinecone 索引命名、namespace 策略与 embedding 版本字段是否已有固定约定
- Gemini 2.5 Flash 的调用是走官方 Gemini SDK 还是 OpenRouter 兼容层
- `packages/shared` 中前后端共用的 ask/search 响应 schema 是否需要同时在本次变更中落地
