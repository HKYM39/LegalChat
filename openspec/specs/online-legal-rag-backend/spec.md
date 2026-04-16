# online-legal-rag-backend Specification

## Purpose
TBD - created by archiving change build-hono-rag-chat-backend-foundation. Update Purpose after archive.
## Requirements
### Requirement: 在线后端必须提供基础健康检查与类型化 API 入口
系统 MUST 提供基于 Hono 的在线 API 入口，能够完成应用初始化、配置校验、基础中间件装配与健康检查响应，并作为所有在线法律研究接口的统一入口。

#### Scenario: 访问健康检查接口
- **WHEN** 客户端请求 `GET /health`
- **THEN** 系统返回表示服务可用的结构化 JSON 响应

### Requirement: 在线后端必须提供法律搜索接口
系统 MUST 提供 `GET /search` 接口，支持 `q`、`court`、`jurisdiction`、`date_from`、`date_to`、`document_type`、`top_k` 等参数，并返回 query 类型、命中结果、法律元数据、段落范围与摘要片段。

#### Scenario: 以 citation 或关键词执行搜索
- **WHEN** 客户端请求 `GET /search` 并携带查询参数
- **THEN** 系统执行合法参数校验、返回结构化搜索结果，并包含命中文档的 citation、标题、法院与段落范围

### Requirement: 在线后端必须提供基于证据的问答接口
系统 MUST 提供 `POST /ask` 接口，接收用户问题、可选过滤条件和 `top_k`，并基于检索到的证据生成结构化法律回答，而不是返回无依据的自由文本。

#### Scenario: 提交法律研究问题
- **WHEN** 客户端向 `POST /ask` 提交自然语言法律问题
- **THEN** 系统返回包含 `answerText`、`authorities`、`supportingExcerpts`、`limitations` 的结构化响应

### Requirement: 在线问答必须采用混合检索链路
系统 MUST 在问答和搜索主路径中同时支持 PostgreSQL 词法检索和 Pinecone 向量检索，并通过统一的 merge / rerank 规则合并结果，其中排序优先级 MUST 保证 citation exact match 与 lexical relevance 不低于 semantic similarity。

#### Scenario: 执行混合检索
- **WHEN** 系统收到搜索或问答请求
- **THEN** 系统先执行 query normalization 与 query classification，再结合 lexical retrieval、vector retrieval 与 rerank 产出最终 evidence 集合

### Requirement: 在线回答必须由 Gemini 2.5 Flash 基于检索证据生成
系统 MUST 使用 Gemini 2.5 Flash 作为主回答模型，并通过受约束的 prompt 与结构化输出协议，确保模型只基于已检索的 authority 和 supporting excerpts 生成回答。

#### Scenario: 基于证据调用模型
- **WHEN** 检索层已经产出可用 evidence 集合
- **THEN** 系统调用 Gemini 2.5 Flash，并仅将允许引用的 evidence 传入模型上下文

### Requirement: 在线回答必须满足可追溯性要求
系统 MUST 在回答结果中返回可映射回 canonical records 的 authority 信息，使前端可以关联 `document_id`、`chunk_id` 与 paragraph range，并展示 supporting excerpts。

#### Scenario: 返回 authority 与引用依据
- **WHEN** 问答请求成功生成回答
- **THEN** 响应中的 authority 和 supporting excerpt 都能关联到至少一个 `document_id`、`chunk_id` 与段落范围

### Requirement: 证据不足时系统必须保守回答
当检索结果不足以支持明确结论时，系统 MUST 返回保守表述和 limitations，而不是生成看似完整但缺少依据的法律结论。

#### Scenario: 检索证据不足
- **WHEN** 最终 evidence 集合为空或置信度不足
- **THEN** 系统返回明确 limitations，并避免输出无来源的确定性结论

### Requirement: 在线后端必须提供案件详情与段落查询接口
系统 MUST 提供 `GET /documents/:documentId` 与 `GET /documents/:documentId/paragraphs`，允许前端查询案件元数据、摘要、来源信息与段落原文，用于回答后的来源核验。

#### Scenario: 查询案件详情
- **WHEN** 客户端请求 `GET /documents/:documentId`
- **THEN** 系统返回该案件的 metadata、summary 与 sourceUrl 等字段

#### Scenario: 查询案件段落
- **WHEN** 客户端请求 `GET /documents/:documentId/paragraphs`
- **THEN** 系统返回该案件按顺序排列的段落列表，包含 `paragraphNo`、`paragraphOrder` 与 `paragraphText`

### Requirement: 在线后端必须记录搜索与回答日志
系统 MUST 在在线请求路径中写入搜索、检索与回答相关日志，至少覆盖 `search_queries`、`retrieval_runs`、`retrieval_candidates`、`answer_sessions`、`answer_citations` 等记录，以支持后续调试与评估。

#### Scenario: 记录问答链路日志
- **WHEN** 系统完成一次搜索或问答请求
- **THEN** 数据库中会写入与该次请求相关的查询、检索和回答日志记录

### Requirement: 非关键外部依赖失败时系统必须支持受控降级
当 Pinecone 或模型调用出现瞬时故障时，系统 MUST 提供受控降级行为，优先保持接口返回明确错误或限制说明，而不是无提示失败或返回伪造结果。

#### Scenario: 向量检索暂时不可用
- **WHEN** Pinecone 调用失败但 PostgreSQL lexical retrieval 仍可用
- **THEN** 系统可以在 limitations 中声明向量检索不可用，并继续返回 lexical-only 的保守结果

#### Scenario: 模型调用失败
- **WHEN** Gemini 2.5 Flash 调用失败
- **THEN** 系统返回可识别的错误响应或降级提示，并记录失败日志

