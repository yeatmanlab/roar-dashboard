import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { AGREEMENTS_QUERY_KEY } from '@/constants/queryKeys';
import useAgreementsQuery from './useAgreementsQuery';

const mockList = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ agreements: { list: mockList } }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const consentAgreement = {
  id: '00000000-0000-0000-0000-0000000000c1',
  name: 'Standard Consent',
  agreementType: 'consent',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
  currentVersion: {
    id: 'v1',
    locale: 'en-US',
    githubFilename: 'consent.md',
    githubOrgRepo: 'o/r',
    githubCommitSha: 'abc',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

const agPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useAgreementsQuery', () => {
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

  it('calls useQuery with the agreements key including the type', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAgreementsQuery(ref('consent')), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [AGREEMENTS_QUERY_KEY, expect.anything()],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('passes the agreementType filter and returns the items on a 200', async () => {
    mockList.mockResolvedValueOnce(agPage([consentAgreement]));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAgreementsQuery(ref('consent')), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).resolves.toEqual([consentAgreement]);
    expect(mockList).toHaveBeenCalledWith({ query: { page: 1, perPage: 100, agreementType: 'consent' } });
  });

  it('omits the agreementType filter when none is given', async () => {
    mockList.mockResolvedValueOnce(agPage([]));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAgreementsQuery(), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await queryFn();
    expect(mockList).toHaveBeenCalledWith({ query: { page: 1, perPage: 100 } });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockList.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useAgreementsQuery(ref('consent')), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });

    await expect(queryFn()).rejects.toMatchObject({ status: 500 });
  });

  it('is disabled without an access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useAgreementsQuery(ref('consent')), { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });
});
