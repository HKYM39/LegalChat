## 实现结果

- 已逐表对照 `infra/docker/postgres/init/001_init_schema.sql` 复核文档、对话、检索、答案与评测域表，确认业务表、关键默认值、唯一约束、外键删除策略与核心索引均已映射到 Drizzle。
- 已将 `packages/db/src/schema` 按文档域、对话域、检索域、答案域、评测域拆分。
- 已根据 `infra/docker/postgres/init/001_init_schema.sql` 补齐 Drizzle 表定义、关键默认值、唯一约束与主要索引。
- 已新增 `relations.ts`，补齐 Hono 在线查询链路需要的核心主外键关系。
- 已通过 `packages/db` 公共入口统一导出数据库客户端、表定义、关系定义与 `schema` 命名空间。
- 已在 `apps/api` 中通过工作区依赖 `db` 的 `schema` 命名空间验证 Hono 可以从公共入口消费数据库层能力。
- 已执行 `pnpm --filter db typecheck`，确认 `packages/db` 当前导出边界可通过类型检查。
- 已在 `apps/api` 侧验证 `db` 工作区导入可解析到 `packages/db`，但完整导入运行被本地缺失的 `postgres` 依赖包体阻塞，未能在当前环境完成等价类型检查。

## 剩余风险

- 尚未引入自动化对照测试来确保 SQL 初始化脚本与 Drizzle schema 永久同步，后续若 SQL 再次变更，仍需人工复核。
- 仓库当前未建立完整的 `drizzle-kit` migration 流程，本次以现有初始化脚本为数据库真源。
- 若 Cloudflare/Wrangler 侧后续对工作区包解析存在差异，可能还需要补充构建配置或路径别名验证。
- 当前本地 pnpm store 缺失 `postgres@3.4.8` 包体，导致 `apps/api` 无法在现有环境完成基于运行时导入的最终校验；补齐依赖后应重新执行 `pnpm --filter api typecheck`。
