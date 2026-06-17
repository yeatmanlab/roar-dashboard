import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationQuery from './useAdministrationQuery';

const mockGet = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ administrations: { get: mockGet } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

describe('useAdministrationQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGet.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the administration query key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationQuery(ref(ADMIN_ID)), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ADMINISTRATION_QUERY_KEY, expect.anything()],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches the administration and returns its data on a 200', async () => {
    const administration = { id: ADMIN_ID, name: 'Admin A', publicName: 'Public A', isOrdered: false };
    mockGet.mockResolvedValueOnce({ status: 200, body: { data: administration } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationQuery(ref(ADMIN_ID)), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).resolves.toEqual(administration);
    expect(mockGet).toHaveBeenCalledWith({ params: { id: ADMIN_ID } });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockGet.mockResolvedValueOnce({ status: 404, body: { error: { code: 'not-found' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationQuery(ref(ADMIN_ID)), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).rejects.toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
  });

  it('is disabled without an id or without a token', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationQuery(ref(null)), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);

    VueQuery.useQuery.mockClear();
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    withSetup(() => useAdministrationQuery(ref(ADMIN_ID)), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });
});
