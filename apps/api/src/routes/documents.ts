/**
 * 法律文档/案件路由
 * 
 * 职责：
 * 1. 获取特定法律文档（案件）的元数据。
 * 2. 获取文档的结构化段落列表，用于详情展示。
 * 
 * 符合 PRD 4.4 和 4.5 章节定义的 /documents 接口要求。
 */
import { Hono } from "hono";

import type { ServiceContainer } from "../services/container";

/**
 * 创建文档路由实例
 * 
 * @param services 服务容器，提供数据库查询相关的服务
 */
export function createDocumentsRoute(services: ServiceContainer) {
  const route = new Hono();

  /**
   * GET /documents/:documentId
   * 获取案件详情（元数据、摘要、源链接等）
   */
  route.get("/:documentId", async (c) => {
    const response = await services.getDocument(c.req.param("documentId"));
    return c.json(response);
  });

  /**
   * GET /documents/:documentId/paragraphs
   * 获取案件的段落列表
   */
  route.get("/:documentId/paragraphs", async (c) => {
    const response = await services.getDocumentParagraphs(
      c.req.param("documentId"),
    );
    return c.json(response);
  });

  return route;
}
