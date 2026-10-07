import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const SECONDS_PER_DAY = 24 * 60 * 60;
const IMMUTABLE_PUBLIC_CACHE_DIRECTIVE = `public, max-age=${SECONDS_PER_DAY}, immutable`;
const REVALIDATED_PUBLIC_CACHE_DIRECTIVE = 'public, no-cache';

/**
 * Set a cache directive only when the eventual handler response succeeds.
 *
 * @param res - Express response whose send method is wrapped
 * @param next - Callback that advances to the route handler
 * @param directive - Cache-Control value for successful responses
 * @returns Nothing
 */
function setCacheControlOnSuccess(res: Response, next: NextFunction, directive: string): void {
  const send = res.send.bind(res);
  res.send = ((body?: unknown) => {
    if (res.statusCode >= StatusCodes.OK && res.statusCode < StatusCodes.MULTIPLE_CHOICES) {
      res.set('Cache-Control', directive);
    }
    return send(body);
  }) as Response['send'];
  next();
}

/**
 * Cache immutable public resources for one day on successful responses.
 *
 * @param _req - Express request (unused)
 * @param res - Express response
 * @param next - Callback that advances to the route handler
 * @returns Nothing
 */
export function ImmutablePublicCacheControlMiddleware(_req: Request, res: Response, next: NextFunction): void {
  setCacheControlOnSuccess(res, next, IMMUTABLE_PUBLIC_CACHE_DIRECTIVE);
}

/**
 * Store mutable public resources only when caches revalidate before reuse.
 *
 * @param _req - Express request (unused)
 * @param res - Express response
 * @param next - Callback that advances to the route handler
 * @returns Nothing
 */
export function RevalidatedPublicCacheControlMiddleware(_req: Request, res: Response, next: NextFunction): void {
  setCacheControlOnSuccess(res, next, REVALIDATED_PUBLIC_CACHE_DIRECTIVE);
}
