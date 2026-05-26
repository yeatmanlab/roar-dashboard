import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';

import type { HealthCheckResult } from './health-checks';

vi.mock('./health-checks', () => ({
  runHealthChecks: vi.fn(),
}));

vi.mock('./shutdown-state', () => ({
  isShuttingDown: vi.fn().mockReturnValue(false),
}));

import { runHealthChecks } from './health-checks';
import { isShuttingDown } from './shutdown-state';
import { healthRouter } from './health-routes';

const app = express();
app.use(healthRouter);

beforeEach(() => {
  vi.mocked(isShuttingDown).mockReturnValue(false);
});

describe('GET /health/live', () => {
  it('returns 200 unconditionally', async () => {
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(StatusCodes.OK);
  });

  it('returns 200 even during shutdown', async () => {
    vi.mocked(isShuttingDown).mockReturnValue(true);

    const res = await request(app).get('/health/live');

    expect(res.status).toBe(StatusCodes.OK);
  });
});

describe('GET /health/startup', () => {
  it('returns 200 when all deps pass', async () => {
    const healthy: HealthCheckResult = { status: 'ok', checks: { postgres: 'ok', openfga: 'ok' } };
    vi.mocked(runHealthChecks).mockResolvedValue(healthy);

    const res = await request(app).get('/health/startup');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body).toEqual(healthy);
  });

  it('returns 503 when postgres fails', async () => {
    const unhealthy: HealthCheckResult = { status: 'error', checks: { postgres: 'error', openfga: 'ok' } };
    vi.mocked(runHealthChecks).mockResolvedValue(unhealthy);

    const res = await request(app).get('/health/startup');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.checks.postgres).toBe('error');
  });

  it('returns 503 when openfga fails', async () => {
    const unhealthy: HealthCheckResult = { status: 'error', checks: { postgres: 'ok', openfga: 'error' } };
    vi.mocked(runHealthChecks).mockResolvedValue(unhealthy);

    const res = await request(app).get('/health/startup');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.checks.openfga).toBe('error');
  });

  it('returns 503 with timeout status when a dep times out', async () => {
    const unhealthy: HealthCheckResult = { status: 'error', checks: { postgres: 'timeout', openfga: 'ok' } };
    vi.mocked(runHealthChecks).mockResolvedValue(unhealthy);

    const res = await request(app).get('/health/startup');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.checks.postgres).toBe('timeout');
  });

  it('returns 503 when runHealthChecks throws unexpectedly', async () => {
    vi.mocked(runHealthChecks).mockRejectedValue(new Error('unexpected'));

    const res = await request(app).get('/health/startup');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body).toEqual({ status: 'error' });
  });
});

describe('GET /health/ready', () => {
  it('returns 200 when all deps pass and not shutting down', async () => {
    const healthy: HealthCheckResult = { status: 'ok', checks: { postgres: 'ok', openfga: 'ok' } };
    vi.mocked(runHealthChecks).mockResolvedValue(healthy);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body).toEqual(healthy);
  });

  it('returns 503 with shutting_down status when shutting down', async () => {
    vi.mocked(isShuttingDown).mockReturnValue(true);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body).toEqual({ status: 'shutting_down' });
    expect(runHealthChecks).not.toHaveBeenCalled();
  });

  it('returns 503 when postgres fails', async () => {
    const unhealthy: HealthCheckResult = { status: 'error', checks: { postgres: 'error', openfga: 'ok' } };
    vi.mocked(runHealthChecks).mockResolvedValue(unhealthy);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.checks.postgres).toBe('error');
  });

  it('returns 503 when openfga fails', async () => {
    const unhealthy: HealthCheckResult = { status: 'error', checks: { postgres: 'ok', openfga: 'error' } };
    vi.mocked(runHealthChecks).mockResolvedValue(unhealthy);

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.checks.openfga).toBe('error');
  });

  it('returns 503 when runHealthChecks throws unexpectedly', async () => {
    vi.mocked(runHealthChecks).mockRejectedValue(new Error('unexpected'));

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body).toEqual({ status: 'error' });
  });
});
