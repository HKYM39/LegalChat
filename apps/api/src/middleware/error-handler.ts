import type { Context, Next } from "hono";

import { AppError, toAppError } from "../lib/errors";

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const appError = toAppError(error);
    const status = appError instanceof AppError ? appError.status : 500;
    return c.json(
      {
        error: {
          code: appError.code,
          message: appError.message,
          details: appError.details,
        },
      },
      status as 400 | 401 | 403 | 404 | 422 | 500 | 503,
    );
  }
}
