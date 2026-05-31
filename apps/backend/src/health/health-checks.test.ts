import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/clients', () => ({
  getCoreDbClient: vi.fn(),
}));

vi.mock('../clients/fga.client', () => ({
  FgaClient: {
    getClient: vi.fn(),
  },
}));

import { getCoreDbClient } from '../db/clients';
import { FgaClient } from '../clients/fga.client';
import { checkPostgres, checkOpenFga, runHealthChecks, clearHealthCheckCache } from './health-checks';

beforeEach(() => {
  clearHealthCheckCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkPostgres', () => {
  it('returns "ok" when SELECT 1 succeeds', async () => {
    const mockExecute = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    vi.mocked(getCoreDbClient).mockReturnValue({ execute: mockExecute } as never);

    const result = await checkPostgres();

    expect(result).toBe('ok');
    expect(mockExecute).toHaveBeenCalled();
  });

  it('returns "error" when the query throws', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.mocked(getCoreDbClient).mockReturnValue({ execute: mockExecute } as never);

    const result = await checkPostgres();

    expect(result).toBe('error');
  });

  it('returns "error" when getCoreDbClient throws (pool not initialized)', async () => {
    vi.mocked(getCoreDbClient).mockImplementation(() => {
      throw new Error('Database pools have not been initialized.');
    });

    const result = await checkPostgres();

    expect(result).toBe('error');
  });

  it('returns "timeout" when the query takes too long', async () => {
    const neverResolve = new Promise(() => {});
    const mockExecute = vi.fn().mockReturnValue(neverResolve);
    vi.mocked(getCoreDbClient).mockReturnValue({ execute: mockExecute } as never);

    vi.useFakeTimers();
    const resultPromise = checkPostgres();

    await vi.advanceTimersByTimeAsync(2001);

    const result = await resultPromise;
    expect(result).toBe('timeout');
  });
});

describe('checkOpenFga', () => {
  it('returns "ok" when readAuthorizationModel succeeds', async () => {
    const mockReadAuthorizationModel = vi.fn().mockResolvedValue({ authorization_model: {} });
    vi.mocked(FgaClient.getClient).mockReturnValue({ readAuthorizationModel: mockReadAuthorizationModel } as never);

    const result = await checkOpenFga();

    expect(result).toBe('ok');
  });

  it('returns "error" when readAuthorizationModel throws', async () => {
    const mockReadAuthorizationModel = vi.fn().mockRejectedValue(new Error('FGA connection failed'));
    vi.mocked(FgaClient.getClient).mockReturnValue({ readAuthorizationModel: mockReadAuthorizationModel } as never);

    const result = await checkOpenFga();

    expect(result).toBe('error');
  });

  it('returns "error" when FgaClient.getClient throws', async () => {
    vi.mocked(FgaClient.getClient).mockImplementation(() => {
      throw new Error('FGA env vars missing');
    });

    const result = await checkOpenFga();

    expect(result).toBe('error');
  });

  it('returns "timeout" when readAuthorizationModel takes too long', async () => {
    const neverResolve = new Promise(() => {});
    const mockReadAuthorizationModel = vi.fn().mockReturnValue(neverResolve);
    vi.mocked(FgaClient.getClient).mockReturnValue({ readAuthorizationModel: mockReadAuthorizationModel } as never);

    vi.useFakeTimers();
    const resultPromise = checkOpenFga();

    await vi.advanceTimersByTimeAsync(2001);

    const result = await resultPromise;
    expect(result).toBe('timeout');
  });
});

describe('runHealthChecks', () => {
  function setupMocks(postgresOk: boolean, openfgaOk: boolean) {
    const mockExecute = postgresOk
      ? vi.fn().mockResolvedValue([{ '?column?': 1 }])
      : vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.mocked(getCoreDbClient).mockReturnValue({ execute: mockExecute } as never);

    const mockReadAuthorizationModel = openfgaOk
      ? vi.fn().mockResolvedValue({ authorization_model: {} })
      : vi.fn().mockRejectedValue(new Error('FGA down'));
    vi.mocked(FgaClient.getClient).mockReturnValue({ readAuthorizationModel: mockReadAuthorizationModel } as never);
  }

  it('returns status "ok" when all checks pass', async () => {
    setupMocks(true, true);

    const result = await runHealthChecks();

    expect(result).toEqual({
      status: 'ok',
      checks: { postgres: 'ok', openfga: 'ok' },
    });
  });

  it('returns status "error" when postgres fails', async () => {
    setupMocks(false, true);

    const result = await runHealthChecks();

    expect(result).toEqual({
      status: 'error',
      checks: { postgres: 'error', openfga: 'ok' },
    });
  });

  it('returns status "error" when openfga fails', async () => {
    setupMocks(true, false);

    const result = await runHealthChecks();

    expect(result).toEqual({
      status: 'error',
      checks: { postgres: 'ok', openfga: 'error' },
    });
  });

  it('returns cached result within TTL when healthy', async () => {
    setupMocks(true, true);

    const first = await runHealthChecks();

    // Make the mocks fail — the cached result should still be returned
    setupMocks(false, false);

    const second = await runHealthChecks();

    expect(second).toBe(first);
    expect(second.status).toBe('ok');
  });

  it('does not cache error results', async () => {
    setupMocks(false, true);

    const first = await runHealthChecks();
    expect(first.status).toBe('error');

    // Recovery: make all deps healthy again — should return fresh ok result
    setupMocks(true, true);

    const second = await runHealthChecks();
    expect(second.status).toBe('ok');
    expect(second).not.toBe(first);
  });

  it('returns fresh result after TTL expires', async () => {
    vi.useFakeTimers();

    setupMocks(true, true);
    const first = await runHealthChecks();
    expect(first.status).toBe('ok');

    // Advance past the cache TTL (3000ms)
    vi.advanceTimersByTime(3001);

    setupMocks(false, true);
    const second = await runHealthChecks();
    expect(second.status).toBe('error');
    expect(second.checks.postgres).toBe('error');
  });
});
