import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';

import type { ReadinessCheckResult } from './health-checks';

vi.mock('./health-checks', () => ({
  runReadinessChecks: vi.fn(),
}));

vi.mock('./shutdown-state', () => ({
  isShuttingDown: vi.fn().mockReturnValue(false),
}));

import { runReadinessChecks } from './health-checks';
import { isShuttingDown } from './shutdown-state';
import { healthRouter } from './health-routes';

const app = express();
app.use(healthRouter);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isShuttingDown).mockReturnValue(false);
});

describe('GET /health/live', () => {
  it('returns 200 unconditionally', async () => {
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.text).toBe('OK');
  });

  it('does not run readiness checks', async () => {
    await request(app).get('/health/live');

    expect(runReadinessChecks).not.toHaveBeenCalled();
  });

  it('returns 200 even during shutdown', async () => {
    vi.mocked(isShuttingDown).mockReturnValue(true);

    const res = await request(app).get('/health/live');

    expect(res.status).toBe(StatusCodes.OK);
  });
});

describe('GET /health/startup', () => {
  it('returns 200 unconditionally', async () => {
    const res = await request(app).get('/health/startup');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.text).toBe('OK');
  });

  it('does not run readiness checks', async () => {
    await request(app).get('/health/startup');

    expect(runReadinessChecks).not.toHaveBeenCalled();
  });

  it('returns 200 even during shutdown', async () => {
    vi.mocked(isShuttingDown).mockReturnValue(true);

    const res = await request(app).get('/health/startup');

    expect(res.status).toBe(StatusCodes.OK);
  });
});

describe('GET /health/ready', () => {
  it('returns 200 when all deps pass and not shutting down', async () => {
    const healthy: ReadinessCheckResult = { status: 'ok', checks: { postgres: 'ok', openfga: 'ok' } };
    vi.mocked(runReadinessChecks).mockResolvedValue(healthy);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body).toEqual(healthy);
  });

  it('returns 503 with shutting_down status when shutting down', async () => {
    vi.mocked(isShuttingDown).mockReturnValue(true);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body).toEqual({ status: 'shutting_down' });
    expect(runReadinessChecks).not.toHaveBeenCalled();
  });

  it('returns 503 when postgres fails', async () => {
    const unhealthy: ReadinessCheckResult = { status: 'error', checks: { postgres: 'error', openfga: 'ok' } };
    vi.mocked(runReadinessChecks).mockResolvedValue(unhealthy);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.checks.postgres).toBe('error');
  });

  it('returns 503 when openfga fails', async () => {
    const unhealthy: ReadinessCheckResult = { status: 'error', checks: { postgres: 'ok', openfga: 'error' } };
    vi.mocked(runReadinessChecks).mockResolvedValue(unhealthy);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.checks.openfga).toBe('error');
  });

  it('returns 503 when runReadinessChecks throws unexpectedly', async () => {
    vi.mocked(runReadinessChecks).mockRejectedValue(new Error('unexpected'));

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body).toEqual({ status: 'error', checks: { postgres: 'error', openfga: 'error' } });
  });
});
