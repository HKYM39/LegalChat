## 1. 搭建前端页面骨架与依赖

- [x] 1.1 清理 `apps/web` 默认起始页与 metadata，建立符合法律研究助手定位的 App Router 页面骨架
- [x] 1.2 补充前端所需依赖与目录结构，创建 `components/`、`lib/`、`store/`、`app/documents/[documentId]/` 等基础模块
- [x] 1.3 重写全局样式与设计令牌，落实视觉稿中的轻品牌、留白布局、消息阅读宽度与底部 composer 风格

## 2. 实现主聊天页与消息组件

- [x] 2.1 实现主聊天页空状态，包含顶部品牌区、中央欢迎区、suggested prompt 卡片与底部固定输入框
- [x] 2.2 实现 `ConversationThread`、`UserMessage`、`AssistantMessage`、`ChatComposer` 等核心聊天组件
- [x] 2.3 实现 authority cards、supporting excerpts、limitations 等 assistant message 附属证据组件
- [x] 2.4 实现空状态到消息态的页面切换逻辑，保持同一路由内的 chat-first 阅读体验

## 3. 接通前端数据层与问答主路径

- [x] 3.1 实现类型化 API client，封装 `/health`、`/ask`、`/search`、`/documents/:id`、`/documents/:id/paragraphs`
- [x] 3.2 使用 Zustand 实现 `chatStore`，管理输入值、消息列表、问答加载态、错误态与 suggested prompts
- [x] 3.3 将聊天页与 `/ask` 接通，覆盖用户提问、回答渲染、加载态、失败态与保守回答展示

## 4. 实现案件详情页与核验路径

- [x] 4.1 新增 `/documents/[documentId]` 页面，展示 case metadata、summary 与段落阅读结构
- [x] 4.2 使用 Zustand 实现 `documentStore`，管理案件详情、段落列表、加载态、错误态与段落定位信息
- [x] 4.3 打通从 authority card 跳转至案件详情页的交互，并在详情页展示带编号的 paragraph 列表

## 5. 完成交互验证与运行说明

- [x] 5.1 补充主聊天页与案件详情页的基础交互验证，覆盖空状态、提问流程、错误态与详情加载主路径
- [x] 5.2 更新 `apps/web` 运行说明，说明前端启动方式、环境变量约定与后端 API 对接方式
