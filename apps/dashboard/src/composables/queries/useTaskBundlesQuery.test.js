import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASK_BUNDLES_QUERY_KEY } from '@/constants/queryKeys';
import useTaskBundlesQuery from './useTaskBundlesQuery';

const mockTaskBundlesList = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    taskBundles: { list: mockTaskBundlesList },
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

describe('useTaskBundlesQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockTaskBundlesList.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the TASK_BUNDLES_QUERY_KEY', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskBundlesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [TASK_BUNDLES_QUERY_KEY],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the taskVariantDetails embed and unwraps the items array on a 200 response', async () => {
    const bundleItems = [
      {
        id: '00000000-0000-0000-0000-0000000000b1',
        slug: 'early-reading',
        name: 'Early Reading',
        description: 'Bundle of early reading tasks',
        image: null,
        taskVariants: [
          {
            taskVariantId: '00000000-0000-0000-0000-00000000000a',
            taskSlug: 'swr',
            taskName: 'SWR',
            taskVariantName: 'Variant 1',
            sortOrder: 0,
            // embed=taskVariantDetails fields
            taskId: '00000000-0000-0000-0000-000000000001',
            status: 'published',
            parameters: [],
          },
        ],
      },
    ];
    mockTaskBundlesList.mockResolvedValue({
      status: 200,
      body: { data: { items: bundleItems, pagination: { page: 1, perPage: 100, totalItems: 1, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskBundlesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(bundleItems);
    expect(mockTaskBundlesList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 100, embed: 'taskVariantDetails' },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: 'b1', taskVariants: [] }];
    const pageTwo = [{ id: 'b2', taskVariants: [] }];
    mockTaskBundlesList
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

    withSetup(() => useTaskBundlesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...pageOne, ...pageTwo]);
    expect(mockTaskBundlesList).toHaveBeenCalledTimes(2);
    expect(mockTaskBundlesList).toHaveBeenNthCalledWith(2, {
      query: { page: 2, perPage: 100, embed: 'taskVariantDetails' },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    // The endpoint is super-admin-or-platform-admin only, so 403 is the
    // realistic failure mode for under-privileged callers.
    mockTaskBundlesList.mockResolvedValue({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskBundlesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });
  });

  it('does not retry on terminal auth or rostering-ended errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskBundlesQuery(), {
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

    withSetup(() => useTaskBundlesQuery(), {
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

    withSetup(() => useTaskBundlesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled when the auth store has an access token', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskBundlesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });
});
