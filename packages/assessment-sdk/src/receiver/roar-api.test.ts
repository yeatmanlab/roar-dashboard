import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { createApiClient, RoarApi } from './roar-api';
import type { ApiClientConfig } from './roar-api';
import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums/sdk-error-code.enum';

// The receiver's behavior lives in the custom `api` function it hands to
// initClient. Both ts-rest exports are mocked so tests can capture that
// function and drive it with hand-built `{ status, body, headers }` responses —
// the REAL shape tsRestFetchApi resolves to (parsed body, no fetch Response
// methods like clone()/json()).
vi.mock('@ts-rest/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ts-rest/core')>();
  return {
    ...actual,
    initClient: vi.fn(),
    tsRestFetchApi: vi.fn(),
  };
});

interface ApiArgs {
  headers: Record<string, string>;
}
type ApiFn = (args: ApiArgs) => Promise<unknown>;

/** Builds a client from the config and returns the captured custom api function. */
function captureApi(config: ApiClientConfig): ApiFn {
  let captured: ApiFn | undefined;
  vi.mocked(initClient).mockImplementation(((_contract: unknown, opts: { api: ApiFn }) => {
    captured = opts.api;
    return {};
  }) as unknown as typeof initClient);

  createApiClient(config);

  if (!captured) throw new Error('initClient was not called with an api function');
  return captured;
}

function baseConfig(overrides: Partial<ApiClientConfig['auth']> = {}): ApiClientConfig {
  return {
    baseUrl: 'https://api.example.com',
    auth: {
      getToken: vi.fn().mockResolvedValue('initial-token'),
      ...overrides,
    },
  };
}

const ok = { status: 200, body: { data: {} }, headers: new Headers() };
const expired401 = { status: 401, body: { error: { code: 'auth/token-expired' } }, headers: new Headers() };
const invalid401 = { status: 401, body: { error: { code: 'auth/token-invalid' } }, headers: new Headers() };

describe('createApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header injection', () => {
    it('injects the Authorization bearer token and x-request-id', async () => {
      vi.mocked(tsRestFetchApi).mockResolvedValue(ok);
      const api = captureApi({ ...baseConfig(), requestId: () => 'req-1' });

      await api({ headers: { 'content-type': 'application/json' } });

      expect(tsRestFetchApi).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'content-type': 'application/json',
            Authorization: 'Bearer initial-token',
            'x-request-id': 'req-1',
          },
        }),
      );
    });

    it('omits the Authorization header when getToken resolves undefined', async () => {
      vi.mocked(tsRestFetchApi).mockResolvedValue(ok);
      const api = captureApi(baseConfig({ getToken: vi.fn().mockResolvedValue(undefined) }));

      await api({ headers: {} });

      const callArgs = vi.mocked(tsRestFetchApi).mock.calls[0]![0] as unknown as ApiArgs;
      expect(callArgs.headers).not.toHaveProperty('Authorization');
    });
  });

  describe('401 refresh-and-retry', () => {
    it('refreshes and retries once on 401 auth/token-expired', async () => {
      vi.mocked(tsRestFetchApi).mockResolvedValueOnce(expired401).mockResolvedValueOnce(ok);
      const refreshToken = vi.fn().mockResolvedValue('fresh-token');
      const api = captureApi(baseConfig({ refreshToken }));

      const result = await api({ headers: {} });

      expect(result).toBe(ok);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(tsRestFetchApi).toHaveBeenCalledTimes(2);
      expect(tsRestFetchApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
        }),
      );
    });

    it('refreshes and retries once on 401 auth/token-invalid', async () => {
      vi.mocked(tsRestFetchApi).mockResolvedValueOnce(invalid401).mockResolvedValueOnce(ok);
      const refreshToken = vi.fn().mockResolvedValue('fresh-token');
      const api = captureApi(baseConfig({ refreshToken }));

      const result = await api({ headers: {} });

      expect(result).toBe(ok);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(tsRestFetchApi).toHaveBeenCalledTimes(2);
    });

    it('does not retry a 401 with a non-token error code', async () => {
      const forbidden401 = { status: 401, body: { error: { code: 'auth/required' } }, headers: new Headers() };
      vi.mocked(tsRestFetchApi).mockResolvedValue(forbidden401);
      const refreshToken = vi.fn();
      const api = captureApi(baseConfig({ refreshToken }));

      const result = await api({ headers: {} });

      expect(result).toBe(forbidden401);
      expect(refreshToken).not.toHaveBeenCalled();
      expect(tsRestFetchApi).toHaveBeenCalledTimes(1);
    });

    it('does not retry when no refreshToken callback is configured', async () => {
      vi.mocked(tsRestFetchApi).mockResolvedValue(expired401);
      const api = captureApi(baseConfig());

      const result = await api({ headers: {} });

      expect(result).toBe(expired401);
      expect(tsRestFetchApi).toHaveBeenCalledTimes(1);
    });

    it('surfaces the original 401 without retrying when the refresh resolves no token', async () => {
      vi.mocked(tsRestFetchApi).mockResolvedValue(expired401);
      const refreshToken = vi.fn().mockResolvedValue(undefined);
      const api = captureApi(baseConfig({ refreshToken }));

      const result = await api({ headers: {} });

      expect(result).toBe(expired401);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(tsRestFetchApi).toHaveBeenCalledTimes(1);
    });

    it('surfaces the original 401 and logs a warning when the refresh throws', async () => {
      vi.mocked(tsRestFetchApi).mockResolvedValue(expired401);
      const refreshToken = vi.fn().mockRejectedValue(new Error('session revoked'));
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const api = captureApi({ ...baseConfig({ refreshToken }), logger });

      const result = await api({ headers: {} });

      expect(result).toBe(expired401);
      expect(tsRestFetchApi).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('[assessment-sdk] Token refresh failed', expect.any(Error));
    });

    it('returns a non-envelope 401 unchanged (string body, e.g. an HTML error page)', async () => {
      const html401 = { status: 401, body: '<html>Unauthorized</html>', headers: new Headers() };
      vi.mocked(tsRestFetchApi).mockResolvedValue(html401);
      const refreshToken = vi.fn();
      const api = captureApi(baseConfig({ refreshToken }));

      const result = await api({ headers: {} });

      expect(result).toBe(html401);
      expect(refreshToken).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent refreshes: a burst of 401s triggers one refreshToken call', async () => {
      vi.mocked(tsRestFetchApi)
        .mockResolvedValueOnce(expired401)
        .mockResolvedValueOnce(expired401)
        .mockResolvedValue(ok);

      let resolveRefresh: (token: string) => void;
      const refreshToken = vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveRefresh = resolve;
          }),
      );
      const api = captureApi(baseConfig({ refreshToken }));

      const first = api({ headers: {} });
      const second = api({ headers: {} });

      // Let both requests receive their 401s and reach the shared refresh.
      await new Promise((resolve) => setTimeout(resolve, 0));
      resolveRefresh!('fresh-token');

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult).toBe(ok);
      expect(secondResult).toBe(ok);
      expect(refreshToken).toHaveBeenCalledTimes(1);
      // Two originals + two retries.
      expect(tsRestFetchApi).toHaveBeenCalledTimes(4);
    });

    it('performs a fresh refresh for a later expiry (in-flight dedup resets after completion)', async () => {
      vi.mocked(tsRestFetchApi)
        .mockResolvedValueOnce(expired401)
        .mockResolvedValueOnce(ok)
        .mockResolvedValueOnce(expired401)
        .mockResolvedValueOnce(ok);
      const refreshToken = vi.fn().mockResolvedValue('fresh-token');
      const api = captureApi(baseConfig({ refreshToken }));

      await api({ headers: {} });
      await api({ headers: {} });

      expect(refreshToken).toHaveBeenCalledTimes(2);
    });
  });
});

describe('RoarApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(initClient).mockReturnValue({} as unknown as ReturnType<typeof initClient>);
  });

  it('throws SDKError when participantId is missing', () => {
    const contextWithoutParticipant: CommandContext = {
      baseUrl: 'https://api.example.com',
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
      baseUrl: 'https://api.example.com',
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
