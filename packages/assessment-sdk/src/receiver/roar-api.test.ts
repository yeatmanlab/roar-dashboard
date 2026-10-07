import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient, RoarApi } from './roar-api';
import type { ApiClientConfig } from './roar-api';
import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums/sdk-error-code.enum';

// Nothing from ts-rest is mocked. Tests stub the global fetch (the same
// pattern as compat/firekit.test.ts) and drive a real client through a real
// contract route, so the assertions cover the receiver's actual integration —
// including ts-rest's response parsing, which hand-built response mocks have
// misrepresented before (the dashboard client's dead 401 retry).

const BASE_URL = 'https://api.example.com';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const okBody = {
  data: { id: 'user-1', userType: 'student', isSuperAdmin: false, unsignedAgreements: [], families: [] },
};
const expiredBody = { error: { message: 'Unauthorized', code: 'auth/token-expired' } };
const invalidBody = { error: { message: 'Unauthorized', code: 'auth/token-invalid' } };

function buildClient(
  authOverrides: Partial<ApiClientConfig['auth']> = {},
  configOverrides: Partial<Omit<ApiClientConfig, 'auth' | 'baseUrl'>> = {},
) {
  return createApiClient({
    baseUrl: BASE_URL,
    auth: {
      getToken: vi.fn().mockResolvedValue('initial-token'),
      ...authOverrides,
    },
    ...configOverrides,
  });
}

/** Headers fetch was called with on the given call, normalized for assertion. */
function fetchHeaders(fetchMock: ReturnType<typeof vi.fn>, call: number): Record<string, string> {
  const init = fetchMock.mock.calls[call]![1] as RequestInit;
  return Object.fromEntries(new Headers(init.headers).entries());
}

describe('createApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('header injection', () => {
    it('injects the Authorization bearer token and x-request-id', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, okBody));
      const client = buildClient({}, { requestId: () => 'req-1' });

      await client.me.get();

      const headers = fetchHeaders(fetchMock, 0);
      expect(headers.authorization).toBe('Bearer initial-token');
      expect(headers['x-request-id']).toBe('req-1');
    });

    it('omits the Authorization header when getToken resolves undefined', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, okBody));
      const client = buildClient({ getToken: vi.fn().mockResolvedValue(undefined) });

      await client.me.get();

      expect(fetchHeaders(fetchMock, 0)).not.toHaveProperty('authorization');
    });
  });

  describe('401 refresh-and-retry', () => {
    it('refreshes and retries once on 401 auth/token-expired', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, expiredBody)).mockResolvedValueOnce(jsonResponse(200, okBody));
      const refreshToken = vi.fn().mockResolvedValue('fresh-token');
      const client = buildClient({ refreshToken });

      const result = await client.me.get();

      expect(result.status).toBe(200);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchHeaders(fetchMock, 1).authorization).toBe('Bearer fresh-token');
    });

    it('refreshes and retries once on 401 auth/token-invalid', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, invalidBody)).mockResolvedValueOnce(jsonResponse(200, okBody));
      const refreshToken = vi.fn().mockResolvedValue('fresh-token');
      const client = buildClient({ refreshToken });

      const result = await client.me.get();

      expect(result.status).toBe(200);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('reuses the original x-request-id on the retry', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, expiredBody)).mockResolvedValueOnce(jsonResponse(200, okBody));
      let requestCounter = 0;
      const client = buildClient(
        { refreshToken: vi.fn().mockResolvedValue('fresh-token') },
        { requestId: () => `req-${++requestCounter}` },
      );

      await client.me.get();

      expect(fetchHeaders(fetchMock, 0)['x-request-id']).toBe('req-1');
      expect(fetchHeaders(fetchMock, 1)['x-request-id']).toBe('req-1');
    });

    it('does not retry a 401 with a non-token error code', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: 'Unauthorized', code: 'auth/required' } }));
      const refreshToken = vi.fn();
      const client = buildClient({ refreshToken });

      const result = await client.me.get();

      expect(result.status).toBe(401);
      expect(refreshToken).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry when no refreshToken callback is configured', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, expiredBody));
      const client = buildClient();

      const result = await client.me.get();

      expect(result.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('surfaces the original 401 without retrying when the refresh resolves no token', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, expiredBody));
      const refreshToken = vi.fn().mockResolvedValue(undefined);
      const client = buildClient({ refreshToken });

      const result = await client.me.get();

      expect(result.status).toBe(401);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('surfaces the original 401 and logs a warning when the refresh throws', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, expiredBody));
      const refreshToken = vi.fn().mockRejectedValue(new Error('session revoked'));
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const client = buildClient({ refreshToken }, { logger });

      const result = await client.me.get();

      expect(result.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('[assessment-sdk] Token refresh failed', expect.any(Error));
    });

    it('returns a non-envelope 401 unchanged (text body, e.g. an HTML error page)', async () => {
      fetchMock.mockResolvedValue(
        new Response('<html>Unauthorized</html>', {
          status: 401,
          headers: { 'content-type': 'text/html' },
        }),
      );
      const refreshToken = vi.fn();
      const client = buildClient({ refreshToken });

      const result = await client.me.get();

      expect(result.status).toBe(401);
      expect(refreshToken).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent refreshes: a burst of 401s triggers one refreshToken call', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(401, expiredBody))
        .mockResolvedValueOnce(jsonResponse(401, expiredBody))
        .mockImplementation(() => Promise.resolve(jsonResponse(200, okBody)));

      let resolveRefresh: (token: string) => void;
      const refreshToken = vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveRefresh = resolve;
          }),
      );
      const client = buildClient({ refreshToken });

      const first = client.me.get();
      const second = client.me.get();

      // Let both requests receive their 401s and reach the shared refresh.
      await new Promise((resolve) => setTimeout(resolve, 0));
      resolveRefresh!('fresh-token');

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult.status).toBe(200);
      expect(secondResult.status).toBe(200);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      // Two originals + two retries.
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('performs a fresh refresh for a later expiry (in-flight dedup resets after completion)', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(401, expiredBody))
        .mockResolvedValueOnce(jsonResponse(200, okBody))
        .mockResolvedValueOnce(jsonResponse(401, expiredBody))
        .mockResolvedValueOnce(jsonResponse(200, okBody));
      const refreshToken = vi.fn().mockResolvedValue('fresh-token');
      const client = buildClient({ refreshToken });

      await client.me.get();
      await client.me.get();

      expect(refreshToken).toHaveBeenCalledTimes(2);
    });
  });
});

describe('RoarApi', () => {
  it('throws SDKError when participantId is missing', () => {
    const contextWithoutParticipant: CommandContext = {
      baseUrl: BASE_URL,
      auth: {
        getToken: async () => 'test-token',
      },
      participant: {
        participantId: '',
      },
    };

    expect(() => {
      new RoarApi(contextWithoutParticipant);
    }).toThrow(SDKError);

    let error: unknown;
    try {
      new RoarApi(contextWithoutParticipant);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(SDKError);
    expect((error as SDKError).code).toBe(SdkErrorCode.INVALID_CONTEXT);
  });

  it('creates client successfully when participantId is present', () => {
    const contextWithParticipant: CommandContext = {
      baseUrl: BASE_URL,
      auth: {
        getToken: async () => 'test-token',
      },
      participant: {
        participantId: 'participant-123',
      },
    };

    const api = new RoarApi(contextWithParticipant);
    expect(api.client).toBeDefined();
  });
});
