import { Hono } from "hono";
import { parseAskBody } from "../../../../packages/shared/src/index.ts";

import type { ServiceContainer } from "../services/container";

export function createAskRoute(services: ServiceContainer) {
  const route = new Hono();

  route.post("/", async (c) => {
    const body = await c.req.json();
    const input = parseAskBody(body);
    const response = await services.runAsk(input);
    return c.json(response);
  });

  return route;
}
