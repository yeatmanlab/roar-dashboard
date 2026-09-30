import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import express from 'express';
import request from 'supertest';
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

  it('uses the forwarded client address behind the trusted ingress proxy', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(createIpRateLimitMiddleware({ windowMs: 60_000, maxRequests: 1 }));
    app.get('/', (_req, res) => res.sendStatus(StatusCodes.NO_CONTENT));

    const firstClientResponse = await request(app).get('/').set('X-Forwarded-For', '192.0.2.1');
    const secondClientResponse = await request(app).get('/').set('X-Forwarded-For', '192.0.2.2');
    const repeatedClientResponse = await request(app).get('/').set('X-Forwarded-For', '192.0.2.1');

    expect(firstClientResponse.status).toBe(StatusCodes.NO_CONTENT);
    expect(secondClientResponse.status).toBe(StatusCodes.NO_CONTENT);
    expect(repeatedClientResponse.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
  });

  it('preserves active counters when the tracking map is full', () => {
    const middleware = createIpRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
      maxTrackedIps: 1,
      now: () => 1_000,
    });
    const firstIp = { ip: '192.0.2.1', socket: {} } as Request;

    middleware(firstIp, response, next);
    middleware({ ip: '192.0.2.2', socket: {} } as Request, response, next);
    middleware(firstIp, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledTimes(2);
    expect(response.status).toHaveBeenNthCalledWith(1, StatusCodes.TOO_MANY_REQUESTS);
    expect(response.status).toHaveBeenNthCalledWith(2, StatusCodes.TOO_MANY_REQUESTS);
  });

  it('sweeps expired entries before admitting a new IP', () => {
    let currentTime = 1_000;
    const middleware = createIpRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
      maxTrackedIps: 1,
      now: () => currentTime,
    });

    middleware({ ip: '192.0.2.1', socket: {} } as Request, response, next);
    currentTime += 60_000;
    middleware({ ip: '192.0.2.2', socket: {} } as Request, response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).not.toHaveBeenCalled();
  });
});
