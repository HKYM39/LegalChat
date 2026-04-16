import type { Context, Next } from "hono";

export async function requestLogger(c: Context, next: Next) {
  const startedAt = Date.now();
  await next();
  const durationMs = Date.now() - startedAt;
  c.header("x-request-latency-ms", String(durationMs));
}
