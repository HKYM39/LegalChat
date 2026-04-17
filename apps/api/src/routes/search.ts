/**
 * 法律检索路由
 * 
 * 职责：
 * 1. 提供全文搜索与关键词搜索。
 * 2. 支持按法院、管辖权、日期等元数据进行过滤。
 * 3. 协调词法检索 (Lexical) 与向量检索 (Vector) 的混合搜索。
 * 
 * 符合 PRD 4.2 章节定义的 /search 接口要求。
 */
import { Hono } from "hono";
import { parseSearchFromUrl } from "../../../../packages/shared/src/index.ts";

import { AppError } from "../lib/errors";
import type { ServiceContainer } from "../services/container";

/**
 * 创建搜索路由实例
 * 
 * @param services 服务容器，提供混合搜索服务的具体实现
 */
export function createSearchRoute(services: ServiceContainer) {
  const route = new Hono();

  /**
   * GET /search
   * 执行综合法律检索
   */
  route.get("/", async (c) => {
    // 从 URL 查询字符串解析搜索参数
    const input = parseSearchFromUrl(new URL(c.req.url));
    
    // 校验查询关键词是否为空
    if (!input.query) {
      throw new AppError(400, "invalid_query", "`q` 不能为空。");
    }

    // 调用搜索服务执行混合检索逻辑
    const response = await services.runSearch(input);
    
    // 返回结构化搜索结果，包含匹配片段与元数据
    return c.json(response);
  });

  return route;
}
