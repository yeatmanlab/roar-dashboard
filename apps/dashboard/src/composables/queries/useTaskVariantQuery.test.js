import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASK_VARIANT_QUERY_KEY } from '@/constants/queryKeys';
import useTaskVariantQuery from './useTaskVariantQuery';

const mockGetTaskVariant = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { getTaskVariant: mockGetTaskVariant },
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

const TASK_ID = '00000000-0000-0000-0000-0000000000aa';
const VARIANT_ID = '00000000-0000-0000-0000-0000000000bb';

describe('useTaskVariantQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockGetTaskVariant.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the variant-scoped query key', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantQuery(ref(TASK_ID), ref(VARIANT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [TASK_VARIANT_QUERY_KEY, expect.anything(), expect.anything()],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches the variant and returns its data (including parameters) on a 200 response', async () => {
    const variant = {
      id: VARIANT_ID,
      taskId: TASK_ID,
      taskName: 'ROAR - Word',
      name: 'default',
      parameters: [{ name: 'corpus', value: 'aoe' }],
    };
    mockGetTaskVariant.mockResolvedValueOnce({ status: 200, body: { data: variant } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantQuery(ref(TASK_ID), ref(VARIANT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(variant);
    expect(mockGetTaskVariant).toHaveBeenCalledWith({ params: { taskId: TASK_ID, variantId: VARIANT_ID } });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockGetTaskVariant.mockResolvedValueOnce({ status: 404, body: { error: { code: 'not-found' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useTaskVariantQuery(ref(TASK_ID), ref(VARIANT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
  });

  it('stays disabled until both ids are present', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantQuery(ref(null), ref(null)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled when the token and both ids are present', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantQuery(ref(TASK_ID), ref(VARIANT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantQuery(ref(TASK_ID), ref(VARIANT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });
});
