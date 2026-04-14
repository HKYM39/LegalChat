1. ## 1. 项目名称

   Legal Casebase AI Assistant MVP

   中文定位：法律案例智能研究助手 MVP

   ------

   ## 2. 项目目标

   构建一个以对话为主、以检索为核心、以证据为支撑的法律研究系统，使用户能够像使用 ChatGPT 或 Gemini 一样，通过自然语言提问获得法律案例分析结果，同时看到真实案例引用、段落依据和 supporting excerpts。

   系统不是通用聊天机器人，也不是传统案例检索门户。
    它是一个 retrieval-first、citation-grounded 的 legal AI assistant。

   ------

   ## 3. 产品定位

   这是一个 AI-native 的法律研究产品，核心体验是：

   - 用户输入法律问题
   - 系统执行 hybrid retrieval
   - LLM 只基于检索结果生成回答
   - 每轮 assistant message 都附带 authority 和引用依据
   - 用户可跳转到案例详情页查看原文段落

   产品整体体验参考：

   - ChatGPT
   - Gemini
   - Claude

   但内容组织方式偏法律研究，不偏通用对话。

   ------

   ## 4. 核心用户问题

   用户在法律研究中通常有这些问题：

   第一，传统法律搜索工具要求用户自己反复筛选案例，研究效率低。
    第二，纯语义搜索容易遗漏 citation、doctrine、法条编号等精确信息。
    第三，通用 AI 回答看似流畅，但无法验证来源。
    第四，很多工具给答案不给证据，用户难以信任。

   本项目的核心目标就是同时解决：

   - 找得到
   - 找得准
   - 答得出
   - 能验证

   ------

   ## 5. 核心能力

   ### 5.1 对话式法律研究

   用户通过聊天方式提出问题，而不是必须先进入复杂搜索工作台。

   ### 5.2 混合检索

   系统同时使用：

   - PostgreSQL 词法检索 / metadata filtering
   - Pinecone 向量检索

   ### 5.3 基于证据的回答

   LLM 只能基于 retrieved evidence 生成结果，不能自由编造 authority。

   ### 5.4 引用可追溯

   每个回答尽可能映射回：

   - document_id
   - chunk_id
   - paragraph range

   ### 5.5 案例详情核验

   用户点击引用后可查看完整案件信息与段落原文。

   ------

   ## 6. MVP 范围

   ### 范围内

   - 法律案例语料的离线导入
   - PDF 到结构化 JSON 的离线处理
   - chunk / embedding / Pinecone upsert
   - chat-first 前端
   - `/ask`
   - `/search`
   - `/documents/:id`
   - `/documents/:id/paragraphs`
   - authority cards
   - supporting excerpts
   - citation / paragraph refs
   - query / answer logging

   ### 范围外

   - 用户鉴权
   - 用户上传文档
   - 邮件系统
   - 支付系统
   - 管理后台
   - 多租户
   - 在线 ingestion
   - Python 在线 API
   - 复杂 agent workflow
   - OCR-first 超复杂解析流程

   ------

   ## 7. 核心系统原则

   ### 7.1 Retrieval-first

   先检索 authority，再调用模型生成。

   ### 7.2 Authority-grounded

   回答必须基于真实案例与片段，不允许无来源结论。

   ### 7.3 Hybrid retrieval

   法律场景不能仅靠向量检索，必须结合 lexical + semantic。

   ### 7.4 Chat-first UX

   主页面是聊天界面，而不是 dashboard / search console。

   ### 7.5 Traceability

   从 assistant message 应该能回到原始 chunk 和 paragraph。

   ### 7.6 Conservative generation

   证据不足时必须保守表达，而不是生成貌似合理的结论。

   ------

   ## 8. 技术架构概览

   ### 前端

   - Next.js 15
   - React 19
   - Tailwind CSS
   - MUI
   - Zustand

   ### 后端

   - Hono
   - TypeScript
   - Zod
   - Drizzle
   - PostgreSQL

   ### AI / RAG

   - TypeScript pipeline
   - Pinecone
   - OpenAI / Gemini / Claude / OpenRouter 其中一个为主

   ### Python

   - 仅做 PDF 处理和离线文档标准化

   ### Monorepo

   - pnpm workspace

   ------

   ## 9. 系统数据流

   ### 9.1 离线流程

   1. 原始 PDF 输入
   2. Python 提取文本与结构
   3. 输出标准化 JSON
   4. TypeScript 读取 JSON
   5. 执行 chunking
   6. 生成 embeddings
   7. 写入 PostgreSQL
   8. upsert Pinecone

   ### 9.2 在线流程

   1. 用户在聊天输入问题
   2. Hono 接收 query
   3. 执行 query classification
   4. PostgreSQL lexical retrieval
   5. Pinecone dense retrieval
   6. merge + rerank
   7. 选取 top evidence
   8. 调用 LLM
   9. 返回 assistant message + authorities + excerpts
   10. 用户点击引用进入案例详情页

   ------

   ## 10. 项目目录结构

   ```
   
   legal-casebase-mvp/
   ├── apps/
   │   ├── web/
   │   └── api/
   ├── packages/
   │   ├── db/
   │   ├── ai/
   │   ├── shared/
   │   └── config/
   ├── tools/
   │   └── pdf-processing/
   ├── infra/
   │   └── docker-compose.yml
   ├── specs/
   ├── skills/
   ├── scripts/
   ├── AGENTS.md
   ├── package.json
   └── pnpm-workspace.yaml
   ```

   ------

   ## 11. 成功标准

   MVP 成功的标准是：

   - 用户可以通过对话完成法律研究
   - 回答可以引用真实 authority
   - 用户能看到 supporting excerpts
   - 用户能跳转并核验段落原文
   - 系统端到端可运行
   - 在线后端完全基于 Hono + TypeScript
   - Python 只承担 PDF 处理职责
