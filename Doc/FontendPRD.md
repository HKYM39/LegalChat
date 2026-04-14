## 1. 前端目标

前端必须呈现为一个 AI-native legal assistant，而不是传统后台管理页面。

用户打开产品后，第一感受应该是：

- 可以直接提问
- 这是个法律研究助手
- 回答会带真实案例和引用
- 可以点击引用查看原文

------

## 2. 前端技术栈

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- MUI
- Zustand

------

## 3. 前端页面定义

## 3.1 主聊天页

这是产品主页面，也是最重要的页面。

### 页面目标

- 承载整个法律研究对话流程
- 作为 `/ask` 的主要交互入口
- 展示 assistant message、authority cards、supporting excerpts

### 页面结构

左侧可选会话列表，中间为对话线程，底部为输入框。
 如果 MVP 不做多会话，可以先省略左侧 sidebar，只保留对话线程和输入框。

### 页面功能

- 显示用户消息
- 显示 assistant 消息
- assistant 消息中展示：
  - answer_text
  - cited authorities
  - supporting excerpts
  - limitations
- authority card 点击跳转 Case Detail
- 初始页面显示 suggested prompts

------

## 3.2 Case Detail Page

用于查看案件详情和原始段落。

### 页面目标

- 作为引用核验页
- 给用户完整阅读 authority 的能力

### 页面内容

- case title
- neutral citation
- court
- jurisdiction
- decision date
- summary text
- paragraph-by-paragraph reader

### 页面功能

- 展示段落编号
- 支持定位相关段落
- 从聊天中的 authority 跳转进入

------

## 3.3 辅助搜索页或辅助搜索模式

MVP 可选，不再是主页面。

### 用途

- 做 citation lookup
- 做 keyword search
- 作为调试和补充检索工具

### 说明

即使保留，也应从属于 chat experience，而不是主产品首页。

------

## 4. 核心组件

## 4.1 ConversationThread

用于渲染对话流。

职责：

- 组织 user / assistant messages
- 管理消息间距和阅读宽度
- 支持滚动到底部

------

## 4.2 UserMessage

用于显示用户提问。

要求：

- 简洁
- 与 assistant message 有明显视觉区分
- 不抢占主要信息层级

------

## 4.3 AssistantMessage

最核心组件。

职责：

- 渲染 answer_text
- 渲染 authority cards
- 渲染 supporting excerpts
- 渲染 limitations

要求：

- 看起来像 GPT/Gemini 风格的 AI 回答
- 同时保留法律研究的可信感
- 不要做成仪表盘式信息面板

------

## 4.4 AuthorityCard

用于展示单条 authority。

字段：

- title
- neutral citation
- court
- paragraph references
- short excerpt

交互：

- 点击进入案件详情页

------

## 4.5 CitationBlock / EvidenceSection

用于展示 supporting excerpts。

内容：

- excerpt text
- source metadata
- paragraph refs

可做成：

- 折叠块
- 内联 evidence section
- message 内附加卡片

------

## 4.6 ChatComposer

底部输入框。

要求：

- 大输入框
- 支持自然语言问题
- loading 态明确
- 风格接近 ChatGPT / Gemini

------

## 4.7 SuggestedPromptCard

空状态时展示示例问题。

示例：

- 哪些案件讨论了 procedural fairness？
- 总结 Mabo v Queensland (No 2) 的核心推理

------

## 4.8 CaseMetadata

案件详情页头部组件。

------

## 4.9 ParagraphList / ParagraphItem

案件详情页阅读组件。

------

## 5. 前端状态管理

推荐两个核心 store：

### chatStore

管理：

- currentInput
- messages
- ask loading
- ask error
- selected authority（可选）
- suggested prompts

### documentStore

管理：

- current document
- paragraph list
- loading
- error

如有需要，可加 `uiStore` 管理 drawer / panel 状态。

------

## 6. 前端 API 依赖

前端直接调用 Hono API。

### 主接口

- GET `/health`
- GET `/search`
- POST `/ask`
- GET `/documents/:documentId`
- GET `/documents/:documentId/paragraphs`

### 使用策略

- `/ask` 是主入口
- `/search` 是辅助能力
- `/documents/*` 支撑 citation verification

------

## 7. 消息数据结构

前端应按 assistant message 来消费 `/ask` 结果。

推荐结构：

```

{
  "messageId": "msg_001",
  "role": "assistant",
  "answerText": "...",
  "authorities": [],
  "supportingExcerpts": [],
  "limitations": null
}
```

------

## 8. UX 原则

### Chat-first

用户进入后应先看到对话入口。

### Trust through evidence

每轮回答都应该尽量能展开 authority 和 excerpt。

### Minimal but legal-specific

既要 AI-native，也要展示法律元数据。

### Long-form reading support

Case Detail 页必须支持长文本阅读。

### No scope creep

前端不加入 auth、upload、payment、email、admin。

------

## 9. MVP 交付范围

### 必做

- 主聊天页
- AssistantMessage
- AuthorityCard
- Case Detail Page

### 可选增强

- Chat history sidebar
- Search helper page
- citation foldout
- paragraph highlight jump