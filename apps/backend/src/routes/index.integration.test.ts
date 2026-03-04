/**
 * App-level route integration tests.
 *
 * Unlike per-endpoint tests that use `createTestApp` with individual route modules,
 * these tests import the production `app.ts` directly. This verifies the real wiring:
 * `registerAllRoutes`, the 404 catch-all handler, and the global error handler —
 * exactly as they run in production.
 *
 * No tier users are needed — these tests exercise infrastructure, not role-based access.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { version } from '../../package.json';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;

beforeAll(async () => {
  // Import the production app dynamically — route modules instantiate services
  // at import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const appModule = await import('../app');
  app = appModule.default;
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/', () => {
  it('returns API title and version', async () => {
    const res = await request(app).get('/v1/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      title: 'ROAR API',
      version,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 404 handling
// ═══════════════════════════════════════════════════════════════════════════

describe('404 handling', () => {
  it('returns 404 with error code for unknown routes', async () => {
    const res = await request(app).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_INVALID);
  });

  it('returns 404 for unknown nested paths under /v1', async () => {
    const res = await request(app).get('/v1/no-such-resource');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_INVALID);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Authentication guard
// ═══════════════════════════════════════════════════════════════════════════

describe('authentication guard', () => {
  it('returns 401 with AUTH_REQUIRED for protected routes without a token', async () => {
    const res = await request(app).get('/v1/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Request parsing
// ═══════════════════════════════════════════════════════════════════════════

describe('request parsing', () => {
  it('returns 400 for malformed JSON body', async () => {
    const res = await request(app).post('/v1/me').set('Content-Type', 'application/json').send('{ invalid json }');

    expect(res.status).toBe(400);
  });
});
