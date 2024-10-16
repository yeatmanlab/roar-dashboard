import { nextTick, ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { orgFetcher } from '@/helpers/query/orgs';
import useGroupsListQuery from './useGroupsListQuery';
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

describe('useGroupsListQuery', () => {
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

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['groups-list'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(orgFetcher).toHaveBeenCalledWith(
      'groups',
      undefined,
      expect.objectContaining({ value: true }),
      expect.objectContaining({ value: ['mock-org-id-1', 'mock-org-id-2'] }),
    );
  });

  it('should only fetch data once user claims are available', async () => {
    const mockClaimsData = ref({});
    const mockClaimsLoading = ref(true);

    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: mockClaimsData, isLoading: mockClaimsLoading });

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['groups-list'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(orgFetcher).not.toHaveBeenCalled();

    mockClaimsData.value = mockUserClaims.value;
    mockClaimsLoading.value = false;

    await nextTick();

    expect(orgFetcher).toHaveBeenCalled();
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsListQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['groups-list'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });
  });
});
