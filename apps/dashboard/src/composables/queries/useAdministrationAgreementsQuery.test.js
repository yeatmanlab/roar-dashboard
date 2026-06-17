import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_AGREEMENTS_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationAgreementsQuery from './useAdministrationAgreementsQuery';

const mockListAgreements = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ administrations: { listAgreements: mockListAgreements } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

const agPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useAdministrationAgreementsQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockListAgreements.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the agreements query key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationAgreementsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ADMINISTRATION_AGREEMENTS_QUERY_KEY, expect.anything()],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the administration agreements and returns the items on a 200', async () => {
    const items = [{ id: 'c1', name: 'Consent', agreementType: 'consent', currentVersion: null }];
    mockListAgreements.mockResolvedValueOnce(agPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationAgreementsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(items);
    expect(mockListAgreements).toHaveBeenCalledWith({
      params: { id: ADMIN_ID },
      query: { page: 1, perPage: 100 },
    });
  });

  it('follows pagination across multiple pages', async () => {
    const p1 = [{ id: 'c1', agreementType: 'consent' }];
    const p2 = [{ id: 'a1', agreementType: 'assent' }];
    mockListAgreements.mockResolvedValueOnce(agPage(p1, 2, 1)).mockResolvedValueOnce(agPage(p2, 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationAgreementsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...p1, ...p2]);
    expect(mockListAgreements).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListAgreements.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAdministrationAgreementsQuery(ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({ status: 500 });
  });

  it('is disabled without an id', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAdministrationAgreementsQuery(ref(null)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });
});
