# 项目规范（Project Specification）

## 1. 项目名称

法律案例检索引擎（MVP）

---

## 2. 项目目标

构建一个以对话为核心、以检索为基础、以证据为支撑的法律研究系统，使用户能够：

- 通过自然语言对话提出法律研究问题
- 获取基于真实案例与法规的 grounded 回答
- 查看每轮回答对应的 cited authorities、段落引用与 supporting excerpts
- 从对话中的引用跳转到案件详情页进行核验

系统优先级：

- 正确性优于完整性
- 可追溯性优于抽象性
- 对话体验建立在证据透明性之上

---

## 3. 系统概览

系统由以下部分组成：

### 前端
- Next.js 15 + React 19
- Tailwind CSS + MUI
- Zustand 状态管理
- AI-native chat interface，交互风格接近 ChatGPT / Gemini / Claude
- 以对话线程为主界面，authority cards / citation blocks 附着在 assistant message 上

### 后端
- Python FastAPI（单体服务）
- 负责：
  - 搜索
  - 检索
  - RAG 编排
  - 文档查询
  - 日志记录

### 数据库
- PostgreSQL → 主数据存储
- Pinecone → 向量检索

### AI 层
- LLM（OpenAI / Gemini / Claude 等）
- 仅用于基于证据的答案生成

### 离线处理流程
- Python 脚本负责：
  - 文档清洗
  - chunk 切分
  - embedding 生成
  - 数据导入

---

## 4. 核心原则

### 4.1 检索优先（Retrieval-first）

所有答案必须基于检索得到的法律来源。

LLM 只能在检索之后使用。

---

### 4.2 基于权威来源（Authority-grounded）

所有输出必须可映射到：

- document_id
- chunk_id
- paragraph range（段落范围）

不允许出现无法追溯来源的内容。

---

### 4.3 混合检索（Hybrid Retrieval）

系统必须结合：

- 词法检索（PostgreSQL）
- 向量检索（Pinecone）

不能仅依赖向量检索。

---

### 4.4 法律感知的分块（Legal-aware Chunking）

chunk 是：

- 证据单元
- 而不是简单的 token 切片

chunk 必须保留：

- 段落边界
- 语义完整性
- 引用上下文

---

### 4.5 保守生成（Conservative Generation）

当证据不足时：

- 不允许编造
- 必须返回 limitations
- 可以返回部分结论

---

## 5. 系统边界

### 范围内功能

- 对话式法律研究
- 法律文书检索
- 混合检索
- 基于证据的回答生成
- authority / citation / excerpt 展示
- 文档详情查看
- 离线索引构建

---

### MVP 不包含

- 用户鉴权系统
- 用户账号
- 文档上传
- 在线 ingestion
- 邮件系统
- 支付系统
- 管理后台
- 多租户架构
- 后台任务队列

---

## 6. 数据流

### 6.1 离线流程

1. 收集法律文书
2. 标准化结构
3. 提取段落
4. 生成 chunk（法律感知）
5. 生成 embedding
6. 写入：
   - PostgreSQL（文档、段落、chunk）
   - Pinecone（向量索引）

---

### 6.2 在线流程

#### 对话问答流程（主流程）

1. 用户在聊天输入框输入法律问题
2. 后端进行 query 分类
3. PostgreSQL 执行词法检索 + 过滤
4. Pinecone 执行向量检索
5. 合并结果并排序
6. 选取 top evidence chunks
7. 调用 LLM 生成 grounded assistant message
8. 返回：
   - answer_text
   - cited_authorities
   - supporting_excerpts
   - paragraph refs
   - limitations
9. 前端以对话消息形式展示答案，并附 authority cards / citation sections

#### 文档核验流程

1. 用户点击对话中的 cited authority
2. 前端跳转案件详情页
3. 展示 metadata、summary、paragraph-by-paragraph reader
4. 用户核验原文与段落

#### 搜索流程（辅助能力）

1. 用户可通过搜索模式或 query routing 触发显式搜索
2. 后端返回候选 authorities 与 snippets
3. 前端以对话相关的结果卡片或辅助结果视图展示

---

## 7. API 定义

### 健康检查
- GET /health

---

### 搜索接口
- GET /search

输入：
- query
- 可选过滤条件

输出：
- 结果列表（chunk 级）
- metadata
- snippets
- 段落范围

---

### 问答接口
- POST /ask

输入：
- query
- 可选过滤条件

输出：
- message_id（可选）
- role
- answer_text
- cited_authorities
- supporting_excerpts
- limitations

---

### 文档详情
- GET /documents/{id}

---

### 段落详情
- GET /documents/{id}/paragraphs

---

## 8. 数据模型（概念层）

### LegalDocument
- id
- title
- neutral_citation
- court
- jurisdiction
- decision_date
- summary_text
- source_url

---

### Paragraph
- id
- document_id
- paragraph_no
- paragraph_order
- paragraph_text

---

### Chunk
- id
- document_id
- chunk_text
- paragraph_start_no
- paragraph_end_no
- heading_path
- vector_id

---

## 9. 检索策略

### 查询类型

- citation 查询
- case name 查询
- keyword 查询
- 自然语言查询

---

### 检索步骤

1. query 分类
2. 应用 metadata 过滤
3. PostgreSQL 词法检索
4. Pinecone 向量检索
5. 合并结果
6. rerank
7. 返回 top evidence

---

## 10. 答案生成

### 要求

- 只能基于检索结果
- 必须引用权威来源
- 必须包含段落引用
- 不允许无依据推断
- 输出应适配对话式 assistant message 呈现

---

### 输出结构

- answer_text
- cited_authorities[]
- supporting_excerpts[]
- paragraph_refs[]
- limitations

---

## 11. 可观测性

系统需要记录：

- 查询内容
- 检索候选
- 选中证据
- 使用模型
- 延迟
- 输出结果

---

## 12. 性能目标

- 搜索：1–3 秒
- 问答：2–6 秒

---

## 13. 技术约束

- 后端必须为 Python FastAPI
- 不引入其他后端框架
- 不拆分微服务
- Pinecone 为向量数据库
- PostgreSQL 为主数据源
- 前端主体验必须为 chat-first，而非 dashboard-first

---

## 14. MVP 成功标准

满足以下条件即为成功：

- 用户可以通过对话完成法律研究
- 回答基于真实权威来源
- 每轮 assistant message 都可显示 cited authorities 与 supporting excerpts
- 证据可视化且可追溯
- 混合检索优于简单搜索
- 系统端到端运行稳定