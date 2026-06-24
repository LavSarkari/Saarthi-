import { Response } from "express";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, code = "INTERNAL_ERROR", statusCode = 500, details?: any) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Centrally logs any server-side or API failures in a secure, non-sensitive manner.
 */
export function logError(err: any, context?: string): void {
  const timestamp = new Date().toISOString();
  const ctx = context ? `[${context}]` : "[Server]";
  const errorMessage = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`${timestamp} ${ctx} Error: ${errorMessage}`);
}

/**
 * Standardizes successful API responses.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const responsePayload: ApiResponse<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(responsePayload);
}

/**
 * Standardizes API error responses.
 */
export function sendError(res: Response, err: any): Response {
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred.";
  let details: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof Error) {
    message = err.message;
  }

  // Ensure secrets or internal code traces aren't propagated, but log them locally
  logError(err, "API_ROUTE");

  const responsePayload: ApiResponse<null> = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return res.status(statusCode).json(responsePayload);
}
