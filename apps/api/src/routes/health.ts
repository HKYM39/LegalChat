import { Hono } from "hono";

import type { ServiceContainer } from "../services/container";

export function createHealthRoute(services: ServiceContainer) {
  const route = new Hono();

  route.get("/", async (c) => {
    const response = await services.getHealth();
    return c.json(response, response.status === "ok" ? 200 : 503);
  });

  return route;
}
