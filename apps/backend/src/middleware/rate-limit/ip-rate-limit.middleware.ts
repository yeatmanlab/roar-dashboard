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
 * State is process-local and memory-bounded, so the effective aggregate ceiling
 * scales with the number of active replicas. Replace this with a shared store
 * before treating it as a platform-wide security boundary.
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
      // Reclaim expired windows before considering the map full. Active entries
      // are never evicted: otherwise rotating source IPs could reset a limited
      // client's counter by forcing its entry out of the map.
      for (const [trackedIp, trackedEntry] of entries) {
        if (trackedEntry.resetAt <= currentTime) entries.delete(trackedIp);
      }
      entry = entries.get(ip);

      if (!entry && entries.size >= maxTrackedIps) {
        const earliestResetAt = Math.min(...[...entries.values()].map(({ resetAt }) => resetAt));
        setRateLimitHeaders(res, maxRequests, 0, earliestResetAt);
        sendRateLimitedResponse(res, earliestResetAt, currentTime);
        return;
      }

      if (!entry) {
        entry = { count: 0, resetAt: currentTime + windowMs };
        entries.set(ip, entry);
      }
    }

    const remaining = Math.max(0, maxRequests - entry.count - 1);
    setRateLimitHeaders(res, maxRequests, remaining, entry.resetAt);

    if (entry.count >= maxRequests) {
      sendRateLimitedResponse(res, entry.resetAt, currentTime);
      return;
    }

    entry.count += 1;
    next();
  };
}

function setRateLimitHeaders(res: Response, limit: number, remaining: number, resetAt: number): void {
  res.set('RateLimit-Limit', String(limit));
  res.set('RateLimit-Remaining', String(remaining));
  res.set('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

function sendRateLimitedResponse(res: Response, resetAt: number, currentTime: number): void {
  res.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - currentTime) / 1000))));
  res.status(StatusCodes.TOO_MANY_REQUESTS).json({
    error: {
      message: ApiErrorMessage.RATE_LIMITED,
      code: ApiErrorCode.RATE_LIMITED,
    },
  });
}
