import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import ipaddr from 'ipaddr.js';
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
  if (maxTrackedIps < 1) throw new RangeError('maxTrackedIps must be at least 1');

  const entries = new Map<string, RateLimitEntry>();
  let nextSweepAt = Number.NEGATIVE_INFINITY;

  return (req: Request, res: Response, next: NextFunction): void => {
    const currentTime = now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = getRateLimitKey(ip);
    let entry = entries.get(key);

    if (entry && entry.resetAt <= currentTime) {
      entries.delete(key);
      entry = undefined;
    }

    if (!entry) {
      // Bound the O(n) cleanup to once per limiter window. New addresses can still
      // enter a full map: the least-recently-used bucket is evicted below instead
      // of failing closed and allowing address rotation to deny every new client.
      if (currentTime >= nextSweepAt) {
        for (const [trackedKey, trackedEntry] of entries) {
          if (trackedEntry.resetAt <= currentTime) entries.delete(trackedKey);
        }
        nextSweepAt = currentTime + windowMs;
      }

      if (entries.size >= maxTrackedIps) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey !== undefined) entries.delete(oldestKey);
      }

      entry = { count: 0, resetAt: currentTime + windowMs };
      entries.set(key, entry);
    } else {
      // Map insertion order doubles as a bounded LRU queue.
      entries.delete(key);
      entries.set(key, entry);
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

/** Collapse IPv6 clients to /64 while preserving one bucket per IPv4 address. */
function getRateLimitKey(ip: string): string {
  if (!ipaddr.isValid(ip)) return `unknown:${ip}`;

  const address = ipaddr.process(ip);
  if (address.kind() === 'ipv4') return `ipv4:${address.toString()}`;

  const prefix = address
    .toByteArray()
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `ipv6:${prefix}/64`;
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
