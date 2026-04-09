import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tsRestFetchApi } from '@ts-rest/core';

// Set the env var before any module imports reference it
vi.stubEnv('VITE_ROAR_API_BASE_URL', 'https://api.test.example.com');

vi.mock('@ts-rest/core', () => ({
  initClient: vi.fn(() => ({})),
  tsRestFetchApi: vi.fn(),
}));

vi.mock('@roar-dashboard/api-contract', () => ({
  ApiContractV1: {},
}));

const mockAuthStore = {
  accessToken: 'valid-token',
  forceIdTokenRefresh: vi.fn(),
};

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

describe('getRoarApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    // Restore the env var so subsequent describes re-import the module with it set
    vi.stubEnv('VITE_ROAR_API_BASE_URL', 'https://api.test.example.com');
  });

  it('creates a singleton client on first call', async () => {
    const { initClient } = await import('@ts-rest/core');
    const { getRoarApiClient } = await import('./index');

    const client1 = getRoarApiClient();
    const client2 = getRoarApiClient();

    expect(client1).toBe(client2);
    expect(initClient).toHaveBeenCalledTimes(1);
  });

  it('throws when VITE_ROAR_API_BASE_URL is not set', async () => {
    vi.stubEnv('VITE_ROAR_API_BASE_URL', '');
    const { getRoarApiClient } = await import('./index');

    expect(() => getRoarApiClient()).toThrow('VITE_ROAR_API_BASE_URL is not set');
  });
});

describe('apiWithAuthRetry', () => {
  /** @type {Function} */
  let capturedApi;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuthStore.accessToken = 'valid-token';

    const { initClient } = await import('@ts-rest/core');
    vi.mocked(initClient).mockImplementation((_contract, options) => {
      capturedApi = options.api;
      return {};
    });

    const { getRoarApiClient } = await import('./index');
    getRoarApiClient();
  });

  it('attaches the auth token to requests', async () => {
    const mockResponse = { status: 200, clone: () => mockResponse, json: () => ({}) };
    vi.mocked(tsRestFetchApi).mockResolvedValue(mockResponse);

    await capturedApi({ headers: { 'Content-Type': 'application/json' } });

    expect(tsRestFetchApi).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('omits Authorization header when no token is available', async () => {
    mockAuthStore.accessToken = null;
    const mockResponse = { status: 200, clone: () => mockResponse, json: () => ({}) };
    vi.mocked(tsRestFetchApi).mockResolvedValue(mockResponse);

    await capturedApi({ headers: {} });

    const callArgs = vi.mocked(tsRestFetchApi).mock.calls[0][0];
    expect(callArgs.headers).not.toHaveProperty('Authorization');
  });

  it('retries on 401 with auth/token-expired after refreshing the token', async () => {
    const expiredResponse = {
      status: 401,
      clone() {
        return this;
      },
      json: vi.fn().mockResolvedValue({ error: { code: 'auth/token-expired' } }),
    };
    const successResponse = { status: 200 };

    vi.mocked(tsRestFetchApi).mockResolvedValueOnce(expiredResponse).mockResolvedValueOnce(successResponse);

    mockAuthStore.forceIdTokenRefresh.mockResolvedValue('refreshed-token');

    const result = await capturedApi({ headers: {} });

    expect(result).toBe(successResponse);
    expect(mockAuthStore.forceIdTokenRefresh).toHaveBeenCalledTimes(1);
    expect(tsRestFetchApi).toHaveBeenCalledTimes(2);
    // Second call should use the refreshed token
    expect(tsRestFetchApi).toHaveBeenLastCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer refreshed-token' }),
      }),
    );
  });

  it('does not retry on 401 without auth/token-expired code', async () => {
    const unauthorizedResponse = {
      status: 401,
      clone() {
        return this;
      },
      json: vi.fn().mockResolvedValue({ error: { code: 'auth/invalid-token' } }),
    };

    vi.mocked(tsRestFetchApi).mockResolvedValue(unauthorizedResponse);

    const result = await capturedApi({ headers: {} });

    expect(result).toBe(unauthorizedResponse);
    expect(mockAuthStore.forceIdTokenRefresh).not.toHaveBeenCalled();
    expect(tsRestFetchApi).toHaveBeenCalledTimes(1);
  });

  it('returns original response when 401 body cannot be parsed', async () => {
    const badResponse = {
      status: 401,
      clone() {
        return this;
      },
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    };

    vi.mocked(tsRestFetchApi).mockResolvedValue(badResponse);

    const result = await capturedApi({ headers: {} });

    expect(result).toBe(badResponse);
    expect(tsRestFetchApi).toHaveBeenCalledTimes(1);
  });
});
