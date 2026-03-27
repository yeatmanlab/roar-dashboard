import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiError } from '../errors/api-error';
import { logger } from '../logger';
import { FgaClient } from './fga.client';

// storeId and authorizationModelId must be valid ULIDs (26 Crockford base32 chars)
const MOCK_ENV = {
  FGA_API_URL: 'https://localhost:5050',
  FGA_STORE_ID: '01JME8Q5R0V9CPHFBCTABT0000',
  FGA_MODEL_ID: '01JME8Q5R0V9CPHFBCTABT0001',
};

const setFgaEnv = (overrides: Partial<typeof MOCK_ENV> = {}) => {
  const env = { ...MOCK_ENV, ...overrides };
  process.env.FGA_API_URL = env.FGA_API_URL;
  process.env.FGA_STORE_ID = env.FGA_STORE_ID;
  process.env.FGA_MODEL_ID = env.FGA_MODEL_ID;
};

const clearFgaEnv = () => {
  delete process.env.FGA_API_URL;
  delete process.env.FGA_STORE_ID;
  delete process.env.FGA_MODEL_ID;
};

beforeEach(() => {
  FgaClient.clearCache();
  clearFgaEnv();
});

describe('FgaClient', () => {
  it('returns an OpenFgaClient instance when all env vars are set', () => {
    setFgaEnv();

    const client = FgaClient.getClient();

    expect(client).toBeDefined();
    expect(client).toHaveProperty('check');
    expect(client).toHaveProperty('listObjects');
    expect(client).toHaveProperty('write');
  });

  it('returns the same instance on subsequent calls (singleton behavior)', () => {
    setFgaEnv();

    const first = FgaClient.getClient();
    const second = FgaClient.getClient();

    expect(first).toBe(second);
  });

  it('throws ApiError if FGA_API_URL is missing', () => {
    process.env.FGA_STORE_ID = MOCK_ENV.FGA_STORE_ID;
    process.env.FGA_MODEL_ID = MOCK_ENV.FGA_MODEL_ID;

    expect(() => FgaClient.getClient()).toThrow(ApiError);
  });

  it('throws ApiError if FGA_STORE_ID is missing', () => {
    process.env.FGA_API_URL = MOCK_ENV.FGA_API_URL;
    process.env.FGA_MODEL_ID = MOCK_ENV.FGA_MODEL_ID;

    expect(() => FgaClient.getClient()).toThrow(ApiError);
  });

  it('throws ApiError if FGA_MODEL_ID is missing', () => {
    process.env.FGA_API_URL = MOCK_ENV.FGA_API_URL;
    process.env.FGA_STORE_ID = MOCK_ENV.FGA_STORE_ID;

    expect(() => FgaClient.getClient()).toThrow(ApiError);
  });

  it('throws ApiError if all env vars are missing', () => {
    expect(() => FgaClient.getClient()).toThrow(ApiError);
  });

  it('logs apiUrl, storeId, and authorizationModelId on first initialization', () => {
    setFgaEnv();

    FgaClient.getClient();

    expect(logger.debug).toHaveBeenCalledWith(
      { apiUrl: MOCK_ENV.FGA_API_URL, storeId: MOCK_ENV.FGA_STORE_ID, authorizationModelId: MOCK_ENV.FGA_MODEL_ID },
      'Initializing OpenFGA client',
    );
  });

  it('does not log on subsequent calls', () => {
    setFgaEnv();

    FgaClient.getClient();
    vi.mocked(logger.debug).mockClear();

    FgaClient.getClient();

    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('clearCache resets the instance so the next call re-initializes', () => {
    setFgaEnv();

    const first = FgaClient.getClient();

    FgaClient.clearCache();

    const second = FgaClient.getClient();

    expect(first).not.toBe(second);
  });

  it('clearCache allows the next call to throw if env vars are removed', () => {
    setFgaEnv();

    FgaClient.getClient();
    FgaClient.clearCache();
    clearFgaEnv();

    expect(() => FgaClient.getClient()).toThrow(ApiError);
  });
});
