import { Hono } from "hono";
import { parseSearchFromUrl } from "../../../../packages/shared/src/index.ts";

import { AppError } from "../lib/errors";
import type { ServiceContainer } from "../services/container";

export function createSearchRoute(services: ServiceContainer) {
  const route = new Hono();

  route.get("/", async (c) => {
    const input = parseSearchFromUrl(new URL(c.req.url));
    if (!input.query) {
      throw new AppError(400, "invalid_query", "`q` 不能为空。");
    }

    const response = await services.runSearch(input);
    return c.json(response);
  });

  return route;
}
