/**
 * Hono API 应用主入口
 * 
 * 负责初始化路由、注入依赖、配置全局中间件（错误处理、日志等）。
 */
import { Hono } from "hono";

import { loadConfig } from "./lib/config";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import { createAskRoute } from "./routes/ask";
import { createDocumentsRoute } from "./routes/documents";
import { createHealthRoute } from "./routes/health";
import { createSearchRoute } from "./routes/search";
import { createServices, type ServiceContainer } from "./services/container";

/**
 * 创建 Hono 应用实例
 * 
 * @param services 可选的外部服务容器 (用于测试注入)
 */
export function createApp(services?: ServiceContainer) {
  const app = new Hono();
  
  // 初始化服务（如数据库连接、AI 模型客户端等）
  const resolvedServices = services ?? createServices(loadConfig());

  // 注册全局错误处理中间件
  app.onError(errorHandler);
  
  // 注册请求日志记录器
  app.use("*", requestLogger);

  // 基础根路由
  app.get("/", (c) =>
    c.json({
      ok: true,
      service: "legalchat-api",
    }),
  );

  // 注册健康检查路由
  app.route("/health", createHealthRoute(resolvedServices));
  
  // 注册混合检索路由 (Lexical + Semantic Search)
  app.route("/search", createSearchRoute(resolvedServices));
  
  // 注册主对话 RAG 路由 (Grounded Answer Synthesis)
  app.route("/ask", createAskRoute(resolvedServices));
  
  // 注册法律文档/案件详情路由
  app.route("/documents", createDocumentsRoute(resolvedServices));

  return app;
}

