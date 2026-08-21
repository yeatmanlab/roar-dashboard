import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import { logger } from './logger';

// Pin the CORS allowlist so the test does not depend on ALLOWED_ORIGINS in the environment,
// mirroring cors.middleware.test.ts. The real cors / security-headers / request-logger
// middleware (and their wiring in app.ts) are still exercised end-to-end.
vi.mock('./middleware/cors/parse-allowed-origins', () => ({
  parseAllowedOrigins: vi.fn(() => ['https://allowed.example.com']),
}));

const ALLOWED_ORIGIN = 'https://allowed.example.com';
const DISALLOWED_ORIGIN = 'https://evil.example.com';

// request-logger logs through logger.child(); the shared logger mock returns one child instance.
const requestLog = logger.child({});

// Let the response 'finish' event (where request-logger logs) fire before asserting.
const flushFinish = () => new Promise((resolve) => setImmediate(resolve));

let app: Express;

// Importing the app triggers the full route tree (routes → controllers → services → repositories).
// Under heavy parallel test load, the dynamic import can exceed the default 10s hookTimeout.
beforeAll(async () => {
  app = (await import('./app')).default;
}, 30_000);

describe('app middleware wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies Helmet security headers and omits the disabled ones', async () => {
    const res = await request(app).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['cross-origin-opener-policy']).toBeUndefined();
    expect(res.headers['cross-origin-resource-policy']).toBeUndefined();
    expect(res.headers['cross-origin-embedder-policy']).toBeUndefined();
  });

  it('returns CORS headers for an allowed origin', async () => {
    const res = await request(app).get('/no-such-route').set('Origin', ALLOWED_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('omits allow-origin for a disallowed origin', async () => {
    const res = await request(app).get('/no-such-route').set('Origin', DISALLOWED_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a CORS preflight with 204 and the allowed origin', async () => {
    const res = await request(app)
      .options('/v1/anything')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('logs the preflight — requestLogger runs before cors short-circuits it', async () => {
    await request(app)
      .options('/v1/anything')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    await flushFinish();

    // A 204 preflight logs at info level. Were requestLogger registered after corsMiddleware,
    // cors would end the preflight before the logger ran and this would never be called.
    expect(requestLog.info).toHaveBeenCalled();
  });
});

describe('app JSON body limit', () => {
  // app.ts raises express.json()'s limit from the 100kb default to 1mb (mirroring the legacy
  // Firestore per-document ceiling). This is a global change affecting every endpoint, so
  // assert the boundary directly to lock in the intent and catch an accidental revert.
  it('rejects a JSON body larger than 1mb with 413', async () => {
    const oversized = { data: 'x'.repeat(1024 * 1024 + 1024) }; // ~1mb + 1kb of payload

    const res = await request(app).post('/v1/anything').send(oversized);

    expect(res.status).toBe(413);
  });

  it('accepts a JSON body under 1mb — express.json parses it and passes it on to routing', async () => {
    const underLimit = { data: 'x'.repeat(512 * 1024) }; // ~512kb, comfortably under 1mb

    const res = await request(app).post('/v1/anything').send(underLimit);

    // Parses without a size error, so it reaches the catch-all (no route matches) → 404,
    // and crucially NOT 413. A 100kb default would have rejected this body.
    expect(res.status).not.toBe(413);
    expect(res.status).toBe(404);
  });
});
