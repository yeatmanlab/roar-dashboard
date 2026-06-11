import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';
import useTasksQuery from './useTasksQuery';

const mockTasksList = vi.fn();
// Controllable per-test — defaults to a truthy token so most tests don't have
// to set it up. Override via `mockUseAuthStore.mockReturnValue(...)` to
// exercise the built-in `accessToken` enablement gate.
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { list: mockTasksList },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useTasksQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockTasksList.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the TASKS_QUERY_KEY', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [TASKS_QUERY_KEY],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the full catalog and returns the items array on a 200 response', async () => {
    const tasks = [
      { id: '00000000-0000-0000-0000-000000000001', slug: 'swr', name: 'SWR', nameSimple: 'ROAR - Word' },
      { id: '00000000-0000-0000-0000-000000000002', slug: 'pa', name: 'PA', nameSimple: 'ROAR - Phoneme' },
    ];
    mockTasksList.mockResolvedValueOnce({
      status: 200,
      body: { data: { items: tasks, pagination: { page: 1, perPage: 100, totalItems: 2, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(tasks);
    expect(mockTasksList).toHaveBeenCalledWith({ query: { page: 1, perPage: 100 } });
  });

  it('follows pagination and aggregates all pages when the catalog exceeds one page', async () => {
    const pageOne = [{ id: '00000000-0000-0000-0000-000000000001', slug: 'swr', name: 'SWR' }];
    const pageTwo = [{ id: '00000000-0000-0000-0000-000000000002', slug: 'pa', name: 'PA' }];
    mockTasksList
      .mockResolvedValueOnce({
        status: 200,
        body: { data: { items: pageOne, pagination: { page: 1, perPage: 100, totalItems: 101, totalPages: 2 } } },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { data: { items: pageTwo, pagination: { page: 2, perPage: 100, totalItems: 101, totalPages: 2 } } },
      });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...pageOne, ...pageTwo]);
    expect(mockTasksList).toHaveBeenCalledTimes(2);
    expect(mockTasksList).toHaveBeenNthCalledWith(2, { query: { page: 2, perPage: 100 } });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockTasksList.mockResolvedValueOnce({
      status: 500,
      body: { error: { code: 'internal', message: 'Internal server error' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 500,
      body: { error: { code: 'internal' } },
    });
  });

  it('does not retry on terminal auth or rostering-ended errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const authRequiredError = { body: { error: { code: 'auth/required' } } };
    const tokenExpiredError = { body: { error: { code: 'auth/token-expired' } } };
    const rosteringEndedError = { body: { error: { code: 'auth/rostering-ended' } } };
    expect(retryFn(0, authRequiredError)).toBe(false);
    expect(retryFn(0, tokenExpiredError)).toBe(false);
    expect(retryFn(0, rosteringEndedError)).toBe(false);
  });

  it('retries up to 3 times on transient errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const networkError = new Error('network down');
    expect(retryFn(0, networkError)).toBe(true);
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled when the auth store has an access token and no overrides are passed', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: 'live-token' });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });

  it('stays disabled when caller passes `enabled: true` but no token is available', () => {
    // The internal `accessToken` gate is AND'd with the caller's `enabled`,
    // never replaced by it.
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery({ enabled: true }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('honors a caller-provided `enabled: false`', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery({ enabled: false }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });
});
