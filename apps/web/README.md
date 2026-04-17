# CaseBase AI Web

`apps/web` 是法律案例研究助手的前端应用，基于 Next.js App Router 构建，承载 chat-first 对话页和案件详情核验页。

## 页面范围

- `/`
  对话式法律研究主页面，展示空状态欢迎区、suggested prompts、用户消息、assistant 回答、authority cards、supporting excerpts 与 limitations。
- `/documents/[documentId]`
  案件详情与段落阅读页面，用于从聊天引用跳转后核验 canonical metadata 与原文段落。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Material UI
- Zustand
- `shared` workspace 类型契约

## 环境变量

复制 `.env.example` 到 `.env.local`：

```bash
cp apps/web/.env.example apps/web/.env.local
```

可用变量：

- `API_BASE_URL`
  Next.js 服务器转发到 Hono API 的基础地址。未配置时，开发环境会自动探测 `http://127.0.0.1:8787-8795` 中可用的 Wrangler 端口。
- `NEXT_PUBLIC_CHAT_RATE_LIMIT_PER_MINUTE`
  前端本地预检查使用的分钟级聊天额度，默认 `10`
- `NEXT_PUBLIC_CHAT_RATE_LIMIT_PER_DAY`
  前端本地预检查使用的天级聊天额度，默认 `100`

## 本地运行

在仓库根目录执行：

```bash
pnpm --filter web dev
```

默认会启动在 `http://localhost:3000`。

如果同时需要联调后端：

```bash
pnpm --filter api dev
pnpm --filter web dev
```

## 校验命令

```bash
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test
```

## API 对接

前端直接消费以下接口：

- `GET /health`
- `GET /search`
- `POST /ask`
- `GET /documents/:documentId`
- `GET /documents/:documentId/paragraphs`

其中 `/ask` 是主交互入口，authority card 点击后会跳转到 `/documents/[documentId]` 并尝试根据段落范围定位引用内容。

为避免浏览器跨域和 Wrangler 端口漂移问题，前端通过 Next.js 同源 `/api/*` 代理转发到后端。

前端会基于本地持久化的匿名 `conversationId` 执行聊天额度预检查；真实限流仍以后端 `/ask` 返回的 `429` 结果为准。

## 输入安全预检

聊天输入在提交 `/ask` 前会先执行本地输入安全预检，规则与后端 `/ask` 入口保持一致，均来自 `packages/shared` 的共享判定器。

当前会拦截：

- 空白输入
- 超过 `4000` 字符的输入
- 含异常控制字符的输入
- 明显 XSS / 脚本注入片段
- 明显协议探测原始请求片段
- 明显 SQL / 模板 / 路径探测片段

本地命中时不会发起后端请求；如果用户绕过前端直接调用接口，后端仍会返回同一套结构化错误语义。界面会将本地预检和服务端兜底统一展示为安全提示，而不是普通“请求失败”。

可用以下命令验证：

```bash
pnpm --filter web typecheck
pnpm --filter web test
cd packages/shared && node --import tsx src/input-security.test.ts
```
