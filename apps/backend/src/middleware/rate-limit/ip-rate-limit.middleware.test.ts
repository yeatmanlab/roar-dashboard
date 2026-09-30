import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { createIpRateLimitMiddleware } from './ip-rate-limit.middleware';

describe('createIpRateLimitMiddleware', () => {
  let response: Response;
  let next: NextFunction;

  beforeEach(() => {
    response = {
      json: vi.fn(),
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;
    next = vi.fn();
  });

  it('returns a standard 429 response after the per-IP limit', () => {
    const middleware = createIpRateLimitMiddleware({ windowMs: 60_000, maxRequests: 1, now: () => 1_000 });
    const request = { ip: '192.0.2.1', socket: {} } as Request;

    middleware(request, response, next);
    middleware(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(StatusCodes.TOO_MANY_REQUESTS);
    expect(response.set).toHaveBeenCalledWith('Retry-After', '60');
    expect(response.json).toHaveBeenCalledWith({
      error: { message: ApiErrorMessage.RATE_LIMITED, code: ApiErrorCode.RATE_LIMITED },
    });
  });

  it('tracks different IPs independently', () => {
    const middleware = createIpRateLimitMiddleware({ windowMs: 60_000, maxRequests: 1 });

    middleware({ ip: '192.0.2.1', socket: {} } as Request, response, next);
    middleware({ ip: '192.0.2.2', socket: {} } as Request, response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('allows requests again after the window expires', () => {
    let currentTime = 1_000;
    const middleware = createIpRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
      now: () => currentTime,
    });
    const request = { ip: '192.0.2.1', socket: {} } as Request;

    middleware(request, response, next);
    currentTime += 60_000;
    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).not.toHaveBeenCalled();
  });
});
