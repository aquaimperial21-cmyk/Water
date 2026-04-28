import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: unknown) {
    super(message);
  }
}

export const NotFound = (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg);
export const Unauthorized = (msg = 'Unauthorized') => new HttpError(401, 'UNAUTHORIZED', msg);
export const Forbidden = (msg = 'Forbidden') => new HttpError(403, 'FORBIDDEN', msg);
export const BadRequest = (msg = 'Bad request', fields?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', msg, fields);
export const Conflict = (msg = 'Conflict') => new HttpError(409, 'CONFLICT', msg);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', fields: err.flatten().fieldErrors },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
  }
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: (err as Error)?.message ?? 'Internal server error' },
  });
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
