import { Hono } from "hono";

import type { ServiceContainer } from "../services/container";

export function createDocumentsRoute(services: ServiceContainer) {
  const route = new Hono();

  route.get("/:documentId", async (c) => {
    const response = await services.getDocument(c.req.param("documentId"));
    return c.json(response);
  });

  route.get("/:documentId/paragraphs", async (c) => {
    const response = await services.getDocumentParagraphs(
      c.req.param("documentId"),
    );
    return c.json(response);
  });

  return route;
}
