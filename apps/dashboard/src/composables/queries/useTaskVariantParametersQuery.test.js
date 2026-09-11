import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASK_VARIANT_PARAMETERS_QUERY_KEY } from '@/constants/queryKeys';
import useTaskVariantParametersQuery from './useTaskVariantParametersQuery';

const mockGetByIdWithTaskDetails = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    taskVariants: { getByIdWithTaskDetails: mockGetByIdWithTaskDetails },
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

const variantOk = (id, extra = {}) => ({
  status: 200,
  body: { data: { id, taskSlug: `task-${id}`, parameters: [], ...extra } },
});

describe('useTaskVariantParametersQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockGetByIdWithTaskDetails.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the TASK_VARIANT_PARAMETERS_QUERY_KEY and the ids ref', () => {
    const variantIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantParametersQuery(variantIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [TASK_VARIANT_PARAMETERS_QUERY_KEY, variantIds],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches one variant per id, preserving order', async () => {
    const idA = '11111111-1111-1111-1111-111111111111';
    const idB = '22222222-2222-2222-2222-222222222222';
    const variantIds = ref([idA, idB]);

    // Resolve B slower than A to prove order follows the input array, not
    // resolution order.
    mockGetByIdWithTaskDetails.mockImplementation(({ params: { variantId } }) => {
      if (variantId === idB) {
        return new Promise((resolve) =>
          setTimeout(() => resolve(variantOk(idB, { parameters: [{ name: 'scoringVersion', value: 2 }] })), 5),
        );
      }
      return Promise.resolve(variantOk(idA, { parameters: [{ name: 'scoringVersion', value: 1 }] }));
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantParametersQuery(variantIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((v) => v.id)).toEqual([idA, idB]);
    expect(result[0].parameters).toEqual([{ name: 'scoringVersion', value: 1 }]);
    expect(result[1].parameters).toEqual([{ name: 'scoringVersion', value: 2 }]);
    expect(mockGetByIdWithTaskDetails).toHaveBeenCalledWith({ params: { variantId: idA } });
    expect(mockGetByIdWithTaskDetails).toHaveBeenCalledWith({ params: { variantId: idB } });
  });

  it('throws a structured error when any variant lookup is non-200', async () => {
    const variantIds = ref(['11111111-1111-1111-1111-111111111111']);
    mockGetByIdWithTaskDetails.mockResolvedValueOnce({ status: 404, body: { error: { code: 'resource/not-found' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantParametersQuery(variantIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { code: 'resource/not-found' } },
    });
  });

  it('is disabled when the ids array is empty', () => {
    const variantIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantParametersQuery(variantIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('becomes enabled once the ids array is populated', async () => {
    const variantIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantParametersQuery(variantIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);

    variantIds.value = ['11111111-1111-1111-1111-111111111111'];
    await nextTick();

    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    const variantIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantParametersQuery(variantIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    const variantIds = ref(['11111111-1111-1111-1111-111111111111']);
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantParametersQuery(variantIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
