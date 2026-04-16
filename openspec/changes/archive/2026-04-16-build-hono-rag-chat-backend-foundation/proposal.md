## Why

当前仓库已经具备 PostgreSQL 初始化脚本、Drizzle schema 对齐基础和离线 PDF 导入能力，但在线后端仍缺少一套可运行的 Hono + TypeScript 基础架构，无法承接聊天式法律研究、混合检索与基于证据的回答生成。现在需要根据 `Doc/Backend.md` 与 `Doc/ProjectPRD.md` 补齐在线 API、RAG 编排和日志链路，形成端到端可运行的 MVP 后端闭环。

## What Changes

- 新增 Hono 在线后端基础架构，包括应用入口、路由组织、配置加载、中间件和统一错误处理。
- 新增 `/health`、`/search`、`/ask`、`/documents/:documentId`、`/documents/:documentId/paragraphs` 等核心接口。
- 新增基于 PostgreSQL + Pinecone 的混合检索编排层，支持 citation lookup、关键词检索和自然语言法律问题检索。
- 新增基于证据的回答生成链路，使用 Gemini 2.5 Flash 作为主模型，输出结构化答案、authority、supporting excerpts 与 limitations。
- 新增在线查询、检索、回答相关日志写入能力，打通 `search_queries`、`retrieval_runs`、`answer_sessions`、`answer_citations` 等链路。
- 为在线后端补充共享 schema、仓储层接口与运行说明，保证与现有 Drizzle schema、离线导入结果和前端聊天体验兼容。

## Capabilities

### New Capabilities
- `online-legal-rag-backend`: 定义在线 Hono API、混合检索、Gemini 2.5 Flash 回答生成、案例详情查询与日志记录能力。

### Modified Capabilities

无

## Impact

- 影响代码：`apps/api/`、`packages/ai/`、`packages/db/`、`packages/shared/`、`packages/config/`
- 影响接口：新增在线健康检查、搜索、问答、文档详情、文档段落接口
- 影响依赖：Hono、Zod、Gemini SDK、Pinecone SDK、Drizzle 相关运行时依赖
- 影响系统：在线后端将从静态骨架升级为可执行的 retrieval-first、citation-grounded 法律研究服务
