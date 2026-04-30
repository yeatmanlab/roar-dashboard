import { describe, it, expect, beforeEach, vi } from 'vitest';

// Undo the global FGA client mock from vitest.setup.ts — this file tests the real implementation
vi.unmock('./fga.client');

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
  delete process.env.FGA_OIDC_AUDIENCE;
};

const mockAxiosInstance = { interceptors: { request: { use: vi.fn() } } };
const mockCreateOidcAxiosInstance = vi.fn().mockResolvedValue(mockAxiosInstance);

vi.mock('./oidc-axios.client', () => ({
  createOidcAxiosInstance: mockCreateOidcAxiosInstance,
}));

beforeEach(() => {
  FgaClient.clearCache();
  clearFgaEnv();
  vi.clearAllMocks();
});

describe('FgaClient', () => {
  describe('getClient', () => {
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
  });

  describe('clearCache', () => {
    it('resets the instance so the next call re-initializes', () => {
      setFgaEnv();

      const first = FgaClient.getClient();

      FgaClient.clearCache();

      const second = FgaClient.getClient();

      expect(first).not.toBe(second);
    });

    it('allows the next call to throw if env vars are removed', () => {
      setFgaEnv();

      FgaClient.getClient();
      FgaClient.clearCache();
      clearFgaEnv();

      expect(() => FgaClient.getClient()).toThrow(ApiError);
    });
  });

  describe('initialize', () => {
    it('is a no-op when FGA_OIDC_AUDIENCE is not set', async () => {
      await FgaClient.initialize();

      expect(logger.debug).toHaveBeenCalledWith('FGA_OIDC_AUDIENCE not set, skipping OIDC initialization');
      expect(mockCreateOidcAxiosInstance).not.toHaveBeenCalled();
    });

    it('pre-initializes the client with OIDC when audience is set', async () => {
      setFgaEnv();
      process.env.FGA_OIDC_AUDIENCE = 'https://fga.example.com';

      await FgaClient.initialize();

      expect(mockCreateOidcAxiosInstance).toHaveBeenCalledWith('https://fga.example.com');
      expect(logger.info).toHaveBeenCalledWith(
        { audience: 'https://fga.example.com' },
        'FGA client initialized with OIDC authentication',
      );

      // getClient should return the pre-initialized instance
      const client = FgaClient.getClient();
      expect(client).toBeDefined();
    });

    it('throws when audience is set but FGA env vars are missing', async () => {
      process.env.FGA_OIDC_AUDIENCE = 'https://fga.example.com';

      await expect(FgaClient.initialize()).rejects.toThrow(ApiError);
    });

    it('skips re-initialization when instance already exists', async () => {
      setFgaEnv();
      process.env.FGA_OIDC_AUDIENCE = 'https://fga.example.com';

      await FgaClient.initialize();
      vi.mocked(logger.debug).mockClear();
      mockCreateOidcAxiosInstance.mockClear();

      await FgaClient.initialize();

      expect(logger.debug).toHaveBeenCalledWith('FGA client already initialized, skipping OIDC re-initialization');
      expect(mockCreateOidcAxiosInstance).not.toHaveBeenCalled();
    });

    it('getClient returns the pre-initialized instance without re-creating', async () => {
      setFgaEnv();
      process.env.FGA_OIDC_AUDIENCE = 'https://fga.example.com';

      await FgaClient.initialize();
      vi.mocked(logger.debug).mockClear();

      const client = FgaClient.getClient();

      // Should not log "Initializing OpenFGA client" again — instance was cached by initialize()
      expect(logger.debug).not.toHaveBeenCalledWith(expect.anything(), 'Initializing OpenFGA client');
      expect(client).toBeDefined();
    });
  });
});
