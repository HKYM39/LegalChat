import { Hono } from "hono";

import { loadConfig } from "./lib/config";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import { createAskRoute } from "./routes/ask";
import { createDocumentsRoute } from "./routes/documents";
import { createHealthRoute } from "./routes/health";
import { createSearchRoute } from "./routes/search";
import { createServices, type ServiceContainer } from "./services/container";

export function createApp(services?: ServiceContainer) {
  const app = new Hono();
  const resolvedServices = services ?? createServices(loadConfig());

  app.use("*", errorHandler);
  app.use("*", requestLogger);

  app.get("/", (c) =>
    c.json({
      ok: true,
      service: "legalchat-api",
    }),
  );
  app.route("/health", createHealthRoute(resolvedServices));
  app.route("/search", createSearchRoute(resolvedServices));
  app.route("/ask", createAskRoute(resolvedServices));
  app.route("/documents", createDocumentsRoute(resolvedServices));

  return app;
}
