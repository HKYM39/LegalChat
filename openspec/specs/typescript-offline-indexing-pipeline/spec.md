# typescript-offline-indexing-pipeline Specification

## Purpose
TBD - created by archiving change build-typescript-offline-indexing-pipeline. Update Purpose after archive.
## Requirements
### Requirement: TypeScript 离线索引管道必须读取标准化 JSON 并生成检索 chunk
系统 MUST 提供一条离线 TypeScript 管道，能够读取由 Python 标准化流程输出的法律文档 JSON，并基于段落级结构生成适用于检索的 chunk 记录。每个 chunk MUST 保留稳定的 `chunk_id`、所属 `document_id`、段落起止范围以及可用于在线引用的最小元数据。

#### Scenario: 从标准化 JSON 生成 chunk
- **WHEN** 开发者执行离线 TypeScript 索引命令并提供有效的标准化 JSON 输入
- **THEN** 系统会基于文档段落顺序生成 chunk 记录，并为每个 chunk 写入稳定标识、段落范围和 chunk 文本

### Requirement: TypeScript 离线索引管道必须将 canonical records 写入 PostgreSQL
系统 MUST 使用 TypeScript 离线管道将文档和 chunk canonical records 写入 PostgreSQL，并在重复执行时通过稳定标识、校验和或等价机制避免生成不可控重复数据。文档与 chunk 的 `is_active`、索引状态和基础元数据 MUST 在写入后保持一致。

#### Scenario: 写入 PostgreSQL canonical records
- **WHEN** 开发者在数据库连接有效的环境中执行离线 TypeScript 索引管道
- **THEN** 系统会将文档与 chunk 记录写入 `legal_documents` 和 `legal_document_chunks`，并保持与标准化输入一致的追溯字段

### Requirement: TypeScript 离线索引管道必须为 chunk 生成向量并 upsert 到 Pinecone
系统 MUST 为每个处于可索引状态的 active chunk 生成 embedding，并将对应向量 upsert 到 Pinecone。每条 Pinecone 记录 MUST 能回溯到 `document_id`、`chunk_id` 与段落范围，且数据库中的向量标识或索引状态 MUST 与实际 upsert 结果保持一致。

#### Scenario: 完成 Pinecone upsert
- **WHEN** 系统成功为 active chunk 生成 embedding
- **THEN** 系统会将向量写入 Pinecone，并更新数据库中的向量标识或索引状态，使在线检索能够定位该 chunk

### Requirement: TypeScript 离线索引管道必须支持幂等重跑与部分失败恢复
系统 MUST 支持在同一批标准化输入上重复执行而不产生不可控重复向量或重复数据库记录，并在部分 chunk 生成 embedding 或 Pinecone upsert 失败时保留可恢复状态，使后续重跑能够继续处理未完成项。

#### Scenario: 重新执行未完成索引
- **WHEN** 某次离线索引运行在 Pinecone 写入阶段部分失败后再次执行
- **THEN** 系统会跳过已成功完成的记录或执行受控覆盖，并继续处理未完成 chunk，而不是重复创建整批数据

### Requirement: TypeScript 离线索引管道必须提供可见的校验与日志
系统 MUST 在离线索引执行过程中输出足以定位问题的日志和校验结果，至少覆盖输入文件发现、chunk 计数、数据库写入结果、embedding 生成结果、Pinecone upsert 结果以及失败项摘要。发生关键错误时，系统 MUST 返回非静默失败。

#### Scenario: 离线索引发生配置错误
- **WHEN** Pinecone 或 embedding 所需配置缺失
- **THEN** 系统会明确报告缺失配置并终止相关步骤，而不是静默跳过向量化或写入空索引
