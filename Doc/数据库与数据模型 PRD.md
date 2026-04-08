# 5. 数据库 PRD

这里按 PostgreSQL 为主数据库，Pinecone 为向量数据库来设计。
 PostgreSQL 负责 **canonical data / product layer / audit layer**。
 Pinecone 负责 **semantic retrieval layer**。

------

## 5.1 PostgreSQL 数据库角色说明

PostgreSQL 在本系统中承担以下角色：

1. 存储法律文书主数据与元数据
2. 存储结构化段落、分块、标题树
3. 存储 ingestion / indexing 状态
4. 存储 query / retrieval / answer / audit logs
5. 支撑 exact match、filtering、排序、分页
6. 作为前端页面和管理后台的数据源
7. 作为 Pinecone 向量条目的 source-of-truth 映射层

------

## 5.2 PostgreSQL 表清单

建议最少包含以下表：

1. users
2. user_sessions
3. legal_documents
4. legal_document_sections
5. legal_document_paragraphs
6. legal_document_chunks
7. legal_document_citations
8. ingestion_jobs
9. ingestion_job_events
10. search_queries
11. retrieval_runs
12. retrieval_candidates
13. answer_sessions
14. answer_citations
15. model_registry
16. prompt_versions
17. evaluation_datasets
18. evaluation_queries
19. evaluation_runs
20. evaluation_results

下面给出详细表结构。

------

## 5.3 数据库表结构设计

------

### Table: `users`

用户表

| 字段名                | 类型         | 约束                    | 注释                      |
| --------------------- | ------------ | ----------------------- | ------------------------- |
| id                    | uuid         | PK                      | 用户唯一 ID               |
| email                 | varchar(255) | UNIQUE, NOT NULL        | 用户邮箱                  |
| name                  | varchar(255) | NULL                    | 用户显示名称              |
| avatar_url            | text         | NULL                    | 用户头像地址              |
| auth_provider         | varchar(50)  | NOT NULL                | 登录提供商，如 google     |
| auth_provider_user_id | varchar(255) | NULL                    | 第三方登录系统中的用户 ID |
| role                  | varchar(50)  | NOT NULL DEFAULT 'user' | 用户角色，如 user/admin   |
| is_active             | boolean      | NOT NULL DEFAULT true   | 用户是否启用              |
| created_at            | timestamptz  | NOT NULL DEFAULT now()  | 创建时间                  |
| updated_at            | timestamptz  | NOT NULL DEFAULT now()  | 更新时间                  |

------

### Table: `user_sessions`

用户会话表

| 字段名        | 类型         | 约束                   | 注释     |
| ------------- | ------------ | ---------------------- | -------- |
| id            | uuid         | PK                     | 会话 ID  |
| user_id       | uuid         | FK -> users.id         | 用户 ID  |
| session_token | varchar(255) | UNIQUE, NOT NULL       | 会话令牌 |
| expires_at    | timestamptz  | NOT NULL               | 过期时间 |
| created_at    | timestamptz  | NOT NULL DEFAULT now() | 创建时间 |

------

### Table: `legal_documents`

法律文书主表

| 字段名             | 类型         | 约束                       | 注释                           |
| ------------------ | ------------ | -------------------------- | ------------------------------ |
| id                 | uuid         | PK                         | 文书主键                       |
| source_type        | varchar(50)  | NOT NULL                   | 来源类型，如 upload/web/import |
| source_url         | text         | NULL                       | 原始文档来源 URL               |
| external_source_id | varchar(255) | NULL                       | 外部系统文档 ID                |
| title              | text         | NOT NULL                   | 文书标题                       |
| neutral_citation   | varchar(255) | NULL                       | 中立引注 / citation            |
| parallel_citation  | text         | NULL                       | 平行引注                       |
| court              | varchar(255) | NULL                       | 法院名称                       |
| jurisdiction       | varchar(255) | NULL                       | 法域，如 Australia/NSW         |
| decision_date      | date         | NULL                       | 裁判日期                       |
| judges             | text         | NULL                       | 法官列表，MVP 可先存文本       |
| parties            | text         | NULL                       | 当事人名称，MVP 可先存文本     |
| document_type      | varchar(100) | NOT NULL                   | 文书类型，如 case/legislation  |
| language           | varchar(20)  | NOT NULL DEFAULT 'en'      | 语言                           |
| docket_number      | varchar(255) | NULL                       | 案号                           |
| summary_text       | text         | NULL                       | 文书摘要或 headnote 摘要       |
| full_text          | text         | NOT NULL                   | 清洗后的完整正文               |
| raw_text           | text         | NULL                       | 原始提取文本                   |
| text_checksum      | varchar(128) | NOT NULL                   | 文本校验值，用于去重           |
| parse_status       | varchar(50)  | NOT NULL DEFAULT 'pending' | 解析状态                       |
| indexing_status    | varchar(50)  | NOT NULL DEFAULT 'pending' | 索引状态                       |
| is_active          | boolean      | NOT NULL DEFAULT true      | 是否有效                       |
| imported_at        | timestamptz  | NULL                       | 导入时间                       |
| created_at         | timestamptz  | NOT NULL DEFAULT now()     | 创建时间                       |
| updated_at         | timestamptz  | NOT NULL DEFAULT now()     | 更新时间                       |

#### 索引建议

- unique index on `(neutral_citation)` where neutral_citation is not null
- index on `(court)`
- index on `(jurisdiction)`
- index on `(decision_date)`
- index on `(document_type)`
- index on `(parse_status, indexing_status)`

------

### Table: `legal_document_sections`

文书章节结构表

| 字段名             | 类型         | 约束                                   | 注释                                       |
| ------------------ | ------------ | -------------------------------------- | ------------------------------------------ |
| id                 | uuid         | PK                                     | 章节 ID                                    |
| document_id        | uuid         | FK -> legal_documents.id               | 所属文书 ID                                |
| parent_section_id  | uuid         | FK -> legal_document_sections.id, NULL | 父章节 ID                                  |
| level              | integer      | NOT NULL                               | 章节层级，如 1/2/3                         |
| section_order      | integer      | NOT NULL                               | 在文书中的排序                             |
| heading_text       | text         | NOT NULL                               | 标题文本                                   |
| heading_label      | varchar(255) | NULL                                   | 标题标签，如 Part I / Section A            |
| section_path       | text         | NOT NULL                               | 完整路径，如 Reasons > Procedural Fairness |
| start_paragraph_no | integer      | NULL                                   | 起始段落号                                 |
| end_paragraph_no   | integer      | NULL                                   | 结束段落号                                 |
| created_at         | timestamptz  | NOT NULL DEFAULT now()                 | 创建时间                                   |

#### 作用

- 还原文书结构
- 支持按 heading 定位
- 支持 chunk 绑定 section_path

------

### Table: `legal_document_paragraphs`

文书段落表

| 字段名          | 类型        | 约束                                   | 注释                        |
| --------------- | ----------- | -------------------------------------- | --------------------------- |
| id              | uuid        | PK                                     | 段落 ID                     |
| document_id     | uuid        | FK -> legal_documents.id               | 所属文书 ID                 |
| section_id      | uuid        | FK -> legal_document_sections.id, NULL | 所属章节 ID                 |
| paragraph_no    | integer     | NULL                                   | 段落编号                    |
| paragraph_order | integer     | NOT NULL                               | 文中顺序                    |
| paragraph_text  | text        | NOT NULL                               | 段落文本                    |
| char_start      | integer     | NULL                                   | 在 full_text 中起始字符位置 |
| char_end        | integer     | NULL                                   | 在 full_text 中结束字符位置 |
| token_count     | integer     | NULL                                   | token 数估计                |
| created_at      | timestamptz | NOT NULL DEFAULT now()                 | 创建时间                    |

#### 索引建议

- index on `(document_id, paragraph_no)`
- index on `(document_id, paragraph_order)`

------

### Table: `legal_document_chunks`

向量检索 chunk 表

| 字段名                  | 类型         | 约束                                   | 注释                                           |
| ----------------------- | ------------ | -------------------------------------- | ---------------------------------------------- |
| id                      | uuid         | PK                                     | chunk ID                                       |
| document_id             | uuid         | FK -> legal_documents.id               | 所属文书 ID                                    |
| section_id              | uuid         | FK -> legal_document_sections.id, NULL | 所属章节 ID                                    |
| chunk_index             | integer      | NOT NULL                               | 在文档中的 chunk 顺序                          |
| chunk_type              | varchar(50)  | NOT NULL DEFAULT 'paragraph_group'     | chunk 类型，如 paragraph_group/section_summary |
| chunk_text              | text         | NOT NULL                               | chunk 文本                                     |
| paragraph_start_no      | integer      | NULL                                   | chunk 起始段落号                               |
| paragraph_end_no        | integer      | NULL                                   | chunk 结束段落号                               |
| heading_path            | text         | NULL                                   | 所属 heading path                              |
| token_count             | integer      | NULL                                   | token 数                                       |
| embedding_model_name    | varchar(255) | NULL                                   | embedding 模型名                               |
| embedding_model_version | varchar(100) | NULL                                   | embedding 模型版本                             |
| vector_provider         | varchar(100) | NULL                                   | 向量库提供方，如 pinecone                      |
| vector_id               | varchar(255) | NULL                                   | Pinecone 中的向量 ID                           |
| lexical_index_text      | tsvector     | NULL                                   | PostgreSQL 全文检索字段                        |
| chunk_metadata          | jsonb        | NULL                                   | 扩展 metadata                                  |
| is_active               | boolean      | NOT NULL DEFAULT true                  | 是否有效                                       |
| created_at              | timestamptz  | NOT NULL DEFAULT now()                 | 创建时间                                       |
| updated_at              | timestamptz  | NOT NULL DEFAULT now()                 | 更新时间                                       |

#### 索引建议

- unique index on `(document_id, chunk_index)`
- index on `(document_id)`
- index on `(vector_id)`
- gin index on `(lexical_index_text)`
- index on `(paragraph_start_no, paragraph_end_no)`

------

### Table: `legal_document_citations`

文书中抽取出的引注表

| 字段名              | 类型         | 约束                                     | 注释                              |
| ------------------- | ------------ | ---------------------------------------- | --------------------------------- |
| id                  | uuid         | PK                                       | 引注 ID                           |
| document_id         | uuid         | FK -> legal_documents.id                 | 所属文书 ID                       |
| paragraph_id        | uuid         | FK -> legal_document_paragraphs.id, NULL | 所在段落 ID                       |
| chunk_id            | uuid         | FK -> legal_document_chunks.id, NULL     | 所在 chunk ID                     |
| citation_text       | text         | NOT NULL                                 | 原始引注文本                      |
| normalized_citation | varchar(255) | NULL                                     | 标准化后的引注                    |
| citation_type       | varchar(50)  | NOT NULL                                 | 类型，如 case/legislation/section |
| target_document_id  | uuid         | FK -> legal_documents.id, NULL           | 若能解析则指向目标文书            |
| start_char_offset   | integer      | NULL                                     | 在 paragraph/chunk 中起始位置     |
| end_char_offset     | integer      | NULL                                     | 在 paragraph/chunk 中结束位置     |
| created_at          | timestamptz  | NOT NULL DEFAULT now()                   | 创建时间                          |

#### 作用

- 支持后续 citation graph 扩展
- 支持 exact citation lookup
- 支持 answer 中 authority 展示

------

### Table: `ingestion_jobs`

导入任务表

| 字段名               | 类型         | 约束                      | 注释                            |
| -------------------- | ------------ | ------------------------- | ------------------------------- |
| id                   | uuid         | PK                        | ingestion job ID                |
| document_id          | uuid         | FK -> legal_documents.id  | 关联文书 ID                     |
| initiated_by_user_id | uuid         | FK -> users.id, NULL      | 发起用户 ID                     |
| job_type             | varchar(50)  | NOT NULL                  | 类型，如 import/reindex/reembed |
| status               | varchar(50)  | NOT NULL DEFAULT 'queued' | 任务状态                        |
| current_step         | varchar(100) | NULL                      | 当前步骤，如 parse/embed/index  |
| error_message        | text         | NULL                      | 错误信息                        |
| retry_count          | integer      | NOT NULL DEFAULT 0        | 重试次数                        |
| started_at           | timestamptz  | NULL                      | 开始时间                        |
| finished_at          | timestamptz  | NULL                      | 完成时间                        |
| created_at           | timestamptz  | NOT NULL DEFAULT now()    | 创建时间                        |
| updated_at           | timestamptz  | NOT NULL DEFAULT now()    | 更新时间                        |

------

### Table: `ingestion_job_events`

导入任务事件表

| 字段名        | 类型         | 约束                    | 注释                                      |
| ------------- | ------------ | ----------------------- | ----------------------------------------- |
| id            | uuid         | PK                      | 事件 ID                                   |
| job_id        | uuid         | FK -> ingestion_jobs.id | 所属任务 ID                               |
| event_type    | varchar(100) | NOT NULL                | 事件类型，如 parse_started/embed_finished |
| event_payload | jsonb        | NULL                    | 事件详细数据                              |
| created_at    | timestamptz  | NOT NULL DEFAULT now()  | 事件时间                                  |

------

### Table: `search_queries`

查询主表

| 字段名           | 类型        | 约束                   | 注释                       |
| ---------------- | ----------- | ---------------------- | -------------------------- |
| id               | uuid        | PK                     | 查询 ID                    |
| user_id          | uuid        | FK -> users.id, NULL   | 发起用户                   |
| session_id       | uuid        | NULL                   | 前端会话 ID                |
| query_text       | text        | NOT NULL               | 原始查询文本               |
| normalized_query | text        | NULL                   | 归一化查询文本             |
| query_type       | varchar(50) | NOT NULL               | citation/keyword/ask_ai 等 |
| filters_json     | jsonb       | NULL                   | 应用的过滤条件             |
| query_language   | varchar(20) | NOT NULL DEFAULT 'en'  | 查询语言                   |
| latency_ms       | integer     | NULL                   | 总耗时                     |
| created_at       | timestamptz | NOT NULL DEFAULT now() | 创建时间                   |

------

### Table: `retrieval_runs`

一次检索执行记录表

| 字段名                | 类型         | 约束                    | 注释                           |
| --------------------- | ------------ | ----------------------- | ------------------------------ |
| id                    | uuid         | PK                      | retrieval run ID               |
| query_id              | uuid         | FK -> search_queries.id | 对应查询 ID                    |
| retrieval_strategy    | varchar(100) | NOT NULL                | 检索策略，如 hybrid_v1         |
| dense_model_name      | varchar(255) | NULL                    | dense embedding 模型名         |
| reranker_model_name   | varchar(255) | NULL                    | reranker 模型名                |
| lexical_engine        | varchar(100) | NULL                    | 词法检索引擎，如 postgres_bm25 |
| metadata_filters_json | jsonb        | NULL                    | 实际下推的 metadata filter     |
| dense_top_k           | integer      | NULL                    | dense 检索 top_k               |
| lexical_top_k         | integer      | NULL                    | lexical 检索 top_k             |
| fused_top_k           | integer      | NULL                    | 融合后 top_k                   |
| latency_ms            | integer      | NULL                    | 检索耗时                       |
| debug_payload         | jsonb        | NULL                    | 调试信息                       |
| created_at            | timestamptz  | NOT NULL DEFAULT now()  | 创建时间                       |

------

### Table: `retrieval_candidates`

检索候选结果表

| 字段名              | 类型          | 约束                           | 注释               |
| ------------------- | ------------- | ------------------------------ | ------------------ |
| id                  | uuid          | PK                             | 候选 ID            |
| retrieval_run_id    | uuid          | FK -> retrieval_runs.id        | 所属检索执行 ID    |
| chunk_id            | uuid          | FK -> legal_document_chunks.id | 命中的 chunk       |
| document_id         | uuid          | FK -> legal_documents.id       | 命中的文书         |
| source_rank_dense   | integer       | NULL                           | dense 排名         |
| source_rank_lexical | integer       | NULL                           | lexical 排名       |
| fused_rank          | integer       | NULL                           | 融合排名           |
| reranked_rank       | integer       | NULL                           | 重排序后排名       |
| dense_score         | numeric(10,6) | NULL                           | 向量相似度分数     |
| lexical_score       | numeric(10,6) | NULL                           | 关键词检索分数     |
| fused_score         | numeric(10,6) | NULL                           | 融合分数           |
| reranked_score      | numeric(10,6) | NULL                           | 重排序分数         |
| selected_for_answer | boolean       | NOT NULL DEFAULT false         | 是否进入生成上下文 |
| created_at          | timestamptz   | NOT NULL DEFAULT now()         | 创建时间           |

------

### Table: `answer_sessions`

AI 回答会话表

| 字段名                 | 类型         | 约束                           | 注释                            |
| ---------------------- | ------------ | ------------------------------ | ------------------------------- |
| id                     | uuid         | PK                             | answer session ID               |
| query_id               | uuid         | FK -> search_queries.id        | 对应查询 ID                     |
| retrieval_run_id       | uuid         | FK -> retrieval_runs.id        | 使用的检索执行 ID               |
| model_provider         | varchar(100) | NOT NULL                       | 模型提供方，如 openai/anthropic |
| model_name             | varchar(255) | NOT NULL                       | 模型名称                        |
| prompt_version_id      | uuid         | FK -> prompt_versions.id, NULL | prompt 版本                     |
| system_prompt_snapshot | text         | NULL                           | 当时使用的系统 prompt 快照      |
| answer_text            | text         | NULL                           | 生成的最终答案                  |
| answer_json            | jsonb        | NULL                           | 结构化答案 JSON                 |
| stream_completed       | boolean      | NOT NULL DEFAULT false         | 是否完成流式输出                |
| validation_status      | varchar(50)  | NOT NULL DEFAULT 'pending'     | 校验状态                        |
| confidence_label       | varchar(50)  | NULL                           | 置信标记                        |
| latency_ms             | integer      | NULL                           | 生成耗时                        |
| token_input            | integer      | NULL                           | 输入 token 数                   |
| token_output           | integer      | NULL                           | 输出 token 数                   |
| created_at             | timestamptz  | NOT NULL DEFAULT now()         | 创建时间                        |
| updated_at             | timestamptz  | NOT NULL DEFAULT now()         | 更新时间                        |

------

### Table: `answer_citations`

回答引用映射表

| 字段名             | 类型         | 约束                           | 注释                         |
| ------------------ | ------------ | ------------------------------ | ---------------------------- |
| id                 | uuid         | PK                             | answer citation ID           |
| answer_session_id  | uuid         | FK -> answer_sessions.id       | 所属回答                     |
| chunk_id           | uuid         | FK -> legal_document_chunks.id | 支持该回答的 chunk           |
| document_id        | uuid         | FK -> legal_documents.id       | 支持文书 ID                  |
| citation_label     | varchar(255) | NULL                           | 展示给用户的 citation label  |
| paragraph_start_no | integer      | NULL                           | 起始段落号                   |
| paragraph_end_no   | integer      | NULL                           | 结束段落号                   |
| supporting_excerpt | text         | NULL                           | 用于前端 evidence 展示的摘录 |
| answer_span_start  | integer      | NULL                           | 对应 answer 中起始位置       |
| answer_span_end    | integer      | NULL                           | 对应 answer 中结束位置       |
| citation_order     | integer      | NOT NULL                       | 在答案中的顺序               |
| created_at         | timestamptz  | NOT NULL DEFAULT now()         | 创建时间                     |

------

### Table: `model_registry`

模型注册表

| 字段名        | 类型         | 约束                   | 注释                   |
| ------------- | ------------ | ---------------------- | ---------------------- |
| id            | uuid         | PK                     | 模型记录 ID            |
| model_type    | varchar(50)  | NOT NULL               | embedding/reranker/llm |
| provider      | varchar(100) | NOT NULL               | 提供商                 |
| model_name    | varchar(255) | NOT NULL               | 模型名                 |
| model_version | varchar(100) | NULL                   | 模型版本               |
| is_active     | boolean      | NOT NULL DEFAULT true  | 是否启用               |
| metadata_json | jsonb        | NULL                   | 额外元数据             |
| created_at    | timestamptz  | NOT NULL DEFAULT now() | 创建时间               |

------

### Table: `prompt_versions`

Prompt 版本表

| 字段名      | 类型         | 约束                   | 注释                      |
| ----------- | ------------ | ---------------------- | ------------------------- |
| id          | uuid         | PK                     | prompt 版本 ID            |
| prompt_name | varchar(255) | NOT NULL               | prompt 名称               |
| prompt_type | varchar(50)  | NOT NULL               | system/user/answer_schema |
| prompt_text | text         | NOT NULL               | prompt 内容               |
| version_tag | varchar(50)  | NOT NULL               | 版本号                    |
| is_active   | boolean      | NOT NULL DEFAULT true  | 是否启用                  |
| created_at  | timestamptz  | NOT NULL DEFAULT now() | 创建时间                  |

------

### Table: `evaluation_datasets`

评测集表

| 字段名             | 类型         | 约束                   | 注释       |
| ------------------ | ------------ | ---------------------- | ---------- |
| id                 | uuid         | PK                     | 评测集 ID  |
| name               | varchar(255) | NOT NULL               | 评测集名称 |
| description        | text         | NULL                   | 描述       |
| created_by_user_id | uuid         | FK -> users.id, NULL   | 创建人     |
| is_active          | boolean      | NOT NULL DEFAULT true  | 是否启用   |
| created_at         | timestamptz  | NOT NULL DEFAULT now() | 创建时间   |

------

### Table: `evaluation_queries`

评测问题表

| 字段名                | 类型        | 约束                         | 注释                      |
| --------------------- | ----------- | ---------------------------- | ------------------------- |
| id                    | uuid        | PK                           | 评测问题 ID               |
| dataset_id            | uuid        | FK -> evaluation_datasets.id | 所属评测集                |
| query_text            | text        | NOT NULL                     | 评测问题                  |
| query_type            | varchar(50) | NOT NULL                     | citation/keyword/nl_query |
| expected_document_ids | jsonb       | NULL                         | 预期命中文书 ID 列表      |
| expected_citations    | jsonb       | NULL                         | 预期 citation             |
| expected_keywords     | jsonb       | NULL                         | 预期关键词                |
| notes                 | text        | NULL                         | 备注                      |
| created_at            | timestamptz | NOT NULL DEFAULT now()       | 创建时间                  |

------

### Table: `evaluation_runs`

评测运行表

| 字段名               | 类型         | 约束                         | 注释                  |
| -------------------- | ------------ | ---------------------------- | --------------------- |
| id                   | uuid         | PK                           | 评测运行 ID           |
| dataset_id           | uuid         | FK -> evaluation_datasets.id | 评测集 ID             |
| retrieval_strategy   | varchar(100) | NOT NULL                     | 使用的检索策略        |
| llm_model_name       | varchar(255) | NULL                         | 使用的 LLM            |
| embedding_model_name | varchar(255) | NULL                         | 使用的 embedding 模型 |
| reranker_model_name  | varchar(255) | NULL                         | 使用的 reranker       |
| started_at           | timestamptz  | NULL                         | 开始时间              |
| finished_at          | timestamptz  | NULL                         | 完成时间              |
| status               | varchar(50)  | NOT NULL DEFAULT 'queued'    | 运行状态              |
| created_at           | timestamptz  | NOT NULL DEFAULT now()       | 创建时间              |

------

### Table: `evaluation_results`

评测结果表

| 字段名              | 类型          | 约束                        | 注释              |
| ------------------- | ------------- | --------------------------- | ----------------- |
| id                  | uuid          | PK                          | 评测结果 ID       |
| evaluation_run_id   | uuid          | FK -> evaluation_runs.id    | 所属评测运行      |
| evaluation_query_id | uuid          | FK -> evaluation_queries.id | 所属评测问题      |
| precision_at_5      | numeric(10,4) | NULL                        | P@5               |
| recall_at_5         | numeric(10,4) | NULL                        | R@5               |
| citation_accuracy   | numeric(10,4) | NULL                        | citation 准确率   |
| groundedness_score  | numeric(10,4) | NULL                        | groundedness 分数 |
| latency_ms          | integer       | NULL                        | 总耗时            |
| result_payload      | jsonb         | NULL                        | 详细评测结果      |
| created_at          | timestamptz   | NOT NULL DEFAULT now()      | 创建时间          |

------

## 5.4 Pinecone 索引设计

Pinecone 里每条向量建议包含以下 metadata：

- `chunk_id`
- `document_id`
- `title`
- `neutral_citation`
- `court`
- `jurisdiction`
- `decision_date`
- `document_type`
- `paragraph_start_no`
- `paragraph_end_no`
- `heading_path`
- `chunk_type`
- `embedding_model_version`