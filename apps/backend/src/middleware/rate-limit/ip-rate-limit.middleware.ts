import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface IpRateLimitOptions {
  windowMs: number;
  maxRequests: number;
  maxTrackedIps?: number;
  now?: () => number;
}

const DEFAULT_MAX_TRACKED_IPS = 10_000;

/**
 * Creates a fixed-window per-IP limiter for small public endpoint surfaces.
 * State is process-local and memory-bounded; deployments with many replicas should
 * replace this with a shared store if globally consistent limits become necessary.
 */
export function createIpRateLimitMiddleware({
  windowMs,
  maxRequests,
  maxTrackedIps = DEFAULT_MAX_TRACKED_IPS,
  now = Date.now,
}: IpRateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const currentTime = now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = entries.get(ip);

    if (!entry || entry.resetAt <= currentTime) {
      if (!entry && entries.size >= maxTrackedIps) {
        const oldestIp = entries.keys().next().value;
        if (oldestIp !== undefined) entries.delete(oldestIp);
      }
      entry = { count: 0, resetAt: currentTime + windowMs };
      entries.set(ip, entry);
    }

    const remaining = Math.max(0, maxRequests - entry.count - 1);
    res.set('RateLimit-Limit', String(maxRequests));
    res.set('RateLimit-Remaining', String(remaining));
    res.set('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count >= maxRequests) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000))));
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        error: {
          message: ApiErrorMessage.RATE_LIMITED,
          code: ApiErrorCode.RATE_LIMITED,
        },
      });
      return;
    }

    entry.count += 1;
    next();
  };
}
