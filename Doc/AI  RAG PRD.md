- # 4. AI / RAG PRD

  ## 4.1 AI Objectives

  AI / RAG 层的目标不是“像聊天机器人一样自由回答”，而是：

  - 提高 legal retrieval 的召回与精度
  - 在检索结果上做 grounded synthesis
  - 让所有输出可追溯、可验证
  - 支持迭代式评测与调优
  - 在固定法律语料上提供可信的 legal research assistance

  本项目采用 **retrieval-first** 原则：

  - authority source 来自已索引的 case law / legislation
  - LLM 只负责基于 retrieved authorities 做归纳、压缩与表达
  - 不允许模型将未检索到的内容包装成依据

  ---

  ## 4.2 AI Tech Stack

  ### Online Runtime
  - Python 3.11+
  - FastAPI
  - Pydantic
  - Pinecone
  - PostgreSQL
  - OpenAI / Gemini / Claude / OpenRouter（MVP 仅接一个）

  ### Offline Processing
  - sentence-transformers（可选）
  - Hugging Face
  - scikit-learn
  - PyTorch（可选）
  - 本地 Python scripts

  说明：

  - 在线 AI / RAG 服务由 FastAPI 提供查询、检索、生成能力
  - 文档清洗、结构解析、chunking、embedding 生成、Pinecone upsert 在本地离线完成
  - MVP 不要求在线进行文档 ingestion、re-embedding、重建索引

  ---

  ## 4.3 AI System Scope

  AI / RAG 层分为两部分：

  ### A. Offline Indexing Layer
  由本地脚本执行，负责：
  - 法律文书清洗与标准化
  - legal-aware chunking
  - embedding generation
  - PostgreSQL 导入
  - Pinecone upsert

  ### B. Online Retrieval & Generation Layer
  由 FastAPI 提供，负责：
  - query understanding
  - hybrid retrieval
  - reranking
  - grounded answer synthesis
  - validation
  - evaluation logging

  ---

  ## 4.4 AI Core Subsystems

  ### Subsystem A: Offline Legal Document Preparation

  职责：
  - 识别法律文书结构
  - 提取 metadata
  - 按 section / heading / paragraph 做 segmentation
  - 生成 legal-aware chunks
  - 为在线检索准备标准化数据

  #### Requirements
  - 不做 naive fixed-size chunking
  - 保留 paragraph numbering
  - 保留 heading hierarchy
  - 保留 citation boundaries
  - 为每个 chunk 绑定 source metadata
  - chunk 必须能映射回 document 与 paragraph range

  #### Output
  - normalized_document
  - section tree
  - paragraph list
  - chunk list
  - extracted citations
  - document metadata

  #### Notes
  该子系统为 **离线处理流程**，不在在线 FastAPI API 中执行。  
  MVP 不提供上传、在线解析、在线导入功能。

  ---

  ### Subsystem B: Embedding & Index Preparation

  职责：
  - 为 chunk 生成 embeddings
  - 将 embeddings 与 metadata 写入 Pinecone
  - 将 canonical document / paragraph / chunk records 写入 PostgreSQL

  #### Requirements
  - 记录 embedding model version
  - 支持 batch embedding
  - Pinecone metadata 必须包含 document_id、chunk_id、court、jurisdiction、date、paragraph range
  - PostgreSQL 与 Pinecone 的 chunk_id 必须稳定一致
  - 支持离线重复构建索引

  #### Notes
  该子系统属于 **离线索引构建流程**。  
  MVP 不要求在线 re-embedding 或在线重建 Pinecone index。

  ---

  ### Subsystem C: Query Understanding

  职责：
  - 对用户 query 进行归一化
  - 判断 query 类型
  - 提取 filters / entities
  - 为后续 retrieval 选择策略

  #### Query Types
  - citation lookup
  - case name lookup
  - legislation lookup
  - keyword / doctrine lookup
  - natural language legal research

  #### Output
  - query_type
  - normalized_query
  - extracted_filters
  - retrieval_strategy

  #### Requirements
  - citation pattern 应优先识别
  - query type routing 应尽量简单且可解释
  - MVP 可先使用 rule-based classification，而非复杂分类模型

  ---

  ### Subsystem D: Hybrid Retrieval

  职责：
  - 组合 dense retrieval、lexical retrieval 与 metadata filtering
  - 返回高质量 evidence candidates

  #### Retrieval Pipeline
  1. query classification
  2. metadata pre-filter
  3. lexical search in PostgreSQL
  4. dense vector search in Pinecone
  5. merge / reciprocal rank fusion / weighted scoring
  6. rerank
  7. evidence packaging

  #### Requirements
  - citation lookup 走 exact-first
  - doctrine lookup 走 lexical + dense
  - semantic questions 走 dense + lexical
  - metadata filters 必须下推
  - 返回 chunk-level evidence，而非只返回 document-level 命中
  - 返回可调试的 retrieval trace

  #### Notes
  法律场景不适合仅依赖 dense retrieval。  
  hybrid retrieval 是本项目可信度的核心组成部分。

  ---

  ### Subsystem E: Reranking

  职责：
  - 提升 top-k evidence relevance
  - 压制语义相似但法律上不够精确的片段
  - 为 answer synthesis 准备更稳定的上下文集合

  #### MVP Rerank Signals
  - dense similarity
  - lexical score
  - citation exact hit
  - query token overlap
  - jurisdiction match
  - court match
  - heading match
  - paragraph range relevance
  - 同一 document 多 chunk 命中加权（可选）

  #### Output
  - reranked evidence list
  - relevance score
  - debug trace

  #### Requirements
  - MVP 可先采用 heuristic reranking
  - 后续可替换为 cross-encoder reranker
  - rerank 结果必须保留 chunk 到 source 的映射

  ---

  ### Subsystem F: Grounded Answer Synthesis

  职责：
  - 基于 retrieved authorities 生成回答
  - 输出可供前端 evidence panel 消费的结构化结果

  #### Input
  - query
  - evidence set
  - answer schema
  - prompt version

  #### Output Schema
  - answer_text
  - cited_authorities[]
  - supporting_excerpts[]
  - paragraph_refs[]
  - limitations
  - confidence_label

  #### Requirements
  - 模型只能基于 retrieved context 输出
  - 所有 claim 尽量绑定 evidence
  - citation 必须映射回 chunk / paragraph
  - authority 不足时不能强答
  - answer 应优先简洁、准确、可验证，而不是追求长文本

  #### Notes
  MVP 第一版可以先采用同步 JSON 返回。  
  streaming 可作为后续增强能力，不作为第一阶段必需项。

  ---

  ### Subsystem G: Post-Generation Validation

  职责：
  - 对回答进行 groundedness 检查
  - 防止模型输出未被 evidence 支撑的 claim

  #### Validation Checks
  - answer 中引用的 authority 是否存在于 retrieved set
  - supporting excerpts 是否匹配 source chunk
  - paragraph refs 是否有效
  - 是否出现明显 unsupported claims
  - cited_authorities 与 evidence set 是否一致

  #### Handling
  - validation failure -> trim unsupported claims
  - validation failure -> downgrade confidence
  - validation failure -> return evidence insufficient
  - 必要时可重新生成一次

  #### Requirements
  - validation 逻辑应轻量、可解释
  - 不依赖复杂额外模型也能运行
  - 优先保证“宁可保守，也不编造”

  ---

  ### Subsystem H: Evaluation

  职责：
  - 构建小型评测集
  - 评估 retrieval 与 answer quality
  - 支持 prompt、chunking、retrieval strategy 迭代

  #### Metrics
  - Precision@k
  - Recall@k
  - Citation Accuracy
  - Groundedness / Faithfulness
  - Retrieval Latency
  - Answer Latency
  - Top authority correctness

  #### Eval Dataset
  可手工构建 20–50 条 query，包括：
  - citation queries
  - exact doctrine queries
  - filter queries
  - natural language research queries

  #### Requirements
  - 评测集应覆盖 exact lookup 与 semantic lookup 两类任务
  - 评测要能比较不同 retrieval strategy
  - 评测结果应可回看 bad cases

  ---

  ## 4.5 Online / Offline Boundary

  ### Offline
  以下能力在本地执行，不属于在线 FastAPI runtime：
  - 文书清洗
  - 法律结构解析
  - chunking
  - embedding generation
  - Pinecone upsert
  - PostgreSQL seed / import

  ### Online
  以下能力由 FastAPI 提供：
  - query understanding
  - retrieval
  - reranking
  - answer generation
  - validation
  - query / answer logging

  这个边界是本项目 MVP 设计的关键。  
  它保证在线系统足够简单、稳定，并把复杂 ingestion 流程从 runtime 中剥离出去。

  ---

  ## 4.6 Design Principles

  ### Retrieval-first
  先找 authority，再让 LLM 归纳。

  ### Authority-grounded
  所有输出都应尽可能映射回 source chunk 与 paragraph range。

  ### Legal-aware chunking
  chunk 是证据单元，不是纯 token 容器。

  ### Hybrid over vector-only
  法律场景必须同时照顾 exact match 与 semantic retrieval。

  ### Conservative generation
  证据不足时应保守表达，而不是生成貌似合理的结论。

  ### Explainable outputs
  最终输出必须适合双栏 UI 展示：
  - 左边 answer
  - 右边 supporting evidence