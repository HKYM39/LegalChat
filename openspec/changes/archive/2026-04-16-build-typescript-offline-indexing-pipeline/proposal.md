## Why

当前离线导入规范将 chunk 生成与 PostgreSQL 写入职责归在 Python 流程中，这与 `Doc/ProjectPRD.md` 中“Python 仅负责 PDF 处理和标准化，TypeScript 离线管道负责 chunking、embedding、PostgreSQL 写入与 Pinecone upsert”的目标不一致。数据库现状也显示文档和 chunk 已入库，但向量索引仍未完成，因此需要明确并补齐 TypeScript 离线索引链路。

## What Changes

- 新增一个 TypeScript 离线索引管道，从 Python 输出的标准化 JSON 读取文档数据。
- 新增离线 chunking、embedding 生成、PostgreSQL 写入与 Pinecone upsert 的规范要求。
- 为每个 chunk 定义稳定的追溯信息与索引状态更新要求，确保在线混合检索可直接消费。
- 修订现有 `offline-legal-document-import` 能力的职责边界，将 Python 流程限定为 PDF 提取、结构标准化和 JSON 输出，不再承担 chunk、embedding、数据库导入或 Pinecone 写入职责。
- 增加离线索引过程的失败可见性、幂等执行与最小校验要求，避免重复写入和索引状态失真。

## Capabilities

### New Capabilities
- `typescript-offline-indexing-pipeline`: 定义 TypeScript 离线管道如何读取标准化 JSON，生成 chunk、写入 PostgreSQL、生成向量并 upsert 到 Pinecone。

### Modified Capabilities
- `offline-legal-document-import`: 调整现有离线导入能力，将 Python 流程职责收敛为 PDF 提取与标准化 JSON 输出，并为后续 TypeScript 索引阶段提供稳定输入。

## Impact

- 受影响代码包括 `tools/` 下的离线处理脚本、TypeScript 索引脚本、Pinecone 集成、PostgreSQL 导入逻辑与相关配置。
- 受影响系统包括离线文档处理流程、数据库 canonical records、Pinecone 向量索引以及在线 hybrid retrieval 的数据前提。
- 需要补充或调整环境变量与运行命令，以支持离线 TypeScript 管道独立执行和状态验证。
