## 背景

当前仓库已经存在 `packages/db` 包，并通过 `drizzle-orm/postgres-js` 创建了数据库客户端，但 schema 只定义了 `legal_documents`、`legal_document_paragraphs`、`legal_document_chunks` 的少量字段，未覆盖 `001_init_schema.sql` 中的大部分表、外键、索引与默认值。与此同时，在线服务已经位于 `apps/api` 的 Hono 应用中，后续查询、检索日志、答案溯源等能力都依赖完整且一致的数据模型。

这类变更同时涉及数据库结构映射、包导出边界与 Hono 消费方式，属于跨模块数据建模变更，先形成设计可以减少实现阶段的返工。

## 目标与非目标

**目标：**

- 让 Drizzle schema 与 `infra/docker/postgres/init/001_init_schema.sql` 在表名、列名、默认值、约束与主要索引上保持一致。
- 将 schema 以领域分组方式组织在 `packages/db/src/schema` 下，并通过统一入口导出，供 Hono 在线服务直接复用。
- 为文档、分块、引用、会话、检索、答案生成、评测等表建立明确的关系声明，降低 Hono 查询时的手写 join 成本。
- 保持实现可渐进演进，不要求本次同步引入完整 migration 体系或改写现有 API 逻辑。

**非目标：**

- 不在本次变更中实现新的 Hono 路由、检索流程或 RAG 编排逻辑。
- 不修改 `001_init_schema.sql` 的业务字段设计。
- 不引入新的 ORM、查询构建器或后端框架。
- 不扩展认证、管理后台、上传入口等超出 MVP 范围的能力。

## 设计决策

### 决策一：以 `001_init_schema.sql` 作为 Drizzle schema 的单一事实源

Drizzle 定义必须以初始化 SQL 为准，而不是反向调整 SQL 以适配现有代码。这样可以确保容器初始化出的 PostgreSQL 结构与应用层类型一致，避免在线查询与离线导入对同一张表出现不同认知。

备选方案：

- 以现有 `packages/db` schema 为准再补写 SQL：会造成数据库初始化脚本与应用层模型双向漂移，后续维护成本更高。
- 直接用 introspection 自动生成：虽然快，但会引入风格不一致、命名不可控、关系声明不完整的问题，不适合作为仓库内长期维护基线。

### 决策二：按领域拆分 schema 文件，而不是继续堆叠在单一 `documents.ts`

建议按以下边界拆分：

- `documents.ts`：法律文档、章节、段落、分块、文档内引用
- `chat.ts`：`conversations`、`messages`
- `retrieval.ts`：`search_queries`、`retrieval_runs`、`retrieval_candidates`
- `answers.ts`：`answer_sessions`、`answer_citations`
- `evaluation.ts`：评测相关表
- `relations.ts`：跨表关系定义

这样做可以控制单文件复杂度，也让 Hono 服务在导入时维持稳定入口 `packages/db/src/schema/index.ts`。

备选方案：

- 单文件维护全部表：短期简单，但随着表增加会快速失控，关系与索引也更难定位。
- 每张表一个文件：过于细碎，维护成本高，目录噪音大。

### 决策三：在 Drizzle 中完整表达列类型、默认值与关键索引，但不强行映射全部数据库注释

本次实现重点是运行时可用的数据结构一致性，因此应优先映射：

- UUID 主键与外键
- `jsonb`、`numeric`、`boolean`、`date`、`timestamptz`
- 唯一索引与常用普通索引
- `onDelete` 级联与置空策略

数据库注释对运行时行为帮助有限，可暂不在 Drizzle 层重复表达，从而降低实现噪音。

备选方案：

- 仅保留列定义不写索引与关系：会削弱 schema 的可读性与后续 migration/查询一致性。
- 连数据库注释一起全面搬运：收益低，增加维护负担。

### 决策四：Hono 通过 `packages/db` 的统一导出消费 schema 与客户端

`apps/api` 不应直接引用零散 schema 文件路径，而应继续从 `packages/db` 的公共入口获取 `db`、表定义与关系定义。这样可以把数据库访问层边界稳定在一个包中，后续即使调整内部文件拆分，也不会影响 Hono 端导入方式。

备选方案：

- Hono 直接导入内部文件：会导致包边界失效，后续重构 schema 目录时影响面扩大。

## 风险与权衡

- [字段映射遗漏] → 通过逐表对照 `001_init_schema.sql` 检查列、默认值、外键与索引，减少漏配。
- [现有代码导入路径失效] → 保持 `packages/db/src/index.ts` 与 `packages/db/src/schema/index.ts` 的统一导出接口稳定。
- [Drizzle 类型选择与 PostgreSQL 不完全匹配] → 对 `jsonb`、`numeric`、`timestamp with time zone` 等类型单独审查，必要时显式指定模式。
- [仓库规则文档与实际 Hono 架构不一致] → 以当前代码结构与 SQL 注释为实现基线，在提案中明确本次面向 Hono + Drizzle 的实际落地路径。
