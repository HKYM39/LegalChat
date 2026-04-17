/**
 * 主对话 RAG 路由
 * 
 * 职责：
 * 1. 接收用户的自然语言提问。
 * 2. 解析并验证请求参数。
 * 3. 协调 RAG (Retrieval-Augmented Generation) 流程。
 * 4. 生成基于法律事实的回答 (Grounded Answer)。
 * 
 * 符合 PRD 4.3 章节定义的 /ask 接口要求。
 */
import { Hono } from "hono";
import { parseAskBody } from "../../../../packages/shared/src/index.ts";

import { resolveChatRateLimitSubject } from "../lib/chat-rate-limit";
import type { ServiceContainer } from "../services/container";

/**
 * 创建对话路由实例
 * 
 * @param services 服务容器，提供 RAG 核心逻辑实现
 */
export function createAskRoute(services: ServiceContainer) {
  const route = new Hono();

  /**
   * POST /ask
   * 主对话接口，支持流式或一次性返回回答
   */
  route.post("/", async (c) => {
    // 获取原始 JSON 请求体
    const body = await c.req.json();
    
    // 解析并验证请求体 (使用共享的 Zod Schema)
    const input = parseAskBody(body);
    
    // 执行对话逻辑，并注入速率限制标识
    const response = await services.runAsk(input, {
      rateLimitSubject: resolveChatRateLimitSubject({
        conversationId: input.conversationId,
        forwardedFor: c.req.header("x-forwarded-for"),
        cfConnectingIp: c.req.header("cf-connecting-ip"),
      }),
    });
    
    // 返回生成的回答及引用的法律依据
    return c.json(response);
  });

  return route;
}
