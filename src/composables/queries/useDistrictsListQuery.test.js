import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { orgFetcher } from '@/helpers/query/orgs';
import useDistrictsListQuery from './useDistrictsListQuery';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';

vi.mock('@/helpers/query/orgs', () => ({
  orgFetcher: vi.fn().mockImplementation(() => []),
}));

vi.mock('@/composables/queries/useUserClaimsQuery');

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useDistrictsListQuery', () => {
  let queryClient;

  const mockUserClaims = ref({
    claims: {
      minimalAdminOrgs: ['mock-org-id-1', 'mock-org-id-2'],
      super_admin: true,
    },
  });

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('should call query with correct parameters', () => {
    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: mockUserClaims });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['districts-list'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(orgFetcher).toHaveBeenCalledWith(
      'districts',
      undefined,
      expect.objectContaining({ value: true }),
      expect.objectContaining({ value: ['mock-org-id-1', 'mock-org-id-2'] }),
    );
  });

  it('should only fetch districts only once user claims are loaded', async () => {
    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: {}, isLoading: ref(true) });

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['districts-list'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(orgFetcher).not.toHaveBeenCalled();
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsListQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['districts-list'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });
  });
});
