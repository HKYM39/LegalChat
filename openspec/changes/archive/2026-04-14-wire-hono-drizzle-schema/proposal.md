## 背景与动机

当前 `apps/api` 已采用 Hono，`packages/db` 也已接入 Drizzle，但现有 schema 仅覆盖少量表字段，无法完整映射 `infra/docker/postgres/init/001_init_schema.sql` 中定义的法律文档、检索日志、对话与评测数据结构。继续在不完整 schema 上开发会导致 Hono 服务无法稳定复用类型安全查询能力，也会让数据库初始化脚本与应用层模型长期漂移。

## 变更内容

- 基于 `infra/docker/postgres/init/001_init_schema.sql` 为 Drizzle 补齐完整 PostgreSQL schema，覆盖文档、段落、分块、引用、会话、检索、答案生成与评测相关表。
- 为主外键、唯一约束、索引、JSONB、布尔默认值、时间戳默认值等数据库约束提供对应的 Drizzle 定义。
- 重组 `packages/db` 的 schema 导出方式，使 Hono 在线服务可以通过统一入口消费完整表定义与关系定义。
- 为后续 Hono 查询层预留清晰边界，避免业务代码直接依赖零散表文件或手写列名。

## 能力范围

### 新增能力
- `hono-drizzle-schema-alignment`: 定义 Hono 服务与 Drizzle 数据层围绕 PostgreSQL 初始化脚本保持一致的 schema 能力，包括表结构映射、关系声明与统一导出约定。

### 变更能力

无

## 影响范围

- 影响代码：`packages/db/src/schema/**`、`packages/db/src/index.ts`、可能新增关系或聚合导出文件。
- 影响系统：Hono API 的数据库访问层、离线导入与在线检索共用的数据模型基线。
- 影响依赖：继续使用现有 `drizzle-orm` 与 PostgreSQL 驱动，不引入新的后端框架。
