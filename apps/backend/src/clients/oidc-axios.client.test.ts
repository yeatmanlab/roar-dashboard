import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../logger';

const { mockGetRequestHeaders, mockGetIdTokenClient, mockRequestInterceptorUse, mockAxiosCreate } = vi.hoisted(() => {
  const mockGetRequestHeaders = vi.fn().mockResolvedValue(new Headers({ Authorization: 'Bearer mock-id-token' }));

  const mockGetIdTokenClient = vi.fn().mockResolvedValue({
    getRequestHeaders: mockGetRequestHeaders,
  });

  const mockRequestInterceptorUse = vi.fn();

  const mockAxiosCreate = vi.fn(() => ({
    interceptors: {
      request: { use: mockRequestInterceptorUse },
    },
  }));

  return {
    mockGetRequestHeaders,
    mockGetIdTokenClient,
    mockRequestInterceptorUse,
    mockAxiosCreate,
  };
});

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getIdTokenClient: mockGetIdTokenClient,
  })),
}));

vi.mock('axios', () => ({
  default: { create: mockAxiosCreate },
}));

import { GoogleAuth } from 'google-auth-library';
import { createOidcAxiosInstance } from './oidc-axios.client';

const TEST_AUDIENCE = 'https://fga.example.com';

type InterceptorConfig = { headers: { set: ReturnType<typeof vi.fn> } };
type InterceptorFn = (config: InterceptorConfig) => Promise<InterceptorConfig>;

/** Extract the interceptor function registered via `instance.interceptors.request.use()`. */
function getRegisteredInterceptor(): InterceptorFn {
  return mockRequestInterceptorUse.mock.calls[0]![0] as InterceptorFn;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOidcAxiosInstance', () => {
  it('creates a GoogleAuth instance and requests an ID token client for the audience', async () => {
    await createOidcAxiosInstance(TEST_AUDIENCE);

    expect(GoogleAuth).toHaveBeenCalledOnce();
    expect(mockGetIdTokenClient).toHaveBeenCalledWith(TEST_AUDIENCE);
  });

  it('creates an Axios instance', async () => {
    await createOidcAxiosInstance(TEST_AUDIENCE);

    expect(mockAxiosCreate).toHaveBeenCalledOnce();
  });

  it('registers a request interceptor', async () => {
    await createOidcAxiosInstance(TEST_AUDIENCE);

    expect(mockRequestInterceptorUse).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
  });

  it('interceptor attaches Authorization header from IdTokenClient', async () => {
    await createOidcAxiosInstance(TEST_AUDIENCE);
    const interceptorFn = getRegisteredInterceptor();

    const mockConfig: InterceptorConfig = { headers: { set: vi.fn() } };
    const result = await interceptorFn(mockConfig);

    expect(mockGetRequestHeaders).toHaveBeenCalledOnce();
    expect(mockConfig.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer mock-id-token');
    expect(result).toBe(mockConfig);
  });

  it('logs a warning and skips header when Authorization token is missing', async () => {
    mockGetRequestHeaders.mockResolvedValueOnce(new Headers());

    await createOidcAxiosInstance(TEST_AUDIENCE);
    const interceptorFn = getRegisteredInterceptor();

    const mockConfig: InterceptorConfig = { headers: { set: vi.fn() } };
    const result = await interceptorFn(mockConfig);

    expect(logger.warn).toHaveBeenCalledWith(
      { audience: TEST_AUDIENCE },
      'OIDC identity token missing from request headers, request will be unauthenticated',
    );
    expect(mockConfig.headers.set).not.toHaveBeenCalled();
    expect(result).toBe(mockConfig);
  });

  it('returns the Axios instance', async () => {
    const instance = await createOidcAxiosInstance(TEST_AUDIENCE);

    expect(instance).toBeDefined();
    expect(instance).toHaveProperty('interceptors');
  });
});
