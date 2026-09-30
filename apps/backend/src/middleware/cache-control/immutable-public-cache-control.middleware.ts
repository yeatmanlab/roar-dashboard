import type { NextFunction, Request, Response } from 'express';

function setCacheControlOnSuccess(res: Response, next: NextFunction, directive: string): void {
  const send = res.send.bind(res);
  res.send = ((body?: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      res.set('Cache-Control', directive);
    }
    return send(body);
  }) as Response['send'];
  next();
}

/** Cache immutable public resources in browsers and shared caches for one day on successful responses only. */
export function ImmutablePublicCacheControlMiddleware(_req: Request, res: Response, next: NextFunction) {
  setCacheControlOnSuccess(res, next, 'public, max-age=86400, immutable');
}

/** Allow mutable public resources to be stored only when caches revalidate before reuse. */
export function RevalidatedPublicCacheControlMiddleware(_req: Request, res: Response, next: NextFunction) {
  setCacheControlOnSuccess(res, next, 'public, no-cache');
}
