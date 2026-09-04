import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import useTaskVariantsListQuery from './useTaskVariantsListQuery';

const mockList = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ taskVariants: { list: mockList } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const variant = {
  id: '00000000-0000-0000-0000-0000000000a1',
  taskId: '00000000-0000-0000-0000-0000000000b1',
  name: 'default',
  status: 'published',
  taskName: 'ROAR - Word',
  taskSlug: 'swr',
  taskImage: null,
  parameters: [{ name: 'corpus', value: 'aoe' }],
};

const tvPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useTaskVariantsListQuery', () => {
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

  it('calls useQuery with the list-scoped task-variants key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useTaskVariantsListQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [TASK_VARIANTS_QUERY_KEY, 'list'], queryFn: expect.any(Function) }),
    );
  });

  it('requests embed=parameters and returns the flat variant items on a 200', async () => {
    mockList.mockResolvedValueOnce(tvPage([variant]));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useTaskVariantsListQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).resolves.toEqual([variant]);
    expect(mockList).toHaveBeenCalledWith({ query: { page: 1, perPage: 100, embed: 'parameters' } });
  });

  it('follows pagination across multiple pages', async () => {
    const second = { ...variant, id: 'a2' };
    mockList.mockResolvedValueOnce(tvPage([variant], 2, 1)).mockResolvedValueOnce(tvPage([second], 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useTaskVariantsListQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).resolves.toEqual([variant, second]);
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockList.mockResolvedValueOnce({ status: 403, body: { error: { code: 'forbidden' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useTaskVariantsListQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).rejects.toMatchObject({ status: 403 });
  });

  it('is disabled without an access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useTaskVariantsListQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });
});
