import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { orgFetcher } from '@/helpers/query/orgs';
import { fetchDocById } from '@/helpers/query/utils';
import useDistrictsQuery from './useDistrictsQuery';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';

vi.mock('@/helpers/query/orgs', () => ({
  orgFetcher: vi.fn().mockImplementation(() => []),
}));

vi.mock('@/helpers/query/utils', () => ({
  fetchDocById: vi.fn().mockImplementation(() => []),
}));

vi.mock('@/composables/queries/useUserClaimsQuery');

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useDistrictsQuery', () => {
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

  it('should call query with correct parameters when fetching all districts', () => {
    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: mockUserClaims });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['districts'],
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

  it('should call query with correct parameters when fetching a specific district', () => {
    const districtId = nanoid();

    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: mockUserClaims });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsQuery(districtId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['districts', districtId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocById).toHaveBeenCalledWith('districts', districtId);
  });

  it('should only fetch districts only once user claims are loaded', async () => {
    vi.mocked(useUserClaimsQuery).mockReturnValue({ data: {}, isLoading: ref(true) });

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['districts'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(orgFetcher).not.toHaveBeenCalled();
  });
});
