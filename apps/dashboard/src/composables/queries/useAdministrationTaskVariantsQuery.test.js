import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationTaskVariantsQuery from './useAdministrationTaskVariantsQuery';

const mockListTaskVariants = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ administrations: { listTaskVariants: mockListTaskVariants } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

const tvPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useAdministrationTaskVariantsQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockListTaskVariants.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the task-variants query key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationTaskVariantsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ADMINISTRATION_TASK_VARIANTS_QUERY_KEY, expect.anything()],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests variants ordered by orderIndex and returns the items on a 200', async () => {
    const items = [{ id: 'v1', name: 'Variant 1', orderIndex: 0, task: { id: 't1', name: 'Task 1' }, conditions: {} }];
    mockListTaskVariants.mockResolvedValueOnce(tvPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationTaskVariantsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(items);
    expect(mockListTaskVariants).toHaveBeenCalledWith({
      params: { id: ADMIN_ID },
      query: { page: 1, perPage: 100, sortBy: 'orderIndex', sortOrder: 'asc' },
    });
  });

  it('follows pagination across multiple pages', async () => {
    const p1 = [{ id: 'v1', orderIndex: 0 }];
    const p2 = [{ id: 'v2', orderIndex: 1 }];
    mockListTaskVariants.mockResolvedValueOnce(tvPage(p1, 2, 1)).mockResolvedValueOnce(tvPage(p2, 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationTaskVariantsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...p1, ...p2]);
    expect(mockListTaskVariants).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListTaskVariants.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationTaskVariantsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({ status: 500 });
  });

  it('is disabled without an id', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationTaskVariantsQuery(ref(null)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });
});
