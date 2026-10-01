import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import ipaddr from 'ipaddr.js';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { formatApiError } from '../../utils/format-api-error.util';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
}

interface IpRateLimitOptions extends RateLimitOptions {
  maxTrackedIps?: number;
}

interface EmailRateLimitOptions extends RateLimitOptions {
  maxTrackedEmails?: number;
}

const DEFAULT_MAX_TRACKED_IPS = 10_000;

/**
 * Creates a fixed-window per-IP limiter for small public endpoint surfaces.
 * State is process-local and memory-bounded, so the effective aggregate ceiling
 * scales with the number of active replicas. Replace this with a shared store
 * before treating it as a platform-wide security boundary.
 *
 * @param options - Fixed-window duration, request ceiling, storage bound, and optional clock
 * @returns Express middleware that rate-limits normalized IP buckets
 */
export function createIpRateLimitMiddleware({
  windowMs,
  maxRequests,
  maxTrackedIps = DEFAULT_MAX_TRACKED_IPS,
  now = Date.now,
}: IpRateLimitOptions): RequestHandler {
  return createKeyedRateLimitMiddleware({
    windowMs,
    maxRequests,
    maxTrackedKeys: maxTrackedIps,
    now,
    getKey: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return getRateLimitIpKey(ip);
    },
  });
}

/**
 * Creates a normalized per-email limiter for the parsed public registration body.
 *
 * @param options - Fixed-window duration, request ceiling, storage bound, and optional clock
 * @returns Express middleware that rate-limits normalized email buckets
 */
export function createEmailRateLimitMiddleware({
  windowMs,
  maxRequests,
  maxTrackedEmails = DEFAULT_MAX_TRACKED_IPS,
  now = Date.now,
}: EmailRateLimitOptions): RequestHandler {
  return createKeyedRateLimitMiddleware({
    windowMs,
    maxRequests,
    maxTrackedKeys: maxTrackedEmails,
    now,
    getKey: (req) => {
      const email = (req.body as { email?: unknown } | undefined)?.email;
      return typeof email === 'string' ? `email:${email.trim().toLowerCase()}` : 'email:unknown';
    },
  });
}

interface KeyedRateLimitOptions extends RateLimitOptions {
  maxTrackedKeys: number;
  getKey: (req: Request) => string;
}

/**
 * Build a bounded fixed-window limiter for an arbitrary request key.
 *
 * @param options - Window, ceiling, storage bound, clock, and key extractor
 * @returns Express rate-limit middleware
 */
function createKeyedRateLimitMiddleware({
  windowMs,
  maxRequests,
  maxTrackedKeys,
  now = Date.now,
  getKey,
}: KeyedRateLimitOptions): RequestHandler {
  if (maxTrackedKeys < 1) throw new RangeError('maxTrackedKeys must be at least 1');

  const entries = new Map<string, RateLimitEntry>();
  let nextSweepAt = Number.NEGATIVE_INFINITY;

  return (req: Request, res: Response, next: NextFunction): void => {
    const currentTime = now();
    const key = getKey(req);
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

      if (entries.size >= maxTrackedKeys) {
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

/**
 * Collapse IPv6 clients to /64 while preserving one bucket per IPv4 address.
 *
 * @param ip - Express-resolved client address
 * @returns Stable IPv4 or IPv6-prefix storage key
 */
function getRateLimitIpKey(ip: string): string {
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
  const error = new ApiError(ApiErrorMessage.RATE_LIMITED, {
    statusCode: StatusCodes.TOO_MANY_REQUESTS,
    code: ApiErrorCode.RATE_LIMITED,
  });
  res.status(StatusCodes.TOO_MANY_REQUESTS).json(formatApiError(error));
}
