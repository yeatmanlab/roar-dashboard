import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { GROUPS_LIST_QUERY_KEY } from '@/constants/queryKeys';
import useGroupsListQuery from './useGroupsListQuery';

const mockGroupsList = vi.fn();
// Controllable per-test — defaults to a truthy token so most tests don't have
// to set it up. Override via `mockUseAuthStore.mockReturnValue(...)` to
// exercise the built-in `accessToken` enablement gate.
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    groups: { list: mockGroupsList },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

const groupPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useGroupsListQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockGroupsList.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the GROUPS_LIST_QUERY_KEY', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [GROUPS_LIST_QUERY_KEY],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the groups and returns the mapped items on a 200', async () => {
    const items = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Group A',
        abbreviation: 'GA',
        groupType: 'cohort',
        location: { city: 'Palo Alto', stateProvince: 'CA' },
      },
    ];
    mockGroupsList.mockResolvedValueOnce(groupPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Returned objects keep id/name/abbreviation/groupType and flatten location
    // to top-level fields so consumers (CreateOrgs reads tags off the array;
    // reports read name) keep working. The nested `location` object is dropped
    // (single flat representation). Groups have no identifiers block, so only
    // location is flattened.
    await expect(queryFn()).resolves.toEqual([
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Group A',
        abbreviation: 'GA',
        groupType: 'cohort',
        city: 'Palo Alto',
        stateProvince: 'CA',
        addressLine1: undefined,
        addressLine2: undefined,
        postalCode: undefined,
        country: undefined,
      },
    ]);
    expect(mockGroupsList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: '00000000-0000-0000-0000-000000000001', name: 'A' }];
    const pageTwo = [{ id: '00000000-0000-0000-0000-000000000002', name: 'B' }];
    mockGroupsList.mockResolvedValueOnce(groupPage(pageOne, 2, 1)).mockResolvedValueOnce(groupPage(pageTwo, 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((g) => g.id)).toEqual([pageOne[0].id, pageTwo[0].id]);
    expect(mockGroupsList).toHaveBeenCalledTimes(2);
    expect(mockGroupsList).toHaveBeenNthCalledWith(2, {
      query: { page: 2, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockGroupsList.mockResolvedValueOnce({
      status: 500,
      body: { error: { code: 'internal', message: 'Internal server error' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 500,
      body: { error: { code: 'internal' } },
    });
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useGroupsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
