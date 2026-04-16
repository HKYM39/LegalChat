## Why

当前前端仍是 Next.js 默认起始页，尚未承载法律研究助手的核心体验，无法支持对话式提问、基于证据的回答展示、authority 跳转核验与案件段落阅读。现在需要根据 `Doc/ProjectPRD.md`、`Doc/FontendPRD.md` 与现有视觉稿，建立一套 chat-first 的前端页面与状态组织方式，为后续接通在线检索问答链路提供稳定 UI 基础。

## What Changes

- 新增主聊天页，按视觉稿实现居中欢迎区、suggested prompts、底部固定 composer 与对话线程布局。
- 新增 assistant message、authority cards、supporting excerpts、limitations 等核心消息渲染能力，保证回答与证据在同一对话流中呈现。
- 新增案件详情页，展示 metadata、summary、段落列表，并支持从聊天引用跳转进入核验页面。
- 新增前端 API client 与 Zustand 状态层，统一管理 `/ask`、`/search`、`/documents/:id`、`/documents/:id/paragraphs` 的请求、加载态与错误态。
- 新增与视觉稿一致的基础设计令牌、布局规则与空状态交互，确保首屏体验接近 AI-native 法律研究产品，而不是 dashboard。

## Capabilities

### New Capabilities
- `chat-first-legal-rag-frontend`: 定义法律研究助手主聊天页、案件详情页、消息证据组件、前端状态管理与 Hono API 集成要求。

### Modified Capabilities

无

## Impact

- 影响代码：`apps/web/app/`、`apps/web/components/`、`apps/web/lib/`、`apps/web/store/`、`apps/web/styles/`
- 影响页面：首页聊天页、案件详情页，可能包含辅助搜索模式入口
- 影响依赖：可能新增 Zustand、MUI、图标库与前端请求工具
- 影响接口：前端将直接消费 `/health`、`/ask`、`/search`、`/documents/:id`、`/documents/:id/paragraphs`
- 影响系统：Web 端将从占位页升级为可承载 retrieval-first、citation-grounded 法律研究体验的主界面
