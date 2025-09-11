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

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useDistrictsListQuery', () => {
  let queryClient: QueryClient;

  const mockAdminOrgs = ref({
    claims: {
      adminOrgs: ['mock-org-id-1', 'mock-org-id-2'],
    },
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('should call query with correct parameters', () => {
    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: mockAdminOrgs });
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
      false,
      expect.objectContaining({ value: ['mock-org-id-1', 'mock-org-id-2'] }),
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
      enabled: expect.objectContaining({
        _value: false,
      }),
    });
  });
});
