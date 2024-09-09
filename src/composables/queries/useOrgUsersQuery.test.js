import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
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

  it('should call useQuery with correct parameters', () => {
    const orgType = 'org';
    const orgId = '1';
    const page = 1;
    const orderBy = 'name';
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useOrgUsersQuery(orgType, orgId, page, orderBy, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['org-users', orgType, orgId, page, orderBy],
      queryFn: expect.any(Function),
      enabled: false,
    });
  });

  it('should call fetchUsersByOrg with correct parameters', async () => {
    const orgType = 'school';
    const orgId = 'mock-school-uid';
    const page = 1;
    const orderBy = 'name';

    withSetup(() => useOrgUsersQuery(orgType, orgId, page, orderBy), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(fetchUsersByOrg).toHaveBeenCalledWith(orgType, orgId, expect.anything(), page, orderBy);
  });
});
