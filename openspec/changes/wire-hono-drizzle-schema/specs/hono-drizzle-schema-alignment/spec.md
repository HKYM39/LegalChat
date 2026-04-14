## ADDED Requirements

### Requirement: Drizzle schema 必须完整映射初始化数据库表
系统 MUST 基于 `infra/docker/postgres/init/001_init_schema.sql` 为 Drizzle 定义完整的 PostgreSQL 表结构，至少覆盖法律文档、章节、段落、分块、文档内引用、会话消息、搜索日志、检索运行、候选结果、答案会话、答案引用与评测相关表。

#### Scenario: 从初始化脚本补齐缺失表
- **WHEN** 开发者检查 `packages/db` 中的 Drizzle schema
- **THEN** 可以找到与初始化 SQL 中每一张业务表对应的 Drizzle 表定义

### Requirement: Drizzle schema 必须保留关键列约束与默认值
系统 MUST 在 Drizzle 定义中保留与初始化 SQL 一致的关键主键、外键、非空约束、默认值、唯一约束与核心索引，确保应用层模型与 PostgreSQL 初始化结果一致。

#### Scenario: 校验关键约束一致性
- **WHEN** 开发者对照 `001_init_schema.sql` 与 Drizzle schema
- **THEN** 主键、外键删除策略、布尔默认值、时间戳默认值与唯一索引不会出现结构性缺失

### Requirement: Hono 服务必须通过统一数据库包消费 schema
系统 MUST 通过 `packages/db` 的统一公共导出向 Hono 服务暴露数据库客户端、表定义与关系定义，避免在线服务直接依赖零散内部 schema 文件。

#### Scenario: Hono 导入数据库能力
- **WHEN** `apps/api` 需要访问数据库表定义或客户端
- **THEN** 它可以从 `packages/db` 公共入口完成导入，而不需要引用内部私有文件路径

### Requirement: Schema 组织必须支持按领域维护
系统 MUST 将 Drizzle schema 以领域分组方式组织，使文档域、对话域、检索域、答案域与评测域的表定义可以分别维护，并通过统一索引文件聚合导出。

#### Scenario: 按领域定位表定义
- **WHEN** 开发者需要修改检索或答案相关表结构
- **THEN** 可以在对应领域 schema 文件中定位定义，而不是在单一超长文件中查找
