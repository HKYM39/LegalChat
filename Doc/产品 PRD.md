- # 1. 产品总 PRD

  ## 1.1 Product Name

  Legal Casebase Search Engine MVP

  ## 1.2 Product Vision

  构建一个面向法律案例与法规检索的 AI 辅助研究系统。
   该系统能够对法律文书进行结构化解析、混合检索、可追溯问答，并以双栏证据联动界面帮助用户快速找到相关 authority。

  ## 1.3 Product Goal

  在一个小规模、高质量语料集上，完成以下能力闭环：

  - 法律文书 ingestion
  - 结构化解析与 legal-aware chunking
  - Hybrid Retrieval（关键词 + 向量）
  - AI grounded answer with citations
  - 前端双栏 evidence-linked UI
  - 管理后台与评测闭环

  ## 1.4 Product Positioning

  这是一个 **retrieval-first, citation-grounded legal research assistant**，不是通用 chatbot，也不是完整法律门户网站。

  ## 1.5 Target Users

  - 律师助理 / paralegal
  - 法律研究人员
  - 法律科技产品内部用户
  - 需要快速查询案例、法规与 supporting passages 的知识工作者

  ## 1.6 MVP Scope

  MVP 仅覆盖以下范围：

  ### In Scope

  - 判决书 / case law 检索
  - 基础 legislation 文本检索
  - citation / keyword / natural language 三种检索方式
  - hybrid retrieval
  - evidence-linked answer generation
  - 管理后台：文档导入、重建索引、查看状态
  - 基础评测与日志

  ### Out of Scope

  - 全量澳洲案例库覆盖
  - 复杂 OCR-first PDF pipeline
  - 高级 precedent graph
  - 多租户复杂权限
  - 复杂账单与企业计费
  - 自动法律意见生成
  - 多代理 autonomous legal agent

  ## 1.7 Core User Problems

  ### Problem A

  用户可以找到相关案例，但筛选和阅读成本高。

  ### Problem B

  语义搜索可能召回相似文本，但遗漏精确 citation / doctrine。

  ### Problem C

  AI 生成可能看似合理，但无法验证来源。

  ### Problem D

  现有问答界面通常只给答案，不展示证据链。

  ## 1.8 Product Principles

  - 检索优先，不是生成优先
  - 所有答案必须可追溯到 authority
  - 支持精确查找与语义研究并存
  - 结果可解释、可审计
  - 以工程可交付为导向，控制 MVP 范围

  ## 1.9 Core User Flows

  ### Flow 1: Citation Lookup

  用户输入案件 citation，系统返回：

  - 匹配案件
  - 基本元数据
  - 关键段落
  - 文档详情

  ### Flow 2: Keyword / Doctrine Search

  用户输入关键词或 doctrine 名称，系统返回：

  - 相关案例列表
  - 片段预览
  - metadata filters
  - 详情页

  ### Flow 3: Natural Language Legal Research

  用户输入研究问题，系统返回：

  - grounded answer
  - cited authorities
  - supporting excerpts
  - paragraph references

  ### Flow 4: Filtered Legal Search

  用户通过 court / jurisdiction / date / document type 进行过滤。

  ### Flow 5: Admin Reindexing

  管理员上传文档后，系统完成：

  - parse
  - metadata extraction
  - chunking
  - embedding
  - index
  - searchable

  ## 1.10 MVP Success Metrics

  ### Product Metrics

  - 用户能完成 citation / keyword / natural language 查询
  - 用户能从 answer 跳回 supporting passage
  - 用户能按 metadata 精确筛选结果

  ### Technical Metrics

  - Search latency < 3s
  - Ask-AI 首 token < 5s
  - Precision@5 / citation correctness 达到可演示水平
  - 所有 answer 具备可追溯 evidence