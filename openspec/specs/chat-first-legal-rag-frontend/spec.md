# chat-first-legal-rag-frontend Specification

## Purpose
TBD - created by archiving change build-chat-first-legal-rag-frontend. Update Purpose after archive.
## Requirements
### Requirement: 前端必须提供 chat-first 的主聊天页
系统 MUST 提供一个以对话为主的首页，作为法律研究助手的主入口，并在空状态下展示品牌信息、能力说明、suggested prompts 与底部输入框，而不是传统搜索工作台或后台式首页。

#### Scenario: 首次进入主聊天页
- **WHEN** 用户访问首页且当前尚无对话消息
- **THEN** 系统展示居中的欢迎区、suggested prompts、简短说明文本和固定在底部的提问输入框

#### Scenario: 进入已有对话状态
- **WHEN** 用户已经发送问题或系统已经返回回答
- **THEN** 系统将首页切换为可持续阅读的对话线程布局，并保留底部输入框继续提问

### Requirement: 前端必须渲染结构化 assistant message
系统 MUST 将 `/ask` 返回的结构化回答渲染为 assistant message，并在同一消息单元中展示 `answerText`、`authorities`、`supportingExcerpts` 与 `limitations`，保证回答与证据不分离。

#### Scenario: 问答接口返回 grounded answer
- **WHEN** 前端成功收到 `/ask` 的结构化响应
- **THEN** 系统在对话线程中新增一条 assistant message，并渲染回答正文、authority 区块、supporting excerpts 区块和 limitations 区块

#### Scenario: 问答接口返回保守回答
- **WHEN** `/ask` 响应中包含 limitations 或缺少足够 authority
- **THEN** 系统仍以 assistant message 形式展示回答，并明确标注限制说明而不伪装为完整结论

### Requirement: 前端必须支持用户消息与加载状态
系统 MUST 在对话线程中渲染用户提问、发送中状态与错误状态，使用户能够清楚感知问题已提交、回答正在生成或请求失败。

#### Scenario: 用户提交新问题
- **WHEN** 用户在 composer 中输入问题并提交
- **THEN** 系统立即将该问题以 user message 渲染到对话线程中，并显示 assistant 生成中的加载状态

#### Scenario: 问答请求失败
- **WHEN** `/ask` 请求失败或返回不可用错误
- **THEN** 系统保留用户消息，并在界面上显示可识别的错误提示而不是静默失败

### Requirement: 前端必须提供 authority 与 evidence 交互
系统 MUST 在 assistant message 中展示 authority cards 与 supporting excerpts，使用户能够直接查看标题、citation、法院、日期、段落范围与证据摘录，并触发进一步核验。

#### Scenario: 查看 authority 卡片
- **WHEN** assistant message 包含 authority 列表
- **THEN** 系统为每条 authority 渲染独立卡片，至少展示标题、neutral citation、court、jurisdiction 与 paragraph refs

#### Scenario: 查看 supporting excerpts
- **WHEN** assistant message 包含 supporting excerpts
- **THEN** 系统以消息内 evidence section 或折叠块展示 excerpt 文本、来源标签与 traceability 信息

### Requirement: 前端必须支持案件详情页核验流程
系统 MUST 提供案件详情页，用于展示被引用案件的 metadata、summary 与 paragraph-by-paragraph 阅读视图，并支持从聊天中的 authority 跳转进入。

#### Scenario: 从 authority 进入案件详情页
- **WHEN** 用户点击 assistant message 中的 authority card
- **THEN** 系统导航到对应的案件详情页并加载该案件的 metadata 与段落内容

#### Scenario: 在案件详情页查看段落原文
- **WHEN** 案件详情页完成加载
- **THEN** 系统展示标题、citation、court、jurisdiction、decision date、summary 与带编号的段落列表

### Requirement: 前端必须管理聊天与文档状态
系统 MUST 使用前端状态层统一管理当前输入、消息列表、问答加载态、文档详情、段落列表与错误信息，避免状态散落在多个页面组件中。

#### Scenario: 管理聊天主路径状态
- **WHEN** 用户进行提问、等待回答或重新提问
- **THEN** 系统通过统一聊天状态保存输入值、消息数组、加载态与错误态

#### Scenario: 管理案件详情状态
- **WHEN** 用户进入或切换案件详情页
- **THEN** 系统通过统一文档状态保存当前文档、段落列表、加载态与错误态

### Requirement: 前端必须通过类型化 API client 对接后端
系统 MUST 通过统一的类型化 API client 对接 `/health`、`/ask`、`/search`、`/documents/:id` 与 `/documents/:id/paragraphs`，并将数据转换为页面组件可直接消费的结构。

#### Scenario: 发送问答请求
- **WHEN** 聊天页提交问题
- **THEN** 系统通过统一 API client 调用 `/ask` 并将响应映射到消息渲染结构

#### Scenario: 加载案件详情
- **WHEN** 用户进入案件详情页
- **THEN** 系统通过统一 API client 依次获取案件 metadata 与段落列表，并在页面中渲染

### Requirement: 前端视觉必须符合 AI-native 法律研究产品定位
系统 MUST 采用轻品牌、留白充分、消息优先的视觉结构，保证界面首先传达“可以直接提问”和“回答可验证”，而不是默认模板样式或后台式密集信息面板。

#### Scenario: 呈现空状态首屏
- **WHEN** 首页在无消息状态下渲染
- **THEN** 系统展示与视觉稿一致的轻量品牌区、中央聚焦欢迎模块、简洁 prompt 卡片与底部主输入框

#### Scenario: 呈现对话阅读态
- **WHEN** 首页切换到有消息状态
- **THEN** 系统保持窄列阅读宽度、清晰的 user 与 assistant 区分，并避免将回答渲染成 dashboard 卡片墙
