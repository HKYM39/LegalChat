# 前端 PRD（Chat-first Legal AI Interface）

## 1. Frontend Vision

前端应呈现为一个 AI-native legal research assistant，而不是传统 SaaS dashboard。

产品体验应更接近：

- ChatGPT
- Gemini
- Claude

但输出内容是法律研究结果：

- grounded answers
- cited authorities
- paragraph references
- supporting excerpts

核心特征：

- 对话优先
- assistant messages 为核心信息单元
- authorities / citations 附着在消息上
- case detail 作为核验页

---

## 2. Frontend Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- MUI
- Zustand

---

## 3. Frontend Pages

### 3.1 Main Chat Page（主页面）

这是产品主界面。

#### 目标

- 用户通过聊天输入法律研究问题
- AI 以 assistant message 形式返回 grounded answer
- 每轮回答可附 authority cards / citation blocks / excerpt sections

#### 页面结构

- 左侧：可选 Chat Sidebar（会话列表）
- 中间：Conversation Thread
- 底部：Chat Composer
- 右侧：可选 Evidence Drawer / Authority Detail Panel（可后续增强）

#### 必备功能

- 显示用户消息
- 显示 assistant 消息
- assistant 消息可展示：
  - answer_text
  - cited authorities
  - supporting excerpts
  - limitations
- 可点击 authority 跳转 Case Detail
- 初始空状态展示 suggested prompts

---

### 3.2 Case Detail Page

#### 目标

- 用于查看被引用案件的详情
- 作为 evidence verification 页面

#### 内容

- case title
- neutral citation
- court
- jurisdiction
- decision date
- summary text
- paragraph-by-paragraph reader

#### 必备功能

- 支持 paragraph number 显示
- 支持从聊天消息中的 authority 跳转进入
- 支持显示相关段落范围

---

### 3.3 Optional Search View（辅助页或辅助模式）

该功能不再是主页面。

#### 目标

- 作为显式 authority lookup 的辅助视图
- 用于 citation / keyword 查询

#### 内容

- 搜索输入框
- result cards
- snippets
- legal metadata

说明：
MVP 可先将其弱化为：

- 聊天内工具模式
- 或隐藏页
- 或仅供开发调试

---

## 4. Core UI Components

### 4.1 ChatSidebar

用于展示：

- New Chat
- 会话列表（可选）
- 历史研究主题（可选）

MVP 可简化，不一定先做完整多会话历史。

---

### 4.2 ConversationThread

用于展示消息流：

- user messages
- assistant messages

要求：

- 清晰区分角色
- assistant message 支持复杂内容块
- 保持类似 ChatGPT / Gemini 的阅读体验

---

### 4.3 UserMessage

用户消息组件

要求：

- 简洁
- 清晰角色区分
- 保持 AI chat 风格一致

---

### 4.4 AssistantMessage

最核心组件

应支持：

- answer_text
- cited_authorities
- supporting_excerpts
- limitations
- expandable citation blocks（可选）

要求：

- 看起来像 AI chat response，不像报告页
- 证据结构清晰但不应破坏对话感

---

### 4.5 ChatComposer

底部输入区

应支持：

- 自然语言输入
- submit
- loading 状态
- 占位文案：Ask about cases, authorities, and legal reasoning

风格应接近：

- ChatGPT message composer
- Gemini prompt box

---

### 4.6 AuthorityCard

附着在 assistant message 下方或内部的权威来源卡片

展示：

- case title
- neutral citation
- court
- paragraph references
- short excerpt

要求：

- 高可信
- 易读
- 点击后可进入 Case Detail

---

### 4.7 CitationBlock / EvidenceSection

用于展示 supporting excerpts

内容：

- excerpt text
- paragraph refs
- source metadata

可设计成：

- 折叠块
- 内联区块
- 小型 evidence cards

---

### 4.8 CaseMetadata

案件详情头部信息组件

---

### 4.9 ParagraphList / ParagraphItem

案件阅读页组件

要求：

- 显示 paragraph number
- 高亮相关段落（可后续增强）
- 保持长文阅读体验

---

## 5. Frontend State Management

建议 Zustand store：

### chatStore

管理：

- currentInput
- messages
- loading state
- error state
- optional conversation list

### documentStore

管理：

- selected document
- paragraphs
- loading
- error

### uiStore（可选）

管理：

- selected authority
- evidence drawer open/close
- highlighted excerpt

MVP 可先只实现：

- chatStore
- documentStore

---

## 6. API Integration

前端直接调用 FastAPI。

### 主接口

- GET /health
- GET /search
- POST /ask
- GET /documents/{document_id}
- GET /documents/{document_id}/paragraphs

### 推荐前端使用方式

- `/ask` 作为主入口
- `/search` 作为辅助检索接口
- `/documents/*` 作为 citation verification 支撑

---

## 7. Message-oriented Response Shape

前端应按“消息对象”消费 `/ask` 返回结果。

推荐结构

```json
{
  "message_id": "msg_001",
  "role": "assistant",
  "answer_text": "...",
  "authorities": [],
  "supporting_excerpts": [],
  "limitations": null
}

    ## 2.1 Frontend Tech Stack

    - Next.js 15
    - React 19
    - TypeScript
    - Tailwind CSS
    - MUI
    - Zustand

    ## 2.2 Frontend Goals

    前端需要证明以下几点：

    - 你能做完整 product UI
    - 你能把 AI / evidence 联动可视化
    - 你能处理搜索、流式输出、状态管理
    - 你能做 admin/debug 界面

    ## 2.3 Information Architecture

    ### Page 1: Search Page

    用途：检索主入口

    #### Components

    - Global Search Bar
    - Search Mode Tabs
      - Citation
      - Keyword
      - Ask AI
    - Filter Sidebar
      - Jurisdiction
      - Court
      - Date Range
      - Document Type
    - Results List
    - Result Detail Preview Panel
    - Pagination / Infinite Scroll

    #### Functional Requirements

    - 支持用户输入查询并触发检索
    - 支持切换搜索模式
    - 支持 filter 组合
    - 支持保留上次搜索条件
    - 支持高亮命中词
    - 支持点击结果查看详情
    - 支持 loading / empty / error 状态

    #### UI Data Returned

    每条结果至少展示：

    - title
    - citation
    - court
    - jurisdiction
    - decision_date
    - snippet
    - badges（semantic / lexical / reranked）
    - source_type

    ------

    ### Page 2: AI Research Assistant

    用途：法律研究问答

    #### Layout

    - 顶部：研究问题输入框
    - 左栏：streamed answer panel
    - 右栏：evidence panel
    - 底部：used authorities / related results

    #### Left Pane Requirements

    - 流式渲染回答
    - 分段展示 answer block
    - 每段 answer 关联 citation tags
    - 点击 citation 后联动 evidence panel
    - 支持复制 answer

    #### Right Pane Requirements

    - 展示相关 authority snippets
    - 展示 paragraph refs
    - 展示 case metadata
    - 高亮当前 answer 对应的 supporting chunk
    - 支持展开上下文
    - 支持跳转完整 case detail

    #### Functional Requirements

    - 发送 query 后先显示 retrieved authorities
    - 再进入 answer streaming
    - stream 结束后显示 final citations
    - 支持 retry
    - evidence 与 answer 联动滚动

    ------

    ### Page 3: Case Detail Page

    用途：完整查看单份案件

    #### Sections

    - Metadata Summary
    - Case Overview
    - Structured Headings
    - Numbered Paragraphs
    - Extracted Citations
    - Related Authorities（可选）

    #### Functional Requirements

    - 支持 paragraph anchor
    - 支持 query 高亮
    - 支持从 answer 跳转到具体 paragraph
    - 支持 source URL 打开原始来源

    ------

    ### Page 4: Admin / Ingestion Dashboard

    用途：展示工程能力与可运维性

    #### Modules

    - Document Upload
    - Import Queue
    - Ingestion Job Status
    - Metadata Preview
    - Chunk Count
    - Embedding Status
    - Index Status
    - Reindex Action
    - Failure Logs
    - Retrieval Debug Viewer

    #### Functional Requirements

    - 查看每份文档处理状态
    - 支持重试失败任务
    - 查看 chunking 结果
    - 查看 indexing 是否成功
    - 查看 retrieval trace（debug mode）

    ## 2.4 Frontend State Management

    使用 Zustand 划分以下 store：

    ### `searchStore`

    - currentQuery
    - searchMode
    - filters
    - results
    - pagination
    - selectedResult
    - loading
    - error

    ### `assistantStore`

    - askQuery
    - streamStatus
    - answerBlocks
    - usedAuthorities
    - evidenceItems
    - selectedCitation
    - selectedEvidence
    - error

    ### `adminStore`

    - uploadQueue
    - ingestionJobs
    - selectedDocument
    - parsePreview
    - reindexStatus

    ## 2.5 Frontend API Contracts

    ### Search

    - `GET /api/search`
    - `GET /api/cases/:id`
    - `GET /api/cases/:id/paragraphs`

    ### AI

    - `POST /api/ask`
    - `GET /api/ask/:sessionId/events`
    - `GET /api/ask/:sessionId/evidence`

    ### Admin

    - `POST /api/admin/documents/upload`
    - `POST /api/admin/documents/import`
    - `POST /api/admin/reindex/:documentId`
    - `GET /api/admin/jobs`
    - `GET /api/admin/documents/:id/status`

    ## 2.6 Frontend Non-Functional Requirements

    - 响应式布局，桌面优先
    - streaming 状态不卡 UI
    - citation 点击需低延迟
    - 所有错误提示可读
    - 能清楚区分“无结果”“检索失败”“模型失败”
```
