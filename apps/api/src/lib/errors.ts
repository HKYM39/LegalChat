/**
 * 业务错误定义与处理
 * 
 * 职责：
 * 1. 定义统一的业务异常类 AppError。
 * 2. 提供将普通错误（Error）或未知错误转换为 AppError 的工具函数。
 * 3. 确保所有 API 异常都具有一致的 HTTP 状态码、错误码和提示信息。
 */

/**
 * 应用级自定义错误类
 */
export class AppError extends Error {
  // HTTP 响应状态码
  status: number;
  // 业务识别码 (如: 'invalid_query', 'rate_limit_exceeded')
  code: string;
  // 可选的详细错误信息或调试数据
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * 判断一个对象是否具备 AppError 的特征
 */
function isAppErrorLike(error: unknown): error is AppError {
  if (!(error instanceof Error) || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return (
    typeof record.status === "number" &&
    typeof record.code === "string" &&
    typeof error.message === "string"
  );
}

/**
 * 将任意错误对象转换为 AppError 实例
 * 
 * 用于中间件捕获异常后的标准化输出。
 */
export function toAppError(error: unknown): AppError {
  // 如果已经是 AppError 风格的对象，则重新包装为实例
  if (isAppErrorLike(error)) {
    return new AppError(error.status, error.code, error.message, error.details);
  }

  // 如果是标准的 Error 对象，封装为 500 内部错误
  if (error instanceof Error) {
    return new AppError(500, "internal_error", error.message);
  }

  // 其他未知类型的错误
  return new AppError(500, "internal_error", "Unexpected error");
}
