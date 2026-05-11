import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import useMeQuery from './useMeQuery';

const mockMeGet = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    me: { get: mockMeGet },
  }),
}));

// `@/store/auth` is referenced transitively via the imports in the API client;
// useMeQuery itself doesn't touch the store, so a thin mock is sufficient.
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({ accessToken: 'test-token' }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useMeQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockMeGet.mockReset();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the ME_QUERY_KEY', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useMeQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ME_QUERY_KEY],
        queryFn: expect.any(Function),
        retry: expect.any(Function),
      }),
    );
  });

  it('returns the data envelope contents on a 200 response', async () => {
    const mePayload = {
      id: '00000000-0000-0000-0000-000000000001',
      userType: 'student',
      nameFirst: 'Test',
      nameLast: 'User',
      unsignedAgreements: [],
    };
    mockMeGet.mockResolvedValueOnce({ status: 200, body: { data: mePayload } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useMeQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(mePayload);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockMeGet.mockResolvedValueOnce({
      status: 401,
      body: { error: { code: 'auth/required', message: 'Unauthorized' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useMeQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 401,
      body: { error: { code: 'auth/required' } },
    });
  });

  it('does not retry on rostering-ended errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useMeQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const rosteringEndedError = { body: { error: { code: 'auth/rostering-ended' } } };
    expect(retryFn(0, rosteringEndedError)).toBe(false);
  });

  it('does not retry on terminal auth errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useMeQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const authRequiredError = { body: { error: { code: 'auth/required' } } };
    const tokenExpiredError = { body: { error: { code: 'auth/token-expired' } } };
    expect(retryFn(0, authRequiredError)).toBe(false);
    expect(retryFn(0, tokenExpiredError)).toBe(false);
  });

  it('retries up to 3 times on transient errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useMeQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const networkError = new Error('network down');
    expect(retryFn(0, networkError)).toBe(true);
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });

  it('treats a raw Error (no body) as a transient failure, not as auth/rostering-ended', () => {
    // A network failure surfaces as a plain `Error` with no `body` field.
    // `isRosteringEndedError` / `isTerminalAuthError` walk `error?.body?.error?.code`
    // and return false for undefined. The retry policy must therefore NOT
    // short-circuit on raw errors — it must continue retrying.
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useMeQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const rawError = new Error('Failed to fetch');
    expect(retryFn(0, rawError)).toBe(true);
    expect(retryFn(1, rawError)).toBe(true);
    expect(retryFn(2, rawError)).toBe(true);
    expect(retryFn(3, rawError)).toBe(false);
  });

  it('honors a caller-provided `enabled: false`', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useMeQuery({ enabled: false }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });
});
