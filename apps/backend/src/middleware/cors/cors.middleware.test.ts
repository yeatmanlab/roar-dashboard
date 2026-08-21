import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('./parse-allowed-origins', () => ({
  parseAllowedOrigins: vi.fn(() => ['https://allowed.example.com']),
}));

const ALLOWED_ORIGIN = 'https://allowed.example.com';
const DISALLOWED_ORIGIN = 'https://evil.example.com';

let app: ReturnType<typeof express>;

beforeAll(async () => {
  const { corsMiddleware } = await import('./cors.middleware');

  app = express();
  app.use(corsMiddleware);
  app.get('/test', (_req, res) => {
    res.json({ ok: true });
  });
});

describe('CORS middleware', () => {
  it('returns CORS headers for an allowed origin', async () => {
    const res = await request(app).get('/test').set('Origin', ALLOWED_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not return CORS headers for a disallowed origin', async () => {
    const res = await request(app).get('/test').set('Origin', DISALLOWED_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not return CORS headers when no Origin is sent', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns 204 for preflight requests from allowed origin', async () => {
    const res = await request(app)
      .options('/test')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization,Content-Type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toMatch(/Content-Type/i);
    expect(res.headers['access-control-allow-headers']).toMatch(/Authorization/i);
    expect(res.headers['access-control-allow-headers']).toMatch(/sentry-trace/i);
    expect(res.headers['access-control-allow-headers']).toMatch(/baggage/i);
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  it('does not return allow-origin for preflight from a disallowed origin', async () => {
    const res = await request(app)
      .options('/test')
      .set('Origin', DISALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
