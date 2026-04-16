## 1. 职责边界与输入对齐

- [x] 1.1 盘点现有 Python 离线导入流程的输出结构，确认标准化 JSON 中已包含 TypeScript 索引所需的文档元数据、段落结构和稳定标识字段
- [x] 1.2 调整或冻结 Python 导入流程职责，使其以标准化 JSON 输出为主，不再继续承担 chunk、embedding、PostgreSQL 写入或 Pinecone upsert 逻辑
- [x] 1.3 明确 TypeScript 离线索引管道的输入目录、命令入口和配置来源，并补充运行约定文档

## 2. TypeScript 离线索引管道

- [x] 2.1 创建离线 TypeScript 索引模块与 CLI 入口，能够读取标准化 JSON 文件列表并执行单文档或批量处理
- [x] 2.2 实现基于段落结构的 chunking 逻辑，为每个 chunk 生成稳定 `chunk_id`、段落范围和最小检索元数据
- [x] 2.3 实现 PostgreSQL 写入逻辑，对 `legal_documents` 和 `legal_document_chunks` 使用幂等 upsert，并维护 `is_active` 与索引状态字段
- [x] 2.4 实现 embedding 生成与 Pinecone upsert 逻辑，为每个 active chunk 写入可回溯的向量记录与元数据

## 3. 幂等、恢复与可见性

- [x] 3.1 设计并实现文档级与 chunk 级索引状态推进规则，覆盖待处理、已写库、已向量化、已索引和失败恢复场景
- [x] 3.2 实现稳定 `vector_id` 或等价命名规则，确保重复执行不会创建不可控重复向量
- [x] 3.3 为离线索引管道补充关键日志、失败摘要和配置校验，明确报告输入发现、chunk 数量、数据库写入结果和 Pinecone upsert 结果
- [x] 3.4 支持至少一种受控重跑路径，使部分失败后可以只补未完成索引或安全覆盖既有索引

## 4. 验证与迁移

- [x] 4.1 使用现有样本文档验证从标准化 JSON 到 PostgreSQL 与 Pinecone 的完整链路，并确认 `legal_documents.indexing_status` 与 `legal_document_chunks.vector_id` 被正确更新
- [x] 4.2 验证在线检索依赖的数据契约，确认 Pinecone 元数据能够回溯 `document_id`、`chunk_id`、`paragraph_start_no` 和 `paragraph_end_no`
- [x] 4.3 更新离线处理相关 README 或运行说明，写清 Python 标准化阶段与 TypeScript 索引阶段的分工、命令和排障方式
