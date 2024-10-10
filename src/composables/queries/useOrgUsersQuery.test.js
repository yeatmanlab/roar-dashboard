import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { fetchUsersByOrg } from '@/helpers/query/users';
import useOrgUsersQuery from './useOrgUsersQuery';

vi.mock('@/helpers/query/users', () => ({
  fetchUsersByOrg: vi.fn().mockImplementation(() => [{ name: 'mock-user' }]),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useOrgUsersQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    const mockOrgType = 'org';
    const mockOrgId = nanoid();
    const mockPageNumber = 1;
    const mockOrderBy = 'name';
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useOrgUsersQuery(mockOrgType, mockOrgId, mockPageNumber, mockOrderBy, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['org-users', mockOrgType, mockOrgId, mockPageNumber, mockOrderBy],
      queryFn: expect.any(Function),
      enabled: true,
    });

    expect(fetchUsersByOrg).toHaveBeenCalledWith(
      mockOrgType,
      mockOrgId,
      expect.anything(),
      mockPageNumber,
      mockOrderBy,
    );
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const mockOrgType = 'org';
    const mockOrgId = nanoid();
    const mockPageNumber = 1;
    const mockOrderBy = 'name';
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useOrgUsersQuery(mockOrgType, mockOrgId, mockPageNumber, mockOrderBy, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['org-users', mockOrgType, mockOrgId, mockPageNumber, mockOrderBy],
      queryFn: expect.any(Function),
      enabled: false,
    });

    expect(fetchUsersByOrg).not.toHaveBeenCalled();
  });
});
