import type { NextFunction, Request, Response } from 'express';

/** Cache immutable public resources in browsers and shared caches for one day. */
export function ImmutablePublicCacheControlMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  next();
}
