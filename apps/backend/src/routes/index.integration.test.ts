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
import { ApiContractV1, MeContract } from '@roar-platform/api-contract';
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
// Contract path alignment
// ═══════════════════════════════════════════════════════════════════════════

describe('contract path alignment', () => {
  /**
   * The composed contract applies the version prefix itself, while the backend registers the
   * unprefixed sub-contracts and mounts them under a prefix it defines independently. Nothing
   * makes the two agree at compile time, and every other test in this suite hardcodes '/v1', so
   * all of them would keep passing if the contract's prefix drifted. Derive the path from the
   * contract instead, which is what a client actually requests.
   */
  it('serves clients at the path the contract advertises, not the unprefixed one', async () => {
    // A 401 from the auth guard proves the route matched. A prefix mismatch would miss every
    // handler and fall through to the catch-all below instead.
    const advertised = await request(app).get(ApiContractV1.me.get.path);

    expect(advertised.status).toBe(401);
    expect(advertised.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);

    // The sub-contract path is what the backend registers before mounting. If it were reachable
    // on its own, the prefix would not be load-bearing and the assertion above would prove little.
    const unprefixed = await request(app).get(MeContract.get.path);

    expect(unprefixed.status).toBe(404);
    expect(unprefixed.body.error.code).toBe(ApiErrorCode.REQUEST_INVALID);
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
