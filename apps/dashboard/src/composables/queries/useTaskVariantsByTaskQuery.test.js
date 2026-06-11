import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import useTaskVariantsByTaskQuery from './useTaskVariantsByTaskQuery';

const mockListTaskVariants = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { listTaskVariants: mockListTaskVariants },
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

const MOCK_TASK_ID = '00000000-0000-0000-0000-000000000001';

describe('useTaskVariantsByTaskQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockListTaskVariants.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with a key composed of the variants key, taskId, and status', () => {
    vi.spyOn(VueQuery, 'useQuery');
    const taskId = ref(MOCK_TASK_ID);
    const status = ref('published');

    withSetup(() => useTaskVariantsByTaskQuery(taskId, status), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [TASK_VARIANTS_QUERY_KEY, taskId, status],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('passes the status filter to the endpoint and unwraps the items', async () => {
    const variantItems = [{ id: 'v1', taskId: MOCK_TASK_ID, name: 'Variant 1', status: 'published', parameters: [] }];
    mockListTaskVariants.mockResolvedValue({
      status: 200,
      body: { data: { items: variantItems, pagination: { page: 1, perPage: 100, totalItems: 1, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantsByTaskQuery(MOCK_TASK_ID, 'draft'), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(variantItems);
    expect(mockListTaskVariants).toHaveBeenCalledWith({
      params: { taskId: MOCK_TASK_ID },
      query: { page: 1, perPage: 100, status: 'draft' },
    });
  });

  it('omits the status param when no status filter is set', async () => {
    mockListTaskVariants.mockResolvedValue({
      status: 200,
      body: { data: { items: [], pagination: { page: 1, perPage: 100, totalItems: 0, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantsByTaskQuery(MOCK_TASK_ID, null), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await queryFn();
    expect(mockListTaskVariants).toHaveBeenCalledWith({
      params: { taskId: MOCK_TASK_ID },
      query: { page: 1, perPage: 100 },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: 'v1', status: 'published', parameters: [] }];
    const pageTwo = [{ id: 'v2', status: 'published', parameters: [] }];
    mockListTaskVariants
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

    withSetup(() => useTaskVariantsByTaskQuery(MOCK_TASK_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...pageOne, ...pageTwo]);
    expect(mockListTaskVariants).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListTaskVariants.mockResolvedValue({
      status: 404,
      body: { error: { message: 'Not found' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantsByTaskQuery(MOCK_TASK_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { message: 'Not found' } },
    });
  });

  it('is disabled when no taskId is provided, even with a token', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantsByTaskQuery(ref('')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is disabled without an access token, even with a taskId', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantsByTaskQuery(MOCK_TASK_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled with both a token and a taskId', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantsByTaskQuery(MOCK_TASK_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });
});
