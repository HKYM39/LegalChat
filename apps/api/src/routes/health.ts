/**
 * 健康检查路由
 * 
 * 职责：提供系统的运行状态监控，验证数据库、AI 服务等核心组件的连通性。
 * 符合 PRD 4.1 章节定义的 /health 接口要求。
 */
import { Hono } from "hono";

import type { ServiceContainer } from "../services/container";

/**
 * 创建健康检查路由实例
 * 
 * @param services 服务容器，包含获取健康状态的方法
 */
export function createHealthRoute(services: ServiceContainer) {
  const route = new Hono();

  /**
   * GET /health
   * 返回系统当前状态
   */
  route.get("/", async (c) => {
    // 调用服务容器获取各组件健康详情
    const response = await services.getHealth();
    
    // 如果状态为 ok，返回 200，否则返回 503 (Service Unavailable)
    return c.json(response, response.status === "ok" ? 200 : 503);
  });

  return route;
}
