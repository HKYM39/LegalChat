## 1. 搭建在线后端基础骨架

- [x] 1.1 重构 `apps/api/src/` 目录结构，创建 `app.ts`、路由目录、中间件目录、schema 目录与服务装配入口
- [x] 1.2 补充 Hono 在线后端所需依赖与类型化配置解析，覆盖数据库、Pinecone、Gemini 2.5 Flash 与运行时环境变量
- [x] 1.3 实现统一错误处理、请求日志和基础健康检查接口，完成 `GET /health`

## 2. 实现在线检索与问答链路

- [x] 2.1 在 `packages/ai` 中实现 query normalization、query classification 与检索参数构建逻辑
- [x] 2.2 实现基于 Drizzle/PostgreSQL 的 lexical retrieval 与 metadata filter 查询能力
- [x] 2.3 实现 Pinecone 向量检索、结果合并与 rerank 逻辑，并支持 lexical-only 降级
- [x] 2.4 实现 Gemini 2.5 Flash provider、grounded prompt builder、结构化输出校验与保守回答策略
- [x] 2.5 接通 `GET /search` 与 `POST /ask` 路由，返回 authority、supporting excerpts、limitations 与 traceability 字段

## 3. 实现文档查询与日志记录

- [x] 3.1 在 `packages/db` 中补充在线仓储层，支持文档详情、段落查询、搜索日志、检索日志与回答日志写入
- [x] 3.2 实现 `GET /documents/:documentId` 与 `GET /documents/:documentId/paragraphs` 路由，直接返回 canonical records
- [x] 3.3 在问答与搜索主路径中写入 `search_queries`、`retrieval_runs`、`retrieval_candidates`、`answer_sessions`、`answer_citations`，并处理可降级日志失败

## 4. 完成联调与运行验证

- [x] 4.1 补充 ask/search/documents 相关请求响应 schema、示例配置和运行说明
- [x] 4.2 使用本地 PostgreSQL、测试 Pinecone 索引和 Gemini 2.5 Flash 配置完成接口联调
- [x] 4.3 增加基础验证脚本或测试，覆盖健康检查、搜索、问答、降级行为与文档查询主路径
