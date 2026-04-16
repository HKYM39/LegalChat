## Context

当前 `apps/web` 仍是 Next.js 默认模板，只包含一个占位首页与基础全局样式，尚未具备聊天线程、案件详情页、前端状态管理或后端 API 集成能力。根据 `Doc/ProjectPRD.md` 与 `Doc/FontendPRD.md`，前端必须首先呈现为一个 conversation-first 的法律研究助手，而不是传统检索门户或后台式控制台；同时，用户提供的视觉稿已经给出首屏布局方向：顶部轻量品牌区、中部欢迎与 suggested prompts、底部固定输入框。

该变更会同时影响页面路由、组件结构、全局样式、状态管理和 API 集成方式，因此需要先明确以下约束：

- 前端技术栈固定为 Next.js + React + TypeScript + Tailwind CSS + MUI + Zustand
- 主入口必须围绕 `/ask` 构建，对话消息是首要信息单元
- authority、supporting excerpts、limitations 必须作为 assistant message 的一部分呈现
- 用户必须能够从聊天中的 authority 跳转到案件详情页并查看段落原文
- MVP 不引入认证、上传、支付、后台管理和多租户能力

## Goals / Non-Goals

**Goals：**

- 建立符合视觉稿和 PRD 的主聊天页，包括空状态、对话线程、固定 composer 与 suggested prompts
- 建立案件详情页，支持 metadata 展示、summary 展示与 paragraph-by-paragraph 阅读
- 建立前端状态管理与 API client，支撑 `/ask`、`/search`、`/documents/:id`、`/documents/:id/paragraphs`
- 建立 assistant message、authority cards、evidence section 等消息级组件
- 建立统一视觉令牌与布局规则，使界面呈现 AI-native、法律研究导向、轻量可信的风格

**Non-Goals：**

- 不实现用户登录、会话持久化账号体系或聊天历史服务端同步
- 不实现文件上传、管理后台或复杂筛选工作台
- 不在本次变更中扩展新的后端接口或修改检索逻辑
- 不实现多主题系统或大规模设计系统抽象

## Decisions

### 决策一：采用 App Router 下的“两主路由”结构

首页负责聊天主体验，案件详情页负责 citation verification。建议至少落地：

- `/`：主聊天页
- `/documents/[documentId]`：案件详情页

这样可以保持用户从聊天到证据核验的路径最短，也符合 PRD 中“对话为主、详情核验为辅”的结构。

备选方案：

- 使用单页右侧抽屉承载案件详情：切换更快，但会让段落长文阅读空间不足
- 单独增加 `/search` 作为主入口：会稀释 chat-first 定位，不符合当前产品方向

### 决策二：组件按“消息流 + 证据块 + 文档阅读”分层

主聊天页不应由一个超大 page 文件直接拼装，而应拆成：

- 页面壳层：品牌头部、居中主区域、底部 composer
- 对话层：ConversationThread、UserMessage、AssistantMessage
- 证据层：AuthorityCard、EvidenceSection、LimitationList、SuggestedPromptCard
- 文档层：CaseMetadata、ParagraphList、ParagraphItem

这样可以让后续实现和测试围绕“消息单元”和“证据单元”组织，避免退化成 dashboard 卡片堆砌。

备选方案：

- 页面中内联全部组件：速度快，但不利于后续维护
- 以搜索结果列表为中心拆分组件：不符合 assistant message 作为主信息单元的要求

### 决策三：使用 Zustand 拆分 `chatStore` 与 `documentStore`

主聊天页与案件详情页虽然互相关联，但状态生命周期不同，因此推荐拆成两个 store：

- `chatStore`：输入框值、消息列表、空状态 suggested prompts、发送中状态、问答错误、当前聚焦 authority
- `documentStore`：当前案件详情、段落列表、加载态、错误态、段落定位信息

这种拆分可以让主聊天页保持即时交互性能，也能避免文档阅读状态污染消息流。

备选方案：

- 单一全局 store：接入简单，但状态边界容易混乱
- 全部依靠 React 本地状态：短期可行，但跨页面和消息引用联动会快速失控

### 决策四：API client 以 typed contract 为中心，优先对接已存在的 shared schema

前端请求不应在组件中散落 `fetch` 逻辑，而应统一封装在 `lib/api` 或同类目录中，并直接映射到共享类型：

- `/ask` 返回 assistant message 相关字段
- `/search` 用于辅助 citation lookup 或调试搜索
- `/documents/:id` 与 `/documents/:id/paragraphs` 支撑案件详情页

这样可以保证 UI 层直接围绕 `message -> authorities -> excerpts -> document` 这条数据链工作。

备选方案：

- 在组件内直接发请求：实现快，但类型与错误处理会重复
- 引入重量级数据请求框架：能力更强，但当前 MVP 复杂度不划算

### 决策五：视觉上保持“轻品牌 + 大留白 + 中央聚焦”的空状态，并在有消息后过渡为窄列阅读体验

根据视觉稿，首页在空状态应是高度克制的：

- 顶部仅保留品牌与简短副标题
- 中央展示产品名、能力说明与四张 suggested prompt 卡片
- 底部固定输入框，作为唯一主操作

当用户开始提问后，页面应自然过渡为可持续阅读的消息流，而不是重新进入复杂工作台。这种状态切换可以通过同一页面不同布局状态实现，而不是跳转到另一个结果页。

备选方案：

- 空状态直接显示大面积营销文案：会削弱“可以马上提问”的直觉
- 从一开始就显示左右双栏复杂布局：不符合当前视觉稿的克制感

### 决策六：案件详情页优先服务于“核验”而不是“二次摘要生成”

案件详情页直接展示 canonical metadata、summary 与段落列表，必要时支持滚动定位到被引用段落。页面重点是让用户核对：

- 这条 authority 是哪篇案件
- 具体引的是哪几个段落
- 原文上下文是什么

因此详情页不应再次把内容包装成新的 AI 输出。

备选方案：

- 在详情页加入 AI 摘要与衍生问答：后续可扩展，但当前会分散焦点
- 只显示简略摘要不显示段落：不满足 traceability 目标

## Risks / Trade-offs

- [后端响应字段与前端预期可能继续演化] → 通过 typed API client 与 shared schema 对齐，减少散落字段依赖
- [空状态和消息态共存在同一路由中，布局切换容易混乱] → 以“是否存在消息”为唯一主判定，避免多套布局并行
- [案件段落较长，详情页可能出现阅读负担] → 通过 metadata 头部、引用段落定位和分段渲染降低认知压力
- [现有 `apps/web` 依赖较少，新增 Zustand/MUI 时可能触发样式与构建调整] → 先在设计中约束依赖范围，避免同时引入多套 UI 框架能力
- [视觉稿非常克制，实际实现容易退回默认组件库风格] → 通过全局设计令牌、留白比例、边框和阴影规范限制默认样式外溢

## Migration Plan

- 第一步：补齐 `apps/web` 的页面骨架、全局样式变量和路由结构
- 第二步：实现聊天页核心组件与空状态视觉
- 第三步：实现 API client 与 Zustand store，接通问答主路径
- 第四步：实现 authority/evidence 组件与案件详情页
- 第五步：补充基础交互验证与运行说明
- 回滚策略：若实现出现问题，可按页面、组件、状态层逐步回退；该变更不涉及数据库迁移或后端 schema 回滚

## Open Questions

- 是否需要在 MVP 首屏保留左侧聊天历史占位，还是完全按视觉稿只保留中央主区域
- 是否需要在本次变更中实现辅助搜索模式入口，还是仅在内部保留 API 能力
- 是否需要在案件详情页首版支持高亮引用段落，还是先实现滚动定位即可
