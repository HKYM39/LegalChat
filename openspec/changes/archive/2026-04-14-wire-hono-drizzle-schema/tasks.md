## 1. 补齐 Drizzle 表结构

- [x] 1.1 对照 `infra/docker/postgres/init/001_init_schema.sql` 盘点所有缺失表、字段、默认值、外键与索引
- [x] 1.2 按领域拆分并补齐 `packages/db/src/schema` 下的文档域、对话域、检索域、答案域与评测域表定义
- [x] 1.3 为 `jsonb`、`numeric`、`timestamptz`、布尔默认值与唯一约束补充正确的 Drizzle 类型与配置

## 2. 建立关系与统一导出

- [x] 2.1 为跨表主外键关系补充 Drizzle relations，覆盖文档、分块、消息、检索运行与答案引用等核心链路
- [x] 2.2 更新 `packages/db/src/schema/index.ts` 与 `packages/db/src/index.ts`，统一导出表定义、关系定义与数据库客户端
- [x] 2.3 清理或重构现有零散 schema 文件，避免重复定义与导出冲突

## 3. 验证 Hono 侧联动

- [x] 3.1 在 `apps/api` 中以公共入口方式导入 `packages/db` 暴露的客户端或 schema，验证 Hono 可以消费新的数据库层边界
- [x] 3.2 进行一次静态检查或类型检查，确认新增 schema 不会破坏现有包导出与编译
- [x] 3.3 记录实现结果与剩余风险，确认数据库初始化脚本与 Drizzle schema 已形成一致基线
