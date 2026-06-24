import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASK_BUNDLES_QUERY_KEY } from '@/constants/queryKeys';
import useTaskBundlesQuery from './useTaskBundlesQuery';

const mockList = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ taskBundles: { list: mockList } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const bundle = {
  id: '00000000-0000-0000-0000-0000000000c1',
  slug: 'core-bundle',
  name: 'Core Bundle',
  description: 'A core set of tasks',
  image: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: null,
  taskVariants: [
    {
      taskVariantId: '00000000-0000-0000-0000-0000000000a1',
      taskSlug: 'swr',
      taskName: 'ROAR - Word',
      taskVariantName: 'default',
      sortOrder: 0,
      taskId: '00000000-0000-0000-0000-0000000000b1',
    },
  ],
};

const bundlePage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useTaskBundlesQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockList.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the list-scoped task-bundles key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useTaskBundlesQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [TASK_BUNDLES_QUERY_KEY, 'list'], queryFn: expect.any(Function) }),
    );
  });

  it('requests embed=taskVariantDetails and returns the flat bundle items on a 200', async () => {
    mockList.mockResolvedValueOnce(bundlePage([bundle]));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useTaskBundlesQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).resolves.toEqual([bundle]);
    expect(mockList).toHaveBeenCalledWith({ query: { page: 1, perPage: 100, embed: 'taskVariantDetails' } });
  });

  it('follows pagination across multiple pages', async () => {
    const second = { ...bundle, id: 'c2' };
    mockList.mockResolvedValueOnce(bundlePage([bundle], 2, 1)).mockResolvedValueOnce(bundlePage([second], 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useTaskBundlesQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).resolves.toEqual([bundle, second]);
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockList.mockResolvedValueOnce({ status: 403, body: { error: { code: 'forbidden' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useTaskBundlesQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).rejects.toMatchObject({ status: 403 });
  });

  it('is disabled without an access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useTaskBundlesQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('does not retry on a terminal auth error but retries up to MAX_RETRIES otherwise', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useTaskBundlesQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    const { retry } = VueQuery.useQuery.mock.calls[0][0];

    expect(retry(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retry(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retry(0, { body: { error: { code: 'some/other-error' } } })).toBe(true);
    expect(retry(3, { body: { error: { code: 'some/other-error' } } })).toBe(false);
  });
});
