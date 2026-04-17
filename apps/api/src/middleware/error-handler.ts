/**
 * 全局错误处理中间件
 * 
 * 职责：
 * 1. 捕获应用运行过程中抛出的所有异常。
 * 2. 将异常转换为统一的 AppError 格式。
 * 3. 返回符合 API 规范的结构化 JSON 错误响应。
 */
import type { Context } from "hono";

import { toAppError } from "../lib/errors";

/**
 * 错误处理处理器
 * 
 * @param error 捕获到的错误对象
 * @param c Hono 上下文
 */
export function errorHandler(error: unknown, c: Context) {
  // 将原始错误规范化为应用定义的 AppError
  const appError = toAppError(error);
  
  // 返回 JSON 格式的错误详情与对应的 HTTP 状态码
  return c.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
      },
    },
    // 强制类型转换为 Hono 支持的错误状态码
    appError.status as 400 | 401 | 403 | 404 | 422 | 429 | 500 | 503,
  );
}
