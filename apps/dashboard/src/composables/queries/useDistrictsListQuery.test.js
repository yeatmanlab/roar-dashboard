import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { DISTRICTS_LIST_QUERY_KEY } from '@/constants/queryKeys';
import useDistrictsListQuery from './useDistrictsListQuery';

const mockDistrictsList = vi.fn();
// Controllable per-test — defaults to a truthy token so most tests don't have
// to set it up. Override via `mockUseAuthStore.mockReturnValue(...)` to
// exercise the built-in `accessToken` enablement gate.
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    districts: { list: mockDistrictsList },
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

const districtPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useDistrictsListQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockDistrictsList.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the DISTRICTS_LIST_QUERY_KEY', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [DISTRICTS_LIST_QUERY_KEY],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the districts and returns the mapped items on a 200', async () => {
    const items = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'District A',
        abbreviation: 'DA',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        location: { city: 'Palo Alto', stateProvince: 'CA' },
        identifiers: { mdrNumber: 'MDR-1', ncesId: 'NCES-1' },
      },
    ];
    mockDistrictsList.mockResolvedValueOnce(districtPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Returned objects preserve id/name and flatten location + identifiers so
    // consumers (OrgPicker/OrgsList/CreateOrgs read id + name) keep working. The nested
    // `location`/`identifiers` objects are dropped (single flat representation).
    await expect(queryFn()).resolves.toEqual([
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'District A',
        abbreviation: 'DA',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        city: 'Palo Alto',
        stateProvince: 'CA',
        mdrNumber: 'MDR-1',
        ncesId: 'NCES-1',
      },
    ]);
    expect(mockDistrictsList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: '00000000-0000-0000-0000-000000000001', name: 'A' }];
    const pageTwo = [{ id: '00000000-0000-0000-0000-000000000002', name: 'B' }];
    mockDistrictsList
      .mockResolvedValueOnce(districtPage(pageOne, 2, 1))
      .mockResolvedValueOnce(districtPage(pageTwo, 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((d) => d.id)).toEqual([pageOne[0].id, pageTwo[0].id]);
    expect(mockDistrictsList).toHaveBeenCalledTimes(2);
    expect(mockDistrictsList).toHaveBeenNthCalledWith(2, {
      query: { page: 2, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockDistrictsList.mockResolvedValueOnce({
      status: 500,
      body: { error: { code: 'internal', message: 'Internal server error' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictsListQuery(), {
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

    withSetup(() => useDistrictsListQuery(), {
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

    withSetup(() => useDistrictsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
