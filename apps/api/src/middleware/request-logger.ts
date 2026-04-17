/**
 * 请求日志记录器中间件
 * 
 * 职责：
 * 1. 记录请求处理的开始与结束时间。
 * 2. 计算并统计请求处理的总耗时 (Latency)。
 * 3. 在响应头中注入耗时信息，便于性能监控。
 */
import type { Context, Next } from "hono";

/**
 * 请求日志处理器
 * 
 * @param c Hono 上下文
 * @param next 下一个中间件或路由处理器
 */
export async function requestLogger(c: Context, next: Next) {
  const startedAt = Date.now();
  
  // 执行后续的中间件或业务逻辑
  await next();
  
  // 计算耗时（毫秒）
  const durationMs = Date.now() - startedAt;
  
  // 将耗时信息写入响应头 x-request-latency-ms
  c.header("x-request-latency-ms", String(durationMs));
}
