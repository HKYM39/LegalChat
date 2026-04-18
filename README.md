# LegalChat

LegalChat 是一个面向法律案例检索与研究的 RAG MVP。它的核心目标不是“让模型自由回答法律问题”，而是先检索可用证据，再基于证据生成带引用的回答。

项目遵循两个基本原则：

- 检索优先：在线链路必须先做 hybrid retrieval，而不是直接让 LLM 生成结论
- 引用可追溯：回答必须能够回溯到 `document_id`、`chunk_id` 和段落范围

当前仓库已经覆盖一条完整的最小可用主链路：

- 离线阶段：从 PDF 判例抽取标准化 JSON，再生成 chunk、embedding，并写入 PostgreSQL 与 Pinecone
- 在线阶段：通过 Hono 提供搜索、问答、文档详情与段落查询接口
- 前端阶段：通过 Next.js 提供 chat-first 对话界面和案件详情核验页

## 项目定位

这个仓库是一个法律案例检索系统，而不是通用聊天机器人。LLM 在这里不是事实来源，只负责在检索结果之上组织答案。

系统强调：

- 案例检索
- 证据支撑的回答
- 保守输出
- 可核验引用
- 面向 MVP 的清晰边界

系统不覆盖：

- 登录鉴权
- 文件上传入口
- 支付与邮件系统
- 管理后台
- 多租户
- 在线实时入库流程

## 技术栈

### 前端

- Next.js 16
- React 19
- Tailwind CSS 4
- Material UI
- Zustand

### 在线服务

- Hono
- TypeScript
- Drizzle ORM
- PostgreSQL
- Pinecone
- Gemini

### 离线处理

- Python 3
- PyMuPDF
- pypdf

## 核心能力

- Hybrid retrieval：同时结合 lexical retrieval 与 vector retrieval
- 引用型回答：回答中包含 authority、supporting excerpts 和 limitations
- 文档核验：支持从聊天引用跳转到案件详情页查看原文段落
- 离线索引：将 PDF 处理结果标准化后再进行 chunk、embedding 与向量入库
- 检索日志：为搜索与问答保留结构化落库数据，便于后续分析与调试

## 仓库结构

```text
.
├── apps/
│   ├── api/                Hono 在线 API 与 TypeScript 离线索引脚本
│   └── web/                Next.js 前端
├── packages/
│   ├── ai/                 检索规划、融合与 grounded answer
│   ├── db/                 Drizzle schema、数据库访问与 repository
│   └── shared/             前后端共享类型、校验规则与契约
├── tools/
│   └── legal_importer/     Python PDF 标准化流水线
├── infra/docker/           本地 PostgreSQL 容器与初始化脚本
├── Data/Source/            原始 PDF 语料
└── tools/output/           标准化结果与中间产物
```

## 系统架构

### 离线链路

1. Python 从 `Data/Source/*.pdf` 提取文本并生成标准化 JSON
2. TypeScript 根据段落结构重建法律感知 chunk
3. 写入 PostgreSQL 文档、段落与 chunk 记录
4. 生成 embedding 并 upsert 到 Pinecone

### 在线链路

1. 用户从前端发起搜索或问答
2. Hono 执行 lexical retrieval
3. Hono 调用 embedding 与 Pinecone 执行 semantic retrieval
4. 系统融合结果并生成可追溯证据集
5. LLM 基于证据生成 grounded answer
6. 前端展示答案、引用和限制说明，并支持跳转核验

## 当前 API

- `GET /health`
- `GET /search`
- `POST /ask`
- `GET /documents/:documentId`
- `GET /documents/:documentId/paragraphs`

其中：

- `/search` 用于独立检索与结果浏览
- `/ask` 是主交互入口，会先走检索，再生成带引用的回答
- `/documents/*` 用于展示案件详情与原文段落，支持对聊天引用进行核验

## 本地启动

### 1. 安装依赖

```bash
pnpm install
```

如果要运行 Python 标准化流水线，还需要准备 Python 环境：

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r tools/requirements.txt
```

### 2. 启动 PostgreSQL

```bash
docker compose -f infra/docker/docker-compose.yaml up -d
```

### 3. 配置环境变量

复制环境变量模板：

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

至少需要为 `apps/api/.env` 配置以下关键项：

- `DATABASE_URL`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`
- `PINECONE_NAMESPACE`
- `GEMINI_API_KEY`

前端主要使用：

- `API_BASE_URL`

### 4. 启动后端与前端

分别在仓库根目录执行：

```bash
pnpm dev:api
pnpm dev:web
```

默认情况下：

- 前端运行在 `http://localhost:3000`
- 后端由 Wrangler 启动在本地端口

前端会通过同源 `/api/*` 代理转发到 Hono，避免浏览器跨域与本地端口漂移问题。

## 离线导入与索引

离线处理分成两个阶段，职责明确分离：

### 第一步：PDF 标准化

```bash
python3 -m tools.legal_importer
```

这个阶段负责：

- 读取 `Data/Source/*.pdf`
- 提取文本与段落
- 生成标准化 JSON 到 `tools/output/normalized/`

### 第二步：TypeScript 离线索引

```bash
pnpm --filter api offline:index
```

这个阶段负责：

- 从标准化 JSON 重建 chunk
- 写入 PostgreSQL
- 生成 embedding
- upsert Pinecone 向量

常用命令：

```bash
pnpm --filter api offline:index -- --limit 1 --verbose
pnpm --filter api offline:index -- --document-id <document-id> --only-missing-vectors
pnpm --filter api offline:index -- --document-id <document-id> --skip-pinecone
pnpm --filter api offline:index -- --document-id <document-id> --force-reembed
```

## 校验命令

```bash
pnpm typecheck
pnpm lint
pnpm test
```

也可以分别执行：

```bash
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test
```

## 设计约束

这个项目的设计约束比较明确：

- Hono 是唯一在线后端服务
- 检索模型必须采用 hybrid retrieval，而不是 vector-only
- 回答必须基于检索证据，不能把 LLM 当成权威来源
- 证据必须能追溯到文档、chunk 和段落范围
- 如果证据不足，系统应返回保守答案并明确 limitations

## 子目录说明

- [apps/api/README.md](/home/hkym/code/LegalChat/apps/api/README.md)
  在线 API、离线索引脚本、接口与测试说明
- [apps/web/README.md](/home/hkym/code/LegalChat/apps/web/README.md)
  前端页面、运行方式与代理机制说明
- [tools/README.md](/home/hkym/code/LegalChat/tools/README.md)
  Python 标准化流水线说明

## 当前状态

当前仓库已经具备可运行的法律案例 RAG MVP 主链路，但仍然是 MVP：

- 已经具备离线处理、索引、检索、问答和引用核验页面
- 已经具备基础输入安全校验与聊天限流
- 仍有继续完善检索质量、索引策略和引用校验的空间

如果你是第一次进入这个仓库，建议顺序是：

1. 先看本 README，理解系统边界与运行方式
2. 再看 `apps/api/README.md` 与 `apps/web/README.md`
3. 最后根据需要进入具体代码目录
