import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { type QueryClient } from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { orgFetcher } from '@/helpers/query/orgs';
import useDistrictsListQuery from './useDistrictsListQuery';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/helpers/query/orgs', () => ({
  orgFetcher: vi.fn().mockImplementation(() => []),
}));

vi.mock('@/composables/queries/useUserClaimsQuery');

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => ({
    isUserSuperAdmin: vi.fn(() => true),
  })),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useDistrictsListQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    setActivePinia(createPinia());
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('should call query with correct parameters', () => {
    vi.mocked(useUserClaimsQuery).mockReturnValue({
      data: ref({
        claims: {
          adminOrgs: ['mock-org-id-1', 'mock-org-id-2'],
        },
      }),
    });
    vi.spyOn(VueQuery, 'useQuery');

    const [result] = withSetup(() => useDistrictsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['districts-list'],
      queryFn: expect.any(Function),
      enabled: expect.any(Object),
    });

    // Get the query function and call it to test orgFetcher
    const queryCall = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    const queryFn = queryCall.queryFn;
    queryFn();

    expect(orgFetcher).toHaveBeenCalledWith(
      'districts',
      undefined,
      expect.any(Object), // ref(isUserSuperAdmin())
      expect.any(Object), // administrationOrgs computed ref
    );
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
      enabled: expect.any(Object),
    });
  });
});
