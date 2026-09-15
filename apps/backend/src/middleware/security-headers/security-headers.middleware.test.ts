import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

let app: ReturnType<typeof express>;

beforeAll(async () => {
  const { securityHeadersMiddleware } = await import('./security-headers.middleware');

  app = express();
  app.use(securityHeadersMiddleware);
  app.get('/test', (_req, res) => {
    res.json({ ok: true });
  });
});

describe('Security headers middleware', () => {
  it('sets Content-Security-Policy to default-src none', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['content-security-policy']).toBe("default-src 'none'");
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets Strict-Transport-Security with max-age', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('sets X-Frame-Options: DENY', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('does not set Cross-Origin-Resource-Policy (disabled)', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['cross-origin-resource-policy']).toBeUndefined();
  });

  it('does not set Cross-Origin-Embedder-Policy (disabled)', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['cross-origin-embedder-policy']).toBeUndefined();
  });

  it('does not set Cross-Origin-Opener-Policy (disabled)', async () => {
    const res = await request(app).get('/test');

    expect(res.headers['cross-origin-opener-policy']).toBeUndefined();
  });
});
